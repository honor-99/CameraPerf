export function getProviderService() {
  return {
    list: () => [{
      id: 'default', name: 'Default Provider', type: 'llm' as const,
      models: { primary: 'claude-sonnet-4-6' },
      isActive: true,
    }],
    getAvailableProviders: () => [],
    getDefaultProvider: () => null,
  };
}
