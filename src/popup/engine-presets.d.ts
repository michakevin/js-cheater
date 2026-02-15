export type EngineSearchType = "value" | "name" | "nameAndValue";

export interface EnginePresetItem {
  label: string;
  category: string;
  path?: string;
  searchType?: EngineSearchType;
  searchName?: string;
  searchValue?: string;
}

export interface EnginePresetDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  presets: EnginePresetItem[];
}

export const ENGINE_PRESETS: EnginePresetDefinition[];

export function getPresetsForEngine(
  engineId: string,
): EnginePresetDefinition | undefined;
