import type { ClassName } from "../../models/sheet/Class"
import { defineClassProgression } from "./builders"
import { CLASS_PROGRESSIONS } from "./catalog/ClassProgression"
import { XANATHAR_SUBCLASSES } from "./catalog/XanatharSubclasses"
import type {
  ClassProgressionModule,
  SubclassProgressionModule,
} from "./types"

/**
 * Converts one class from the migrated aggregate catalog into the modular
 * class-progression shape. The resulting module is authoritative for the
 * class definition, features, and subclasses.
 */
export function defineCatalogClassProgression<
  TClassName extends ClassName,
>(className: TClassName): ClassProgressionModule<TClassName> {
  const progression = CLASS_PROGRESSIONS[className]
  const subclasses = new Map<
    string,
    SubclassProgressionModule<TClassName>
  >()

  for (const subclass of [
    ...progression.subclasses,
    ...(XANATHAR_SUBCLASSES[className] ?? []),
  ]) {
    subclasses.set(subclass.id, {
      ...subclass,
      className,
      features: [...subclass.features],
      mergeMode: "replace",
    })
  }

  return defineClassProgression({
    className,
    definition: {
      label: progression.label,
      hitDie: progression.hitDie,
      source: progression.source,
      subclassLevel: progression.subclassLevel,
      cantripsKnown: progression.cantripsKnown
        ? { ...progression.cantripsKnown }
        : undefined,
    },
    features: [...progression.features],
    featureMergeMode: "replace",
    subclasses: Array.from(subclasses.values()),
    subclassMergeMode: "replace",
  })
}
