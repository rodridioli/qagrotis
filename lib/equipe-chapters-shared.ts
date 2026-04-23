/** Tamanho da página do ranking na aba Chapters (equipe). */
export const EQUIPE_CHAPTER_RANKING_PAGE_SIZE = 10

export interface EquipeChapterAuthorOption {
  id: string
  name: string
}

/** Autor na listagem de chapters (foto + nome; inclui inativos no histórico). */
export interface EquipeChapterAuthorDisplay {
  userId: string
  name: string
  photoPath: string | null
}

export interface EquipeChapterListRow {
  id: string
  edicao: number
  dataYmd: string
  tema: string
  autoresLabel: string
  hyperlink: string | null
  authorIds: string[]
  /** Ordem estável: mesma ordem persistida em `EquipeChapterAuthor` (createMany). */
  authors: EquipeChapterAuthorDisplay[]
}

/** Uma linha do ranking (posição global no pódio geral). */
export interface EquipeChapterRankingRow {
  position: number
  userId: string
  name: string
  photoPath: string | null
  points: number
}

export interface EquipeChapterRankingPage {
  rows: EquipeChapterRankingRow[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}
