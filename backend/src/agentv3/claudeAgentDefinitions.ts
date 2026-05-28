// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

export interface ArchitectureInfo {
  type: 'NATIVE' | 'FLUTTER' | 'COMPOSE' | 'WEBVIEW' | 'UNKNOWN';
  confidence: number;
  evidence?: { source: string; type: string; weight: number }[];
  flutter?: { engine?: string; newThreadModel?: boolean; surfaceType?: string; versionHint?: string };
  compose?: { isHybridView?: boolean; hasRecomposition?: boolean; hasLazyLists?: boolean };
  webview?: { engine?: string; surfaceType?: string };
}

/** Tools that are orchestrator-only */
const ORCHESTRATOR_ONLY_TOOLS = new Set([
  'submit_plan', 'update_plan_phase', 'revise_plan',
  'submit_hypothesis', 'resolve_hypothesis', 'flag_uncertainty',
  'recall_patterns', 'compare_skill', 'execute_sql_on', 'get_comparison_context',
]);

function deriveSubAgentTools(allowedTools: string[]): string[] {
  return allowedTools.filter(t => {
    const shortName = t.replace(MCP_NAME_PREFIX, '');
    return !ORCHESTRATOR_ONLY_TOOLS.has(shortName);
  });
}

const MCP_NAME_PREFIX = 'mcp__camerapref__';

export interface SubAgentContext {
  architecture?: ArchitectureInfo;
  packageName?: string;
  allowedTools?: string[];
  subAgentModel?: AgentDefinition['model'];
}

export interface AgentDefinition {
  id: string;
  name: string;
  model?: string;
}

function buildArchitectureGuidance(ctx?: SubAgentContext): string {
  const lines: string[] = [];
  if (!ctx?.architecture) return '';
  lines.push(`Architecture: ${ctx.architecture.type}`);
  if (ctx.architecture.flutter?.engine) lines.push(`Flutter engine: ${ctx.architecture.flutter.engine}`);
  return lines.join('\n');
}

export function buildAgentDefinitions(ctx?: SubAgentContext): Record<string, any>;
export function buildAgentDefinitions(sceneType: string, ctx: SubAgentContext): Record<string, any>;
export function buildAgentDefinitions(_sceneTypeOrCtx?: string | SubAgentContext, _ctx?: SubAgentContext): Record<string, any> {
  return buildArchitectureGuidance(_ctx || (_sceneTypeOrCtx as SubAgentContext)) as any;
}
