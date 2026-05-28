// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/**
 * Orchestrator Types Stub
 * Reduced from the full SmartPerfetto orchestratorTypes module after agent v1/v2 removal.
 */

import type { SelectionContext } from '../../agentv3/types';

export interface AnalysisOptions {
  packageName?: string;
  providerId?: string;
  analysisMode?: 'auto' | 'quick' | 'full';
  selectionContext?: SelectionContext;
  traceContext?: string[];
  referenceTraceId?: string;
  [key: string]: any;
}

export type AnalysisTerminationReason =
  | 'completed' | 'max_turns' | 'max_turns_reached' | 'timeout'
  | 'sdk_error' | 'execution_error' | 'cancelled' | 'degraded';

export interface AnalysisResult {
  traceId: string;
  sessionId?: string;
  status: 'completed' | 'failed' | 'timed_out' | 'cancelled';
  finalResult?: string;
  success?: boolean;
  findings?: any[];
  hypotheses?: any[];
  conclusion?: string;
  confidence?: number;
  rounds?: number;
  totalDurationMs?: number;
  partial?: boolean;
  terminationReason: AnalysisTerminationReason;
  terminationMessage?: string;
  error?: string;
  [key: string]: any;
}

export interface ProtocolHypothesis {
  id: string;
  statement: string;
  status: 'proposed' | 'confirmed' | 'rejected';
  confidence?: number;
  evidence?: string;
  description?: string;
  [key: string]: any;
}

export interface IOrchestrator {
  analyze(traceId: string, query: string, options?: any): Promise<any>;
  emitUpdate(update: any): void;
}

export interface TraceDataset {
  traceId: string;
  traceName: string;
  [key: string]: any;
}
