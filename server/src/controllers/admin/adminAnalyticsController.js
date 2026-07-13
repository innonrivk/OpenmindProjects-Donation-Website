import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import { generateSvgChart } from '../../utils/chartSvgGenerator.js';

/**
 * Determines chart bucket granularity from a date range span.
 *
 * Why? Removing hardcoded 4-series response allows a single dynamic query
 * that auto-selects the right time bucket (weekly/biweekly/monthly/yearly)
 * based on how many days the requested window spans.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {'weekly'|'biweekly'|'monthly'|'yearly'}
 */
function resolveGranularity(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((endDate - startDate) / msPerDay);
  if (days <= 92)  return 'weekly';
  if (days <= 186) return 'biweekly';
  if (days <= 396) return 'monthly';
  return 'yearly';
}

/**
 * Aggregates donation data for chart rendering, scoped by optional filters.
 *
 * Why? Centralising analytics query logic here allows both the controller
 * and the SVG download endpoint to share the same filtered dataset without
 * duplicating WHERE logic. Period filling is done in JavaScript after fetching 
 * raw aggregated sums.
 * Amounts stored in cents are converted to USD at this layer.
 *
 * @param {object} [filters]
 * @param {Date}   [filters.startDate]    - Inclusive start of date range.
 * @param {Date}   [filters.endDate]      - Inclusive end of date range.
 * @param {string} [filters.donationType] - 'MONTHLY' | 'ONE_TIME' | undefined (all).
 * @param {number} [filters.tierId]       - Numeric tier ID to scope users, or null.
 * @returns {Promise<{series: Array<{period: string, monthly: number, oneTime: number}>, granularity: string}>}
 */
