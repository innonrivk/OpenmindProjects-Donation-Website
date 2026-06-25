import prisma from '../../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import { generateSvgChart } from '../../utils/chartSvgGenerator.js';

/**
 * Aggregates monthly (last 12 months) and yearly (last 10 years) donations.
 *
 * Why? SQLite lacks built-in advanced date grouping or month-filling operations,
 * so we fetch the raw aggregated sums grouped by period and is_recurring,
 * and then programmatically fill in missing months/years in Javascript.
 * Amounts are converted to USD at this layer to streamline client ingestion.
 *
 * @returns {Promise<{monthly: Array<{period: string, monthly: number, oneTime: number}>, yearly: Array<{period: string, monthly: number, oneTime: number}>}>} The zero-filled aggregated data.
 */
async function buildAnalyticsData() {
  const now = new Date();

  // 1. Calculate Monthly Cutoff and Periods (Last 12 Months)
  const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const monthlyPeriods = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    monthlyPeriods.push(`${year}-${month}`);
  }

  // 2. Calculate Yearly Cutoff and Periods (Last 10 Years)
  const startYear = new Date(now.getFullYear() - 9, 0, 1);
  const yearlyPeriods = [];
  for (let i = 9; i >= 0; i--) {
    yearlyPeriods.push(String(now.getFullYear() - i));
  }

  // 3. Query database
  // Note: created_at / 1000 is used because SQLite stores timestamps in milliseconds
  const [monthlyRaw, yearlyRaw] = await Promise.all([
    prisma.$queryRaw`
      SELECT 
        strftime('%Y-%m', created_at / 1000, 'unixepoch') as period, 
        is_recurring as isRecurring,
        SUM(amount) as total
      FROM transactions 
      WHERE status = 'SUCCEEDED' AND created_at >= ${startMonth}
      GROUP BY period, is_recurring
    `,
    prisma.$queryRaw`
      SELECT 
        strftime('%Y', created_at / 1000, 'unixepoch') as period, 
        is_recurring as isRecurring,
        SUM(amount) as total
      FROM transactions 
      WHERE status = 'SUCCEEDED' AND created_at >= ${startYear}
      GROUP BY period, is_recurring
    `
  ]);

  // 4. Process Monthly Data
  const monthlyMap = {};
  for (const row of (monthlyRaw || [])) {
    const period = row.period;
    if (!period) continue;
    if (!monthlyMap[period]) {
      monthlyMap[period] = { monthly: 0, oneTime: 0 };
    }
    const amountUsd = Number(row.total) / 100;
    if (row.isRecurring === 1 || row.isRecurring === true) {
      monthlyMap[period].monthly += amountUsd;
    } else {
      monthlyMap[period].oneTime += amountUsd;
    }
  }

  const monthly = monthlyPeriods.map(p => ({
    period: p,
    monthly: monthlyMap[p]?.monthly || 0,
    oneTime: monthlyMap[p]?.oneTime || 0
  }));

  // 5. Process Yearly Data
  const yearlyMap = {};
  for (const row of (yearlyRaw || [])) {
    const period = row.period;
    if (!period) continue;
    if (!yearlyMap[period]) {
      yearlyMap[period] = { monthly: 0, oneTime: 0 };
    }
    const amountUsd = Number(row.total) / 100;
    if (row.isRecurring === 1 || row.isRecurring === true) {
      yearlyMap[period].monthly += amountUsd;
    } else {
      yearlyMap[period].oneTime += amountUsd;
    }
  }

  const yearly = yearlyPeriods.map(p => ({
    period: p,
    monthly: yearlyMap[p]?.monthly || 0,
    oneTime: yearlyMap[p]?.oneTime || 0
  }));

  return { monthly, yearly };
}

/**
 * Controller to retrieve donation analytics for chart rendering.
 *
 * Why? Provides the structured JSON payload containing both monthly (12m)
 * and yearly (10y) aggregated series so the dashboard can load them in a single query.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function getDonationAnalytics(req, res, next) {
  try {
    const data = await buildAnalyticsData();
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
    const view = req.query.view === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
    const data = await buildAnalyticsData();
    const activeSeries = view === 'MONTHLY' ? data.monthly : data.yearly;

    const svgContent = generateSvgChart(activeSeries, view);

    // Save a copy directly to the workspace root for local fallback
    try {
      const filename = `donation_chart_${view.toLowerCase()}.svg`;
      let localPath = path.join(process.cwd(), filename);
      if (process.cwd().endsWith('server') || process.cwd().endsWith('server\\') || process.cwd().endsWith('server/')) {
        localPath = path.join(process.cwd(), '..', filename);
      }
      fs.writeFileSync(localPath, svgContent, 'utf8');
    } catch (fsErr) {
      // Fail-silent for writing local file, we must still return the HTTP response
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="donation_chart_${view.toLowerCase()}_${Date.now()}.svg"`
    );
    return res.status(200).send(svgContent);
  } catch (error) {
    next(error);
  }
}
