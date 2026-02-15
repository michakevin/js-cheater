export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export function $<T extends Element = Element>(sel: string): T | null;

export function tryParse(v: string): JsonValue | string;

export function escapeHtml(str?: string): string;

export function safeStringify(value: unknown): string;
