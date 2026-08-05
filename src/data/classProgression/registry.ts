import { artificerProgression } from "./classes/artificer"
import { barbarianProgression } from "./classes/barbarian"
import { bardProgression } from "./classes/bard"
import { clericProgression } from "./classes/cleric"
import { druidProgression } from "./classes/druid"
import { fighterProgression } from "./classes/fighter"
import { monkProgression } from "./classes/monk"
import { paladinProgression } from "./classes/paladin"
import { rangerProgression } from "./classes/ranger"
import { rogueProgression } from "./classes/rogue"
import { sorcererProgression } from "./classes/sorcerer"
import { warlockProgression } from "./classes/warlock"
import { wizardProgression } from "./classes/wizard"
import type { ClassProgressionModule } from "./types"

export const CLASS_PROGRESSION_MODULES = [
  artificerProgression,
  barbarianProgression,
  bardProgression,
  clericProgression,
  druidProgression,
  fighterProgression,
  monkProgression,
  paladinProgression,
  rangerProgression,
  rogueProgression,
  sorcererProgression,
  warlockProgression,
  wizardProgression,
] satisfies readonly ClassProgressionModule[]
