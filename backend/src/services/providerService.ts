// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/** Provider service stub — restored after agent v1/v2 removal. */
export function getProviderService() {
  return {
    list() {
      return [{
        id: 'default', name: 'Default Provider', type: 'llm' as const,
        models: { primary: 'claude-sonnet-4-6' },
        isActive: true,
      }];
    },
    getAvailableProviders() { return []; },
    getDefaultProvider() { return null; },
  };
}
