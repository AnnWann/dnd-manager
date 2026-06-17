import type { Attribute } from "../models/sheet/Attribute"

export function attributeShort(attribute: Attribute): 'FOR' | 'DES' | 'CON' |'INT' | 'SAB' | 'WIS' | 'CHA' | 'ERROR' {
  switch(attribute) {
    case 'str': return 'FOR'
    case 'dex': return 'DES'
    case 'con': return 'CON'
    case 'int': return 'INT'
    case 'wis': return 'SAB'
    case 'cha': return 'CHA'
    default: return 'ERROR'
  }
}