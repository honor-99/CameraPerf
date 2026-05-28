// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/** EntityStore snapshot stub — used by sessionSchema for cross-restart persistence. */
export interface EntityStoreSnapshot {
  [key: string]: any;
}
