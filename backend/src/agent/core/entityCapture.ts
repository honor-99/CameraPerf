// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/**
 * Entity Capture Stub
 * Reduced from the full SmartPerfetto entityCapture module after agent v1/v2 removal.
 * The full module had complex dependency chains into agent context/strategies/types systems
 * that no longer exist in CameraPerf. This stub preserves the two entry points still used
 * by claudeRuntime.ts for entity context building.
 */

export interface CapturedEntities {
  frames: any[];
  sessions: any[];
  cpuSlices: any[];
  binders: any[];
  gcs: any[];
  memories: any[];
  generics: any[];
  candidateFrameIds: string[];
  candidateSessionIds: string[];
}

/**
 * Create an empty CapturedEntities object.
 */
export function createEmptyCapturedEntities(): CapturedEntities {
  return {
    frames: [],
    sessions: [],
    cpuSlices: [],
    binders: [],
    gcs: [],
    memories: [],
    generics: [],
    candidateFrameIds: [],
    candidateSessionIds: [],
  };
}

/**
 * Capture entities from agent responses.
 * Full implementation parsed scroll_session_analysis, get_app_jank_frames, etc.
 */
export function captureEntitiesFromResponses(responses: any[]): CapturedEntities {
  return createEmptyCapturedEntities();
}

/**
 * Apply captured entities into the entity store.
 */
export function applyCapturedEntities(entityStore: any, captured: CapturedEntities): void {
  // No-op stub — full implementation wrote back into EntityStore context
}
