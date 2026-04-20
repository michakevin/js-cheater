export function readTabIdFromLocation(): number | null;
export function createTabSender(
  getTabId: () => number | null,
  missingTabMessage?: string,
): (cmd: string, extra?: Record<string, unknown>) => Promise<unknown>;
