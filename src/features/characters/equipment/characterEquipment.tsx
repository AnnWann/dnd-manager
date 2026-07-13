import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { EquipmentArmorSection } from "./equipmentArmorSection"
import { EquipmentAttunementSection } from "./equipmentAttunementSection"
import { EquipmentPocketsSection } from "./EquipmentPocketSection"
import { EquipmentRingsSection } from "./equipmentRingSection"
import { EquipmentSingleSlotSection } from "./EquipmentSingleSlotSection"
import { EquipmentSummary } from "./equipmentSummary"
import { EquipmentWeaponsSection } from "./EquipmentWeaponsSection"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function CharacterEquipmentTab({ character, updateCharacter }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">Equipamento</div>
        <div className="mt-1 text-xs text-text">
          Itens equipados, escudo, armas, anéis, bolsos e sintonias.
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <EquipmentSummary character={character} />

        <EquipmentAttunementSection
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentArmorSection
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentSingleSlotSection
          title="Escudo"
          slot="shield"
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentSingleSlotSection
          title="Capacete"
          slot="helmet"
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentSingleSlotSection
          title="Luvas"
          slot="gloves"
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentSingleSlotSection
          title="Botas"
          slot="boots"
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentSingleSlotSection
          title="Capa"
          slot="cape"
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentWeaponsSection
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentRingsSection
          character={character}
          updateCharacter={updateCharacter}
        />

        <EquipmentPocketsSection
          character={character}
          updateCharacter={updateCharacter}
        />
      </CardContent>
    </Card>
  )
}
