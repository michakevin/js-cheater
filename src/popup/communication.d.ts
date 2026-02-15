export interface TabLike {
  id?: number;
  url?: string;
  [key: string]: unknown;
}

export interface TabsQueryInfo {
  active?: boolean;
  currentWindow?: boolean;
  [key: string]: unknown;
}

export interface SendOptions {
  suppressConnectionError?: boolean;
  suppressTimeoutError?: boolean;
}

export interface TimeoutResponse {
  timeout: true;
  error?: string;
}

export function setActiveTab(tabId: number | null | undefined): void;

export function queryTabs(queryInfo: TabsQueryInfo): Promise<TabLike[]>;

export function getActiveTab(): Promise<TabLike & { id: number }>;

export function sendTabMessage<TResponse = unknown>(
  tabId: number,
  message: Record<string, unknown>,
): Promise<TResponse>;

export function send<TResponse = unknown>(
  cmd: string,
  extra?: Record<string, unknown>,
  options?: SendOptions,
): Promise<TResponse | TimeoutResponse | null>;

export function checkScannerStatus(): Promise<boolean>;
