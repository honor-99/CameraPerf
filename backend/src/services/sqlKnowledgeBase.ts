// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

export interface SqlKnowledgeBase {
  tables: any[];
  functions: any[];
  views: any[];
  getTableNames(): string[];
  getTableSchema(tableName: string): any;
  getFunctionsByCategory(): Record<string, any[]>;
  getFunctions(): any[];
  getIndexCategories(): string[];
  getIndexTemplatesByCategory(category: string): any[];
  smartMatch(query: string): any[];
  getRecommendedQueries(moduleName: string): any[];
  loadFullTemplate(templateId: string): any;
  getContextForAI(query?: string, maxResults?: number): string;
  getIndexStats(): any;
}

export interface PerfettoSqlTemplate {
  name: string;
  sql: string;
  params: string[];
  description: string;
}

export function createKnowledgeBase(): SqlKnowledgeBase {
  return {
    tables: [],
    functions: [],
    views: [],
    getTableNames: () => [],
    getTableSchema: () => ({}),
    getFunctionsByCategory: () => ({}),
    getFunctions: () => [],
    getIndexCategories: () => [],
    getIndexTemplatesByCategory: () => [],
    smartMatch: () => [],
    getRecommendedQueries: () => [],
    loadFullTemplate: () => ({}),
    getContextForAI: () => '',
    getIndexStats: () => ({}),
  };
}

export function getExtendedKnowledgeBase(): Promise<SqlKnowledgeBase> {
  return Promise.resolve(createKnowledgeBase());
}

export const PERFETTO_SQL_TEMPLATES: Record<string, PerfettoSqlTemplate> = {};
