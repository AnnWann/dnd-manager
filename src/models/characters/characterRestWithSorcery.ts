import type { CharacterTemplate } from "./CharacterTemplate"
import type { CustomSystemDefinition } from "../customSystems/CustomSystemDefinition"
import {
  takeLongRest as takeBaseLongRest,
  takePartialLongRest as takeBasePartialLongRest,
} from "./characterRest"
import {
  getSorceryPointPool,
  setSorceryPointCurrent,
} from "./characterSorceryPoints"

export function takeLongRest(
  character: CharacterTemplate,
  customSystemDefinitions?: CustomSystemDefinition[],
): CharacterTemplate {
  const pool = getSorceryPointPool(character)
  const rested = takeBaseLongRest(character, customSystemDefinitions)

  return setSorceryPointCurrent(rested, pool.max)
}

export function takePartialLongRest(
  character: CharacterTemplate,
  customSystemDefinitions?: CustomSystemDefinition[],
): CharacterTemplate {
  const pool = getSorceryPointPool(character)
  const missing = Math.max(0, pool.max - pool.current)
  const recovered = Math.ceil(missing * 0.5)
  const rested = takeBasePartialLongRest(character, customSystemDefinitions)

  return setSorceryPointCurrent(
    rested,
    Math.min(pool.max, pool.current + recovered),
  )
}
