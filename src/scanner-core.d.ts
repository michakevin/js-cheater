export type ScannerPropertyKey = string | number | symbol;
export type ScannerRecord = Record<ScannerPropertyKey, unknown>;

export interface ScannerHit {
  obj: ScannerRecord;
  key: string;
  path: string;
}

export interface ScannerListEntry {
  path: string;
  value: unknown;
}

export interface ScannerEngineDetection {
  id: string;
  name: string;
}

export type ScannerPredicate = (value: unknown, key: string) => boolean;

export interface ScannerTraversalState {
  hitCount: number;
}

export interface ScannerTraversalOptions {
  includeNonEnumerableKeys?: boolean;
  maxKeysPerObject?: number;
  keyHint?: string;
  priorityPatterns?: string[];
  startTime?: number;
  maxTime?: number;
  allowGetters?: boolean;
  traversalState?: ScannerTraversalState;
  maxHits?: number;
}

export interface ScannerActionSuccess {
  success: true;
}

export interface ScannerActionFailure {
  success: false;
  error: string;
}

export type ScannerActionResult = ScannerActionSuccess | ScannerActionFailure;

export interface ScannerPokeByPathSuccess {
  success: true;
  oldValue: unknown;
  newValue: unknown;
}

export type ScannerPokeByPathResult =
  | ScannerPokeByPathSuccess
  | ScannerActionFailure;

export type ScannerReadPathResult = { value: unknown } | { error: string };

export interface ScannerTestResult {
  scannerLoaded: true;
  gameScore: unknown;
  hitCount: number;
  windowVars: string[];
}

export interface ScannerRuntime {
  hits: ScannerHit[];
  shouldAvoidGetterEvaluation(): boolean;
  collectKeys(root: object, opts?: ScannerTraversalOptions): string[];
  findAll(
    root: unknown,
    predicate: ScannerPredicate,
    seen?: WeakSet<object>,
    path?: string,
    maxDepth?: number,
    opts?: ScannerTraversalOptions,
  ): ScannerHit[];
  scan(value: unknown): number;
  refine(value: unknown): number;
  scanByName(name: string): number;
  refineByName(name: string): number;
  scanByNameAndValue(name: string, value: unknown): number;
  refineByNameAndValue(name: string, value: unknown): number;
  list(): ScannerListEntry[];
  poke(idx: number, value: unknown): boolean;
  pokeByPath(path: string, value: unknown): ScannerPokeByPathResult;
  frozen: Map<string, { timer: ReturnType<typeof setInterval> }>;
  freezeByPath(path: string, value: unknown): ScannerActionResult;
  unfreezeByPath(path: string): ScannerActionResult;
  showHits(): void;
  detectEngine(): ScannerEngineDetection | null;
  readPath(path: string): ScannerReadPathResult;
  test(): ScannerTestResult;
}

export function createScanner(DEBUG?: boolean): ScannerRuntime;
