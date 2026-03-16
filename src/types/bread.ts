export type SoakerKind = 'Cooked' | 'Scalded' | 'Soaked'

export interface SoakerComponent {
  id: string
  kind: SoakerKind
  flour: number
  water: number
}

export interface Starter {
  percent: number
  hydration: number
}

export interface DoughState {
  totalFlour: number
  targetHydration: number

  saltPercent: number
  yeastPercent: number
  maltPercent: number

  starter: Starter
  soakers: SoakerComponent[]
}
