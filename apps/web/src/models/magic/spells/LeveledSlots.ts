

export type Slot = {
  level: number
  max: number 
  current: number
}

export type Slots = Record<number, Slot>