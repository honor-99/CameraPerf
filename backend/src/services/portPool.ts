// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/** Port pool for trace_processor_shell instances. Stub restored after agent v1/v2 removal. */

interface PortEntry { port: number; allocatedAt: number }

let nextPort = 8090;
const allocated = new Map<string, PortEntry>();

function allocatePort(traceId: string): number {
  const port = nextPort++;
  allocated.set(traceId, { port, allocatedAt: Date.now() });
  return port;
}

function releasePort(traceId: string): void { allocated.delete(traceId); }

function getStats() {
  return {
    allocated: allocated.size,
    available: 100,
    total: 100,
    allocations: Array.from(allocated.entries(), ([traceId, info]) => ({
      traceId, port: info.port, allocatedAt: info.allocatedAt,
    })),
  };
}

export function getPortPool() {
  return {
    allocate: allocatePort,
    release: releasePort,
    getStats,
    blockPort(_port: number): void {},
    cleanupStale(_maxAgeMs?: number): void {},
  };
}

export type PortPool = ReturnType<typeof getPortPool>;
