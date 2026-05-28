// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/**
 * Agent Types Stub
 * Redirects to the local agentv3/types.ts for the core types that were
 * previously in agent/types.ts. SessionSchema, claudeSseBridge, etc. all
 * reference types that are now defined locally in agentv3/types.ts.
 */

export type { Finding, StreamingUpdate, FindingReference } from '../agentv3/types';

/** Referenced entity type used by entityRegistry. */
export interface ReferencedEntity {
  type: 'frame' | 'session' | 'cpu_slice' | 'binder' | 'gc' | 'memory' | 'generic' | 'startup' | 'process' | 'binder_call' | 'time_range';
  [key: string]: any;
}
