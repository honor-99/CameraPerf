// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/** Prompt template service stub — restored after agent v1/v2 removal. */
export class PromptTemplateService {
  private static instance: PromptTemplateService;

  static getInstance(): PromptTemplateService {
    if (!PromptTemplateService.instance) {
      PromptTemplateService.instance = new PromptTemplateService();
    }
    return PromptTemplateService.instance;
  }

  getTemplate(_name: string): string { return ''; }
  formatTemplate(_template: string, _vars?: Record<string, string>): string { return ''; }
}