async function buildAnalyticsData(filters = {}) {
  const now = new Date();

  // Resolve date window — default to last 12 months
  const endDate   = filters.endDate   instanceof Date ? filters.endDate   : now;
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startDate = filters.startDate instanceof Date ? filters.startDate : defaultStart;

  const granularity = resolveGranularity(startDate, endDate);

  // Helper: format Date as YYYY-MM-DD
  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dy}`;
  }

  // Helper: get Monday of a given date's week
  function getMondayOfDate(d) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
  }

  /**
   * Optional SQL WHERE fragments for type/tier filters.
   * Values are validated/cast to primitives before use so template injection is safe.
   */
  const typeClause = filters.donationType === 'MONTHLY'
    ? 'AND is_recurring = true'
    : filters.donationType === 'ONE_TIME'
      ? 'AND is_recurring = false'
      : '';

  const tierClause = filters.tierId
    ? `AND user_id IN (SELECT user_id FROM user_tiers WHERE tier_id = ${Number(filters.tierId)})`
    : '';

  // ── MONTHLY granularity ──────────────────────────────────────────────────
  if (granularity === 'monthly') {
    const monthlyPeriods = [];
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endM = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cur <= endM) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      monthlyPeriods.push(`${y}-${m}`);
      cur.setMonth(cur.getMonth() + 1);
    }

    const raw = await prisma.$queryRaw`
      SELECT
        to_char(created_at, 'YYYY-MM') AS period,
        is_recurring AS "isRecurring",
        SUM(amount) AS total
      FROM transactions
      WHERE status = 'SUCCEEDED'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        ${Prisma.raw(typeClause)}
        ${Prisma.raw(tierClause)}
      GROUP BY period, is_recurring
    `;

    const map = {};
    for (const row of raw) {
      if (!row.period) continue;
      if (!map[row.period]) map[row.period] = { monthly: 0, oneTime: 0 };
      const usd = Number(row.total) / 100;
      if (row.isRecurring === 1 || row.isRecurring === true) {
        map[row.period].monthly += usd;
      } else {
        map[row.period].oneTime += usd;
      }
    }

    const series = monthlyPeriods.map(p => ({
      period: p,
      monthly: map[p]?.monthly || 0,
      oneTime: map[p]?.oneTime || 0,
    }));

    return { series, granularity };
  }

  // ── YEARLY granularity ───────────────────────────────────────────────────
  if (granularity === 'yearly') {
    const yearlyPeriods = [];
    for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
      yearlyPeriods.push(String(y));
    }

    const raw = await prisma.$queryRaw`
      SELECT
        to_char(created_at, 'YYYY') AS period,
        is_recurring AS "isRecurring",
        SUM(amount) AS total
      FROM transactions
      WHERE status = 'SUCCEEDED'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        ${Prisma.raw(typeClause)}
        ${Prisma.raw(tierClause)}
      GROUP BY period, is_recurring
    `;

    const map = {};
    for (const row of raw) {
      if (!row.period) continue;
      if (!map[row.period]) map[row.period] = { monthly: 0, oneTime: 0 };
      const usd = Number(row.total) / 100;
      if (row.isRecurring === 1 || row.isRecurring === true) {
        map[row.period].monthly += usd;
      } else {
        map[row.period].oneTime += usd;
      }
    }

    const series = yearlyPeriods.map(p => ({
      period: p,
      monthly: map[p]?.monthly || 0,
      oneTime: map[p]?.oneTime || 0,
    }));

    return { series, granularity };
  }

  // ── WEEKLY / BIWEEKLY granularity ────────────────────────────────────────
  // Fetch daily data then bucket into N-day windows.
  const bucketSize    = granularity === 'biweekly' ? 14 : 7;
  const anchorMonday  = getMondayOfDate(startDate);
  const msPerDay      = 24 * 60 * 60 * 1000;

  // Generate all bucket-start dates within the range
  const periods = [];
  const curBucket = new Date(anchorMonday);
  while (curBucket <= endDate) {
    periods.push(formatDate(curBucket));
    curBucket.setDate(curBucket.getDate() + bucketSize);
  }

  const raw = await prisma.$queryRaw`
    SELECT
      to_char(created_at, 'YYYY-MM-DD') AS period,
      is_recurring AS "isRecurring",
      SUM(amount) AS total
    FROM transactions
    WHERE status = 'SUCCEEDED'
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
      ${Prisma.raw(typeClause)}
      ${Prisma.raw(tierClause)}
    GROUP BY period, is_recurring
  `;

  const map = {};
  for (const row of raw) {
    if (!row.period) continue;
    const [yr, mo, dy] = row.period.split('-').map(Number);
    const date    = new Date(yr, mo - 1, dy);
    const monday  = getMondayOfDate(date);
    const daysDiff  = Math.round((monday - anchorMonday) / msPerDay);
    const bucketIdx = Math.floor(daysDiff / bucketSize);
    const bucketStart = new Date(anchorMonday);
    bucketStart.setDate(anchorMonday.getDate() + bucketIdx * bucketSize);
    const key = formatDate(bucketStart);

    if (!map[key]) map[key] = { monthly: 0, oneTime: 0 };
    const usd = Number(row.total) / 100;
    if (row.isRecurring === 1 || row.isRecurring === true) {
      map[key].monthly += usd;
    } else {
      map[key].oneTime += usd;
    }
  }

  const series = periods.map(p => ({
    period: p,
    monthly: map[p]?.monthly || 0,
    oneTime: map[p]?.oneTime || 0,
  }));

  return { series, granularity };
}

/**
 * Controller to retrieve donation analytics for chart rendering.
 *
 * Why? Provides the structured JSON payload containing the dynamically bucketed
 * series so the dashboard can render a line chart regardless of the requested
 * date window. Supports optional start_date, end_date, donation_type, and tierId
 * query params so the chart can be scoped to specific donor segments.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getDonationAnalytics(req, res, next) {
  try {
    const filters = {};

    const view = req.query.view;
    if (view && !req.query.start_date && !req.query.end_date) {
      const now = new Date();
      if (view === 'MONTHLY_3') {
        const from = new Date(now);
        from.setMonth(from.getMonth() - 3);
        filters.startDate = from;
      } else if (view === 'MONTHLY_6') {
        const from = new Date(now);
        from.setMonth(from.getMonth() - 6);
        filters.startDate = from;
      } else if (view === 'YEARLY') {
        const from = new Date(now.getFullYear() - 9, 0, 1);
        filters.startDate = from;
      } else {
        const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        filters.startDate = from;
      }
      filters.endDate = now;
    } else {
      if (req.query.start_date) filters.startDate = new Date(req.query.start_date);
      if (req.query.end_date)   filters.endDate   = new Date(req.query.end_date);
    }

    if (req.query.donation_type && req.query.donation_type !== 'ALL') {
      filters.donationType = req.query.donation_type;
    }
    if (req.query.tierId && req.query.tierId !== 'ALL') {
      const parsed = parseInt(req.query.tierId, 10);
      if (!isNaN(parsed)) filters.tierId = parsed;
    }

    const data = await buildAnalyticsData(filters);

    // Populate legacy arrays for backward compatibility when specific date boundaries are not requested
    if (!req.query.start_date && !req.query.end_date) {
      const now = new Date();
      const start3m = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const start6m = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      const start12m = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const start10y = new Date(now.getFullYear() - 9, 0, 1);

      const [res3m, res6m, res12m, res10y] = await Promise.all([
        buildAnalyticsData({ ...filters, startDate: start3m, endDate: now }),
        buildAnalyticsData({ ...filters, startDate: start6m, endDate: now }),
        buildAnalyticsData({ ...filters, startDate: start12m, endDate: now }),
        buildAnalyticsData({ ...filters, startDate: start10y, endDate: now })
      ]);

      data.weekly3m = res3m.series;
      data.biweekly6m = res6m.series;
      data.monthly = res12m.series;
      data.yearly = res10y.series;
    }

    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller to generate and download the donation trends chart as a vector SVG image.
 *
 * Why? Sandboxed Chrome downloads often fail to parse base64 canvas captures cleanly.
 * Serving a dynamically compiled vector SVG ensures high-fidelity downloads on all clients.
 * At the same time, we write a copy of the SVG to the local workspace root so administrators
 * can easily open it directly from their file manager.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function downloadDonationAnalytics(req, res, next) {
  try {
    const filters = {};
    const view = req.query.view || 'MONTHLY';

    if (view && !req.query.start_date && !req.query.end_date) {
      const now = new Date();
      if (view === 'MONTHLY_3') {
        const from = new Date(now);
        from.setMonth(from.getMonth() - 3);
        filters.startDate = from;
      } else if (view === 'MONTHLY_6') {
        const from = new Date(now);
        from.setMonth(from.getMonth() - 6);
        filters.startDate = from;
      } else if (view === 'YEARLY') {
        const from = new Date(now.getFullYear() - 9, 0, 1);
        filters.startDate = from;
      } else {
        const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        filters.startDate = from;
      }
      filters.endDate = now;
    } else {
      if (req.query.start_date) filters.startDate = new Date(req.query.start_date);
      if (req.query.end_date)   filters.endDate   = new Date(req.query.end_date);
    }

    if (req.query.donation_type && req.query.donation_type !== 'ALL') {
      filters.donationType = req.query.donation_type;
    }
    if (req.query.tierId && req.query.tierId !== 'ALL') {
      const parsed = parseInt(req.query.tierId, 10);
      if (!isNaN(parsed)) filters.tierId = parsed;
    }

    const { series, granularity } = await buildAnalyticsData(filters);

    const svgContent = generateSvgChart(series, view.toUpperCase());

    const workspaceRoot = path.resolve(process.cwd(), '..');
    const outputPath    = path.join(workspaceRoot, 'donation_chart.svg');
    try {
      fs.writeFileSync(outputPath, svgContent, 'utf-8');
    } catch {
      // Non-critical: file write failure should not abort the HTTP response.
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="donation_chart_${view.toLowerCase()}.svg"`);
    return res.status(200).send(svgContent);
  } catch (error) {
    next(error);
  }
}