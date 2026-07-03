import ExcelJS from 'exceljs';
import prisma from '../../lib/prisma.js';
import { buildTransactionWhere } from '../../lib/buildTransactionWhere.js';

/**
 * Controller to handle unpaginated, formatted Excel exports of transaction ledger lists.
 *
 * Why? Bufferless streaming of generated reports prevents memory spikes on large datasets.
 * It applies identical query filters to match user selections, embeds filter metadata
 * directly inside the spreadsheet, adds safety row limits to prevent server stress, and
 * uses custom headers to notify clients if limits have been triggered.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
export async function exportTransactions(req, res, next) {
  try {
    const query = req.query;

    // Build matching query parameters
    const where = await buildTransactionWhere(query);

    // Fetch dynamic tier name for filter metadata display
    let tierName = 'All Tiers';
    if (query.tierId && query.tierId !== 'ALL') {
      const tierIdParsed = parseInt(query.tierId, 10);
      if (!isNaN(tierIdParsed)) {
        const tier = await prisma.tier.findUnique({ where: { id: tierIdParsed } });
        if (tier) {
          tierName = tier.name;
        }
      }
    }

    const exportLimit = 10000;

    // Fetch transactions matching filters up to the hard cap
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: exportLimit,
    });

    // Check if hard cap limit has been reached
    if (transactions.length >= exportLimit) {
      res.setHeader('X-Export-Limit-Hit', 'true');
    }

    // Initialize Excel Workbook and Sheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Transactions Log');

    // 1. Report Title Block
    worksheet.getCell('A1').value = 'OpenmindProjects — Transaction Ledger Report';
    worksheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E293B' } };

    worksheet.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
    worksheet.getCell('A2').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };

    // Format display filters string
    const filterStrings = [];
    if (query.start_date || query.end_date) {
      const startStr = query.start_date ? new Date(query.start_date).toLocaleDateString() : 'Beginning';
      const endStr = query.end_date ? new Date(query.end_date).toLocaleDateString() : 'End';
      filterStrings.push(`Date Range: ${startStr} to ${endStr}`);
    } else {
      filterStrings.push('Date Range: All Time');
    }

    const typeLabel =
      query.donation_type === 'MONTHLY'
        ? 'Monthly'
        : query.donation_type === 'ONE_TIME'
        ? 'One-Time'
        : 'All Types';
    filterStrings.push(`Donation Type: ${typeLabel}`);
    filterStrings.push(`Tier: ${tierName}`);

    worksheet.getCell('A3').value = `Filters Applied: ${filterStrings.join(' | ')}`;
    worksheet.getCell('A3').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };

    // 2. Setup Headers
    const headerRow = worksheet.getRow(5);
    headerRow.values = [
      'Invoice / Payment ID',
      'Date',
      'Donor Name',
      'Email',
      'Amount',
      'Status',
      'Type',
      'Subject',
    ];
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.height = 25;

    // Set Column widths & alignment rules
    const columnWidths = [30, 15, 25, 30, 15, 12, 12, 30];
    columnWidths.forEach((width, index) => {
      const col = worksheet.getColumn(index + 1);
      col.width = width;
      if (index === 4) {
        // Amount alignment (right-aligned for financial readability)
        col.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (index === 1 || index === 5 || index === 6) {
        // Center alignment for code / tags / statuses
        col.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        // Left alignment for text fields
        col.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    // Freeze header row and metadata rows (freeze rows 1-5)
    worksheet.views = [{ state: 'frozen', ySplit: 5 }];

    // 3. Fill transaction data rows
    let totalCents = 0;
    transactions.forEach((tx, idx) => {
      const donorName = tx.user
        ? `${tx.user.firstName || ''} ${tx.user.lastName || ''}`.trim()
        : 'Anonymous';
      const email = tx.user ? tx.user.email : '';
      const dateStr = tx.createdAt ? new Date(tx.createdAt).toISOString().split('T')[0] : '';
      const amountUsd = tx.amount / 100;
      totalCents += tx.amount;

      const dataRow = worksheet.addRow([
        tx.id,
        dateStr,
        donorName,
        email,
        amountUsd,
        tx.status,
        tx.isRecurring ? 'Monthly' : 'One-Time',
        tx.subject || 'Donation',
      ]);

      // Alternating row styling (zebra pattern)
      if (idx % 2 === 1) {
        dataRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      dataRow.getCell(5).numFmt = '$#,##0.00';
      dataRow.font = { name: 'Arial', size: 10 };
      dataRow.height = 20;
    });

    // 4. Add Summary Sum Row
    worksheet.addRow([]); // Blank spacer row
    const totalRow = worksheet.addRow([
      'TOTAL SUM',
      '',
      '',
      '',
      totalCents / 100,
      '',
      '',
      '',
    ]);
    totalRow.font = { name: 'Arial', size: 11, bold: true };
    totalRow.getCell(5).numFmt = '$#,##0.00';

    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'double' },
      };
      cell.alignment = cell.alignment || {};
      cell.alignment.vertical = 'middle';
    });

    // Set Response headers for dynamic file streaming
    const cleanDonationType = typeLabel.replace(/\s+/g, '-');
    const cleanTier = tierName.replace(/\s+/g, '-');
    const dateRangeStr = query.start_date || query.end_date
      ? `${query.start_date ? query.start_date.split('T')[0] : 'Start'}_to_${query.end_date ? query.end_date.split('T')[0] : 'End'}`
      : 'AllTime';

    const timestamp = Date.now();
    const filename = `Transactions_${cleanDonationType}_${cleanTier}_${dateRangeStr}_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'X-Export-Limit-Hit');

    const buffer = await workbook.xlsx.writeBuffer();
    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}
