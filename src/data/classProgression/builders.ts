import type { ClassSourceBook, ClassName } from "../../models/sheet/Class"
import type {
  ClassProgressionModule,
  ConfiguredLevelFeatureDefinition,
  SubclassProgressionModule,
} from "./types"

export type FeatureConfigurationInput = Omit<
  ConfiguredLevelFeatureDefinition,
  "id"
> & {
  /**
   * Prefer explicit stable IDs. When omitted, an ID is generated from the
   * original feature name and level for compatibility with the current data.
   */
  id?: string
}

export function defineFeature(
  input: FeatureConfigurationInput,
): ConfiguredLevelFeatureDefinition {
  return {
    ...input,
    id: input.id ?? createFeatureId(input.name, input.level),
  }
}

export function defineSubclass<TClassName extends ClassName>(
  input: SubclassProgressionModule<TClassName>,
): SubclassProgressionModule<TClassName> {
  return input
}

export function defineClassProgression<TClassName extends ClassName>(
  input: ClassProgressionModule<TClassName>,
): ClassProgressionModule<TClassName> {
  return input
}

export function createFeatureId(name: string, level: number): string {
  return `${slug(name)}-${level}`
}

export function createSubclassFeature(
  level: number,
  name: string,
  source: ClassSourceBook = "PHB",
  extra: Omit<Partial<ConfiguredLevelFeatureDefinition>, "level" | "name" | "source"> = {},
): ConfiguredLevelFeatureDefinition {
  return defineFeature({
    level,
    name,
    source,
    ...extra,
  })
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
