// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/**
 * Session Context Manager Stub
 * Manages per-session state containers for analysis sessions.
 */

import { EventEmitter } from 'events';

interface SessionContext {
  sessionId: string;
  traceId: string;
  emitter: EventEmitter;
  [key: string]: any;

  getEntityStore(): any;
}

const sessions = new Map<string, SessionContext>();

function getOrCreate(sessionId: string, traceId: string): SessionContext {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      sessionId,
      traceId,
      emitter: new EventEmitter(),
      getEntityStore: () => ({}),
    });
  }
  return sessions.get(sessionId)!;
}

function get(sessionId: string): SessionContext | undefined {
  return sessions.get(sessionId);
}

function remove(sessionId: string): void {
  sessions.delete(sessionId);
}

export const sessionContextManager = { getOrCreate, get, remove };
export type { SessionContext };
