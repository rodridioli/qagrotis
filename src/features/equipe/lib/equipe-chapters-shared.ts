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
  /** `false` para inativos — UI exibe foto em preto e branco. */
  active: boolean
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
  /** ISO string da última edição; igual a createdAt quando ainda não editado. */
  updatedAt: string
  /** Só no utilizador autenticado: indica a própria linha para edição na UI. */
  isMine?: boolean
}

/** Uma linha do ranking (posição global no pódio geral). */
export interface EquipeChapterRankingRow {
  position: number
  userId: string
  name: string
  photoPath: string | null
  /** `false` para inativos no cadastro — UI pode diferenciar (ex.: foto em cinza). */
  active: boolean
  /** Total de chapters apresentados como autor — não muda com resgates de pontos. */
  chapterCount: number
  /** Saldo de pontos disponível. Decrementado quando o utilizador resgata brindes. */
  points: number
  /** `true` quando esta linha pertence ao utilizador logado (calculado no servidor). */
  isCurrentUser: boolean
}

export interface EquipeChapterRankingPage {
  rows: EquipeChapterRankingRow[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}
