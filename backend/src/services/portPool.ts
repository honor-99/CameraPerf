export function getPortPool() {
  const allocated = new Map<string, { port: number; allocatedAt: number }>();
  let nextPort = 8090;
  return {
    allocate(traceId: string): number {
      const port = nextPort++; 
      allocated.set(traceId, { port, allocatedAt: Date.now() }); 
      return port;
    },
    release(traceId: string): void { allocated.delete(traceId); },
    blockPort(_port: number): void {},
    getStats() {
      const allocs = Array.from(allocated.entries()).map(([traceId, info]) => ({
        traceId, port: info.port, allocatedAt: info.allocatedAt,
      }));
      return { allocated: allocated.size, available: 100, total: 100, allocations: allocs };
    },
    cleanupStale(_maxAgeMs?: number): void {},
  };
}
export type PortPool = ReturnType<typeof getPortPool>;
