import type {
  ClassProgressionDefinition,
  LevelFeatureDefinition,
  SubclassDefinition,
} from "../../models/leveling/ClassProgression"
import type { ClassName } from "../../models/sheet/Class"
import type {
  ClassProgressionModule,
  SubclassProgressionModule,
} from "./types"

export function applyClassProgressionModules(
  progressions: Record<ClassName, ClassProgressionDefinition>,
  modules: readonly ClassProgressionModule[],
): void {
  for (const module of modules) {
    const current = progressions[module.className]
    if (!current) continue

    if (module.definition) {
      Object.assign(current, module.definition)
    }

    if (module.features) {
      current.features =
        module.featureMergeMode === "replace"
          ? [...module.features]
          : mergeFeatures(current.features, module.features)
    }

    if (module.subclasses) {
      current.subclasses =
        module.subclassMergeMode === "replace"
          ? module.subclasses.map(toSubclassDefinition)
          : mergeSubclasses(current.subclasses, module.subclasses)
    }
  }
}

function mergeFeatures(
  current: LevelFeatureDefinition[],
  additions: LevelFeatureDefinition[],
): LevelFeatureDefinition[] {
  const byId = new Map(current.map((feature) => [feature.id, feature]))
  for (const feature of additions) byId.set(feature.id, feature)
  return Array.from(byId.values()).toSorted(compareFeatures)
}

function mergeSubclasses(
  current: SubclassDefinition[],
  additions: readonly SubclassProgressionModule[],
): SubclassDefinition[] {
  const byId = new Map(current.map((subclass) => [subclass.id, subclass]))

  for (const addition of additions) {
    const existing = byId.get(addition.id)
    if (!existing || addition.mergeMode === "replace") {
      byId.set(addition.id, toSubclassDefinition(addition))
      continue
    }

    byId.set(addition.id, {
      ...existing,
      name: addition.name,
      source: addition.source,
      features: mergeFeatures(existing.features, addition.features),
    })
  }

  return Array.from(byId.values())
}

function toSubclassDefinition(
  module: SubclassProgressionModule,
): SubclassDefinition {
  return {
    id: module.id,
    name: module.name,
    className: module.className,
    source: module.source,
    features: [...module.features].toSorted(compareFeatures),
  }
}

function compareFeatures(
  left: LevelFeatureDefinition,
  right: LevelFeatureDefinition,
): number {
  return left.level - right.level || left.id.localeCompare(right.id)
}
