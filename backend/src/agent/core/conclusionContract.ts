// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

export interface ConclusionContract {
  traceId: string;
  sessionId: string;
  findings: string[];
  hypothesis: string;
}
