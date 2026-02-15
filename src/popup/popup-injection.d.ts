export interface StartPollingOptions {
  showInstructions?: boolean;
  timeoutMessage?: string;
}

export interface ConfigureSetupModeOptions {
  directScannerInjection: boolean;
}

export interface CreateInjectHandlerOptions {
  directScannerInjection: boolean;
  startPolling: (options?: StartPollingOptions) => void;
}

export function shouldInjectScannerDirectly(): boolean;

export function configureSetupMode(options: ConfigureSetupModeOptions): void;

export function createInjectHandler(
  options: CreateInjectHandlerOptions,
): () => Promise<void>;
