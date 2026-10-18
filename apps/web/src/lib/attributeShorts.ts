import type { Attribute } from "../models/sheet/Attribute"

export type AttributeShort = "FOR" | "DES" | "CON" | "INT" | "SAB" | "CAR"

export function attributeShort(attribute: Attribute): AttributeShort {
  switch (attribute) {
    case "str":
      return "FOR"
    case "dex":
      return "DES"
    case "con":
      return "CON"
    case "int":
      return "INT"
    case "wis":
      return "SAB"
    case "cha":
      return "CAR"
  }
}
