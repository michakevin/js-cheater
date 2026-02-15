export interface TabContextRefreshOptions {
  force?: boolean;
}

export interface TabContextControllerOptions {
  startConnectionMonitor: () => void;
  stopConnectionMonitor: () => void;
  isConnectionMonitorRunning: () => boolean;
}

export interface TabContextController {
  refreshVisibleTabContext(options?: TabContextRefreshOptions): Promise<void>;
  scheduleTabContextRefresh(options?: TabContextRefreshOptions): void;
  attachListeners(): void;
}

export function createTabContextController(
  options: TabContextControllerOptions,
): TabContextController;
