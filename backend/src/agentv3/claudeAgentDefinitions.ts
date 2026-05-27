// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/**
 * Sub-agent definitions for Claude Agent SDK.
 * Each sub-agent runs in an isolated context window, collecting domain-specific
 * evidence without polluting the orchestrator's context.
 *
 * Design principle: sub-agents collect evidence, orchestrator makes final diagnosis.
 */

import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import type { SceneType } from './sceneClassifier';
import { MCP_NAME_PREFIX } from './claudeMcpServer';

// CameraPerf: inline ArchitectureInfo since agent/detectors was removed
export interface ArchitectureInfo {
  type: 'NATIVE' | 'FLUTTER' | 'COMPOSE' | 'WEBVIEW' | 'UNKNOWN';
  confidence: number;
  flutter?: { engine?: string; newThreadModel?: boolean };
  compose?: { isHybridView?: boolean };
  webview?: { engine?: string };
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

export interface SubAgentContext {
  architecture?: ArchitectureInfo;
  packageName?: string;
  allowedTools?: string[];
  subAgentModel?: AgentDefinition['model'];
}

function buildArchitectureGuidance(ctx?: SubAgentContext): string {
  const lines: string[] = [];
  if (ctx?.packageName) {
    lines.push(`- **目标包名**: \`${ctx.packageName}\`，调用 invoke_skill 时使用 process_name="${ctx.packageName}"`);
  }
  if (!ctx?.architecture) return lines.length > 0 ? `\n## 当前 Trace 信息\n${lines.join('\n')}` : '';
  const arch = ctx.architecture;
  lines.push(`- **渲染架构**: ${arch.type} (置信度 ${(arch.confidence * 100).toFixed(0)}%)`);
  if (arch.type === 'FLUTTER') {
    lines.push(`- **Flutter 引擎**: ${arch.flutter?.engine || 'unknown'}`);
    lines.push(`- **关键 Slice**: 看 \`GPURasterizer::Draw\` (帧 GPU 耗时)`);
  } else if (arch.type === 'COMPOSE') {
    lines.push(`- **Compose**: 关注 \`Recomposer:recompose\` slice`);
  } else if (arch.type === 'WEBVIEW') {
    lines.push(`- **WebView**: 引擎=${arch.webview?.engine || 'Chromium'}`);
  }
  return `\n## 当前 Trace 架构\n${lines.join('\n')}`;
}

function buildFrameExpert(subAgentTools: string[], ctx?: SubAgentContext): AgentDefinition {
  const archGuidance = buildArchitectureGuidance(ctx);
  return {
    description: 'Frame rendering and jank diagnosis expert. Use for frame timeline, jank root causes, rendering pipeline.',
    prompt: `你是帧渲染与掉帧诊断专家。收集帧级别的证据数据。
${archGuidance}

## 职责范围
- 帧渲染管线分析（MainThread → RenderThread → SurfaceFlinger）
- 掉帧/卡顿检测与根因分类
- VSync 对齐, GPU 渲染, SurfaceFlinger 合成

## 工具使用
- 优先使用 invoke_skill：scrolling_analysis, jank_frame_detail, consumer_jank_detection
- GPU: gpu_analysis, gpu_metrics; SF: surfaceflinger_analysis, sf_frame_consumption

## 输出要求
- **只收集证据，不做最终诊断**
- 使用中文输出，标注严重程度 [CRITICAL]/[HIGH]/[MEDIUM]/[LOW]/[INFO]`,
    tools: subAgentTools,
    model: ctx?.subAgentModel ?? 'sonnet',
    maxTurns: 8,
  };
}

function buildSystemExpert(subAgentTools: string[], ctx?: SubAgentContext): AgentDefinition {
  const archGuidance = buildArchitectureGuidance(ctx);
  return {
    description: 'System-level performance expert. CPU scheduling, memory/GC, Binder IPC, thermal throttling.',
    prompt: `你是系统级性能分析专家。收集系统层面的证据数据。
${archGuidance}

## 职责范围
- CPU 调度与频率, 内存分析, Binder IPC, 内核调度, 热管理与降频

## 工具使用
- 优先使用 invoke_skill：cpu_analysis, memory_analysis, binder_analysis
- 热降频: thermal_throttling

## 输出要求
- **只收集证据，不做最终诊断**
- 使用中文输出，标注严重程度`,
    tools: subAgentTools,
    model: ctx?.subAgentModel ?? 'sonnet',
    maxTurns: 8,
  };
}

function buildStartupExpert(subAgentTools: string[], ctx?: SubAgentContext): AgentDefinition {
  const archGuidance = buildArchitectureGuidance(ctx);
  return {
    description: 'App startup analysis expert. Cold/warm/hot start, TTID/TTFD measurement.',
    prompt: `你是应用启动分析专家。收集启动过程的证据数据。
${archGuidance}

## 职责范围
- 冷启动/温启动/热启动阶段分解, TTID/TTFD 测量, 启动阻塞因素定位

## 工具使用
- 优先使用 invoke_skill：startup_analysis, startup_detail
- **不要** 调用 cpu_analysis, binder_analysis 等（由 system-expert 负责）

## 输出要求
- **只收集证据，不做最终诊断**
- 使用中文输出，标注严重程度`,
    tools: subAgentTools,
    model: ctx?.subAgentModel ?? 'sonnet',
    maxTurns: 8,
  };
}

/** Build agent definitions based on scene type. */
export function buildAgentDefinitions(
  sceneType: SceneType,
  ctx?: SubAgentContext,
): Record<string, AgentDefinition> {
  const subAgentTools = ctx?.allowedTools ? deriveSubAgentTools(ctx.allowedTools) : [];
  const agents: Record<string, AgentDefinition> = {};

  switch (sceneType) {
    case 'scrolling':
      agents['frame-expert'] = buildFrameExpert(subAgentTools, ctx);
      agents['system-expert'] = buildSystemExpert(subAgentTools, ctx);
      break;
    case 'startup':
      agents['startup-expert'] = buildStartupExpert(subAgentTools, ctx);
      agents['system-expert'] = buildSystemExpert(subAgentTools, ctx);
      break;
    case 'general':
    default:
      agents['frame-expert'] = buildFrameExpert(subAgentTools, ctx);
      agents['system-expert'] = buildSystemExpert(subAgentTools, ctx);
      break;
  }

  return agents;
}
