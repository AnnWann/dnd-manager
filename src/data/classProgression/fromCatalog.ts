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

  for (const subclass of progression.subclasses) {
    subclasses.set(subclass.id, toModule(className, subclass))
  }

  for (const subclass of XANATHAR_SUBCLASSES[className] ?? []) {
    if (!subclasses.has(subclass.id)) {
      subclasses.set(subclass.id, toModule(className, subclass))
    }
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

function toModule<TClassName extends ClassName>(
  className: TClassName,
  subclass: (typeof CLASS_PROGRESSIONS)[ClassName]["subclasses"][number],
): SubclassProgressionModule<TClassName> {
  return {
    ...subclass,
    className,
    features: [...subclass.features],
    mergeMode: "replace",
  }
}
