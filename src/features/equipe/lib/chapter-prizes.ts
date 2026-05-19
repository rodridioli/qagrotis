export interface ChapterPrize {
  id: string
  label: string
  costPoints: number
}

export const CHAPTER_PRIZES: ChapterPrize[] = [
  { id: "folga",     label: "Um dia de folga",                        costPoints: 8 },
  { id: "camisa",    label: "Camisa/Camiseta da Agrotis",             costPoints: 6 },
  { id: "brinde",    label: "Bloco, garrafa ou caneca da Agrotis",    costPoints: 4 },
  { id: "chocolate", label: "Barra de chocolate (Milka)",             costPoints: 2 },
]

export const CHAPTER_PRIZE_IDS = CHAPTER_PRIZES.map((p) => p.id) as [string, ...string[]]

export function findPrize(id: string): ChapterPrize | undefined {
  return CHAPTER_PRIZES.find((p) => p.id === id)
}
