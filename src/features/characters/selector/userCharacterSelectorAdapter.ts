import type { UserCharacterSummary } from "../../../api/user-characters"
import type { CharacterSelectorItem } from "./CharacterSelectorItem"

export function toUserCharacterSelectorItem(
  character: UserCharacterSummary,
): CharacterSelectorItem {
  const data = asObject(character.data)
  const sheet = asObject(data?.sheet)

  const classes = Array.isArray(sheet?.classes)
    ? sheet.classes
    : []

  const level = classes.reduce((total, entry) => {
    const classData = asObject(entry)
    const value = Number(classData?.level ?? 0)

    return total + (
      Number.isFinite(value)
        ? value
        : 0
    )
  }, 0)

  const classLabel = classes
    .map((entry) => {
      const classData = asObject(entry)

      const customName =
        typeof classData?.customName === "string"
          ? classData.customName.trim()
          : ""

      const name =
        typeof classData?.name === "string"
          ? classData.name.trim()
          : ""

      return customName || name
    })
    .filter(Boolean)
    .join(" / ")

  const profile = asObject(data?.profile)

  return {
    id: character.id,
    name: character.name,
    level,
    classLabel,
    imageUrl:
      typeof profile?.imageUrl === "string"
        ? profile.imageUrl
        : undefined,
    badge:
      character.campaigns?.length
        ? `${character.campaigns.length} campanha${
            character.campaigns.length === 1 ? "" : "s"
          }`
        : undefined,
  }
}

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null
  }

  return value as Record<string, unknown>
}