/** Tamanho da página do ranking na aba Chapters (equipe). */
export const EQUIPE_CHAPTER_RANKING_PAGE_SIZE = 10

/** Tamanho da página da tabela de chapters (lista na aba Chapters). */
export const EQUIPE_CHAPTERS_TABLE_PAGE_SIZE = 20

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
  /** Média 0–5; `null` se ainda não há avaliações. */
  ratingAvg: number | null
  ratingCount: number
}

/** Avaliação devolvida à UI (sem identificar o utilizador). */
export interface EquipeChapterRatingEntry {
  id: string
  stars: number
  comment: string
  createdAt: string
  /** Só no utilizador autenticado: indica a própria linha para edição na UI. */
  isMine?: boolean
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
