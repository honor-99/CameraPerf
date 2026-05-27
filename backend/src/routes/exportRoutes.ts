// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/**
 * Export Routes — simple JSON/CSV export (no external service dependency)
 */

import { Router } from 'express';

const router = Router();

// Simple CSV encoder
function toCSV(rows: any[], columns: string[]): string {
  const header = columns.map(c => `"${c}"`).join(',');
  const body = rows.map(row => columns.map(c => {
    const v = row[c];
    if (v === null || v === undefined) return 'NULL';
    return `"${String(v).replace(/"/g, '""')}"`;
  }).join(','));
  return [header, ...body].join('\n');
}

/**
 * POST /api/export/result
 */
router.post('/result', async (req, res) => {
  try {
    const { result, format = 'json' } = req.body;

    if (format !== 'csv' && format !== 'json') {
      return res.status(400).json({ success: false, error: 'Invalid format. Must be "csv" or "json"' });
    }
    if (!result || !Array.isArray(result.columns) || !Array.isArray(result.rows)) {
      return res.status(400).json({ success: false, error: 'Invalid result data.' });
    }

    if (format === 'csv') {
      const csv = toCSV(result.rows, result.columns);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="export.json"');
      res.send(JSON.stringify(result, null, 2));
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Export failed' });
  }
});

/**
 * GET /api/export/formats
 */
router.get('/formats', (_req, res) => {
  res.json({
    success: true,
    formats: [
      { name: 'json', mimeType: 'application/json', description: 'JSON format' },
      { name: 'csv', mimeType: 'text/csv', description: 'CSV format (RFC 4180)' },
    ],
  });
});

export default router;
