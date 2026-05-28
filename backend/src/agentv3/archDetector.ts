// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/**
 * Architecture Detector Stub
 * Detects the rendering architecture (Native/Flutter/Compose/WebView) of an Android app.
 * Full implementation probed AndroidManifest, flutter_engine_version, etc.
 */

import type { ArchitectureInfo } from './claudeAgentDefinitions';

export interface ArchitectureDetectorInput {
  traceId: string;
  traceProcessorService: any;
  packageName?: string;
}

export function createArchitectureDetector() {
  return {
    async detect(input: ArchitectureDetectorInput): Promise<ArchitectureInfo> {
      return {
        type: 'UNKNOWN',
        confidence: 0,
      };
    },
  };
}
