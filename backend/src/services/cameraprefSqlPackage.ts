// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/**
 * CameraPerf PerfettoSQL Package Loader (Spark Plan 03)
 *
 * Reads `backend/sql/camerapref/PACKAGE.json` plus the per-module
 * `.sql` files and returns a `CameraPerfSqlPackageContract` that the
 * runtime (workingTraceProcessor / claudeMcpServer) can boot via
 * `INCLUDE PERFETTO MODULE camerapref.*` once trace_processor_shell
 * supports add-sql-package on the http path.
 *
 * Until the boot path lands, callers can still issue the SQL directly via
 * existing `execute_sql` for parity, and the contract gives docs / agent
 * prompts a single source of truth for the canonical symbol names.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  makeSparkProvenance,
  type CameraPerfSqlPackageContract,
  type CameraPerfSqlSymbol,
  type CameraPerfSqlSymbolKind,
} from '../types/sparkContracts';

interface PackageManifest {
  packageVersion: string;
  symbols: Array<{
    name: string;
    /** Optional override; when missing, derived by replacing dots with underscores. */
    sqlName?: string;
    kind: CameraPerfSqlSymbolKind;
    module: string;
    summary?: string;
    signature?: string;
    dependencies?: string[];
    stability?: 'experimental' | 'stable' | 'deprecated';
  }>;
}

/**
 * Derive the actual SQL identifier from the dotted docs path. Perfetto
 * SQL identifiers cannot contain dots, so we mirror the stdlib convention
 * of underscore-separated names. Manifest entries can override via the
 * explicit `sqlName` field.
 */
function deriveSqlName(name: string): string {
  return name.replace(/\./g, '_');
}

/** Default location for the CameraPerf SQL package directory. */
export function getDefaultCameraPerfSqlPackageDir(): string {
  return path.resolve(__dirname, '../../sql/camerapref');
}

/** Read PACKAGE.json + verify all referenced .sql files exist. */
export function loadCameraPerfSqlPackage(
  packageDir: string = getDefaultCameraPerfSqlPackageDir(),
): CameraPerfSqlPackageContract {
  const manifestPath = path.join(packageDir, 'PACKAGE.json');
  if (!fs.existsSync(manifestPath)) {
    return {
      ...makeSparkProvenance({
        source: 'camerapref-sql-package',
        unsupportedReason: `PACKAGE.json not found at ${manifestPath}`,
      }),
      packageVersion: '0.0.0',
      symbols: [],
      coverage: [
        {sparkId: 3, planId: '03', status: 'unsupported'},
        {sparkId: 36, planId: '03', status: 'unsupported'},
      ],
    };
  }

  let manifest: PackageManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PackageManifest;
  } catch (err: any) {
    return {
      ...makeSparkProvenance({
        source: 'camerapref-sql-package',
        unsupportedReason: `Failed to parse PACKAGE.json: ${err?.message ?? String(err)}`,
      }),
      packageVersion: '0.0.0',
      symbols: [],
      coverage: [{sparkId: 3, planId: '03', status: 'unsupported'}],
    };
  }

  const symbols: CameraPerfSqlSymbol[] = [];
  const removed: CameraPerfSqlSymbol[] = [];
  for (const declared of manifest.symbols ?? []) {
    const sqlName = declared.sqlName ?? deriveSqlName(declared.name);
    const sqlPath = path.join(packageDir, declared.module);
    if (!fs.existsSync(sqlPath)) {
      removed.push({
        name: declared.name,
        sqlName,
        kind: declared.kind,
        module: declared.module,
        summary: declared.summary,
        signature: declared.signature,
        dependencies: declared.dependencies,
        stability: 'deprecated',
      });
      continue;
    }
    symbols.push({
      name: declared.name,
      sqlName,
      kind: declared.kind,
      module: declared.module,
      summary: declared.summary,
      signature: declared.signature,
      dependencies: declared.dependencies,
      stability: declared.stability ?? 'experimental',
    });
  }

  return {
    ...makeSparkProvenance({source: 'camerapref-sql-package'}),
    packageVersion: manifest.packageVersion,
    symbols,
    ...(removed.length > 0 ? {removed} : {}),
    bootSnippet:
      'INCLUDE PERFETTO MODULE camerapref.*; -- pending trace_processor add-sql-package support',
    coverage: [
      {
        sparkId: 3,
        planId: '03',
        status: 'implemented',
        note: `${symbols.length} CameraPerf SQL symbols available.`,
      },
      {
        sparkId: 36,
        planId: '03',
        status: 'implemented',
        note: 'Boot snippet recorded; runtime activation lands once trace_processor_shell exposes add-sql-package over httpd.',
      },
    ],
  };
}

/** Return the raw SQL source for a registered symbol, or null. */
export function readCameraPerfSqlSymbol(
  symbolName: string,
  packageDir: string = getDefaultCameraPerfSqlPackageDir(),
): {module: string; sql: string} | null {
  const contract = loadCameraPerfSqlPackage(packageDir);
  const symbol = contract.symbols.find(s => s.name === symbolName);
  if (!symbol) return null;
  const filePath = path.join(packageDir, symbol.module);
  if (!fs.existsSync(filePath)) return null;
  return {
    module: symbol.module,
    sql: fs.readFileSync(filePath, 'utf-8'),
  };
}
