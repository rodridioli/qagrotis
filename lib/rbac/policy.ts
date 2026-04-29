/**
 * RBAC — Single source of truth para permissões.
 *
 * Cada combinação `${UserType}:${AccessProfile}` mapeia para um conjunto de capabilities.
 * Front e back leem deste arquivo para decidir visibilidade e autorização.
 */

export type UserType = "Administrador" | "Padrão"
export type AccessProfile = "QA" | "UX" | "TW" | "MGR"
export type Role = `${UserType}:${AccessProfile}`

export type Capability =
  // Menu lateral
  | "menu.painel"
  | "menu.suites"
  | "menu.cenarios"
  | "menu.gerador"
  | "menu.documentos"
  | "menu.assistente"
  | "menu.equipe"
  | "menu.configuracoes"
  | "menu.atualizacoes"
  | "menu.pdi"
  | "menu.mapaConhecimento"
  | "menu.avaliacaoDesempenho"
  | "menu.feedbacks"
  | "menu.individual"
  // Individual
  | "individual.viewOthers"
  // Topbar
  | "topbar.sistemaSelector"
  // Sub-páginas de configurações
  | "config.usuarios"
  | "config.sistemas"
  | "config.modulos"
  | "config.clientes"
  | "config.modelosIA"
  | "config.credenciais"
  | "config.jira"
  // Ações em usuários
  | "users.create"
  | "users.editProfileFields" // Tipo, Perfil, Cargo, Horários, Formato, Dias
  // Equipe
  | "equipe.performance.filterByProfile"

/** Itens visíveis-mas-desabilitados (aparecem cinzas no menu). */
export type DisabledItem = Capability

interface RoleConfig {
  capabilities: Capability[]
  disabled: DisabledItem[]
  /** Perfis que este role pode gerenciar/editar. */
  manageableProfiles: AccessProfile[]
}

const ALL_CONFIG: Capability[] = [
  "config.usuarios",
  "config.sistemas",
  "config.modulos",
  "config.clientes",
  "config.modelosIA",
  "config.credenciais",
  "config.jira",
]

const POLICY: Record<Role, RoleConfig> = {
  // ─────────────────────────────────────────── QA
  "Padrão:QA": {
    capabilities: [
      "menu.painel",
      "menu.suites",
      "menu.cenarios",
      "menu.gerador",
      "menu.documentos",
      "menu.assistente",
      "menu.equipe",
      "menu.individual",
      "menu.configuracoes",
      "menu.atualizacoes",
      "topbar.sistemaSelector",
      "config.clientes",
      "config.credenciais",
      "config.jira",
    ],
    disabled: [],
    manageableProfiles: [],
  },
  "Administrador:QA": {
    capabilities: [
      "menu.painel",
      "menu.suites",
      "menu.cenarios",
      "menu.gerador",
      "menu.documentos",
      "menu.assistente",
      "menu.equipe",
      "menu.individual",
      "menu.configuracoes",
      "menu.atualizacoes",
      "topbar.sistemaSelector",
      "config.usuarios",
      "config.sistemas",
      "config.modulos",
      "config.clientes",
      "config.modelosIA",
      "config.credenciais",
      "config.jira",
      "users.create",
    ],
    disabled: [],
    manageableProfiles: ["QA"],
  },

  // ─────────────────────────────────────────── UX
  "Padrão:UX": {
    capabilities: [
      "menu.painel",
      "menu.assistente",
      "menu.equipe",
      "menu.individual",
      "menu.configuracoes",
      "menu.atualizacoes",
      "config.jira",
    ],
    disabled: ["menu.gerador", "menu.documentos"],
    manageableProfiles: [],
  },
  "Administrador:UX": {
    capabilities: [
      "menu.painel",
      "menu.assistente",
      "menu.equipe",
      "menu.individual",
      "menu.configuracoes",
      "menu.atualizacoes",
      "config.usuarios",
      "config.modelosIA",
      "config.jira",
      "users.create",
    ],
    disabled: ["menu.gerador", "menu.documentos"],
    manageableProfiles: ["UX"],
  },

  // ─────────────────────────────────────────── TW
  "Padrão:TW": {
    capabilities: [
      "menu.painel",
      "menu.assistente",
      "menu.equipe",
      "menu.individual",
      "menu.configuracoes",
      "menu.atualizacoes",
      "config.jira",
    ],
    disabled: ["menu.gerador", "menu.documentos"],
    manageableProfiles: [],
  },
  "Administrador:TW": {
    capabilities: [
      "menu.painel",
      "menu.assistente",
      "menu.equipe",
      "menu.individual",
      "menu.configuracoes",
      "menu.atualizacoes",
      "config.usuarios",
      "config.modelosIA",
      "config.jira",
      "users.create",
    ],
    disabled: ["menu.gerador", "menu.documentos"],
    manageableProfiles: ["TW"],
  },

  // ─────────────────────────────────────────── MGR (apenas Administrador)
  "Padrão:MGR": {
    // combinação inválida — fallback fechado
    capabilities: [],
    disabled: [],
    manageableProfiles: [],
  },
  "Administrador:MGR": {
    capabilities: [
      "menu.painel",
      "menu.pdi",
      "menu.documentos",
      "menu.assistente",
      "menu.equipe",
      "menu.individual",
      "menu.configuracoes",
      "menu.atualizacoes",
      "menu.mapaConhecimento",
      "menu.avaliacaoDesempenho",
      "menu.feedbacks",
      "config.usuarios",
      "config.modelosIA",
      "config.jira",
      "users.create",
      "users.editProfileFields",
      "equipe.performance.filterByProfile",
      "individual.viewOthers",
    ],
    disabled: [],
    manageableProfiles: ["QA", "UX", "TW", "MGR"],
  },
}

/** Constrói a Role a partir de tipo+perfil, com fallbacks defensivos. */
export function buildRole(type: string | null | undefined, profile: string | null | undefined): Role {
  const t: UserType = type === "Administrador" ? "Administrador" : "Padrão"
  const p: AccessProfile =
    profile === "MGR" || profile === "UX" || profile === "TW" ? (profile as AccessProfile) : "QA"
  return `${t}:${p}` as Role
}

function configFor(role: Role): RoleConfig {
  return POLICY[role] ?? POLICY["Padrão:QA"]
}

/** Verifica se um role tem a capability (e não está apenas "disabled"). */
export function can(role: Role, cap: Capability): boolean {
  return configFor(role).capabilities.includes(cap)
}

/** Verifica se item deve aparecer cinza/desabilitado. */
export function isDisabled(role: Role, cap: Capability): boolean {
  return configFor(role).disabled.includes(cap)
}

/** Verifica se item deve aparecer no menu (ativo OU desabilitado). */
export function isVisible(role: Role, cap: Capability): boolean {
  const cfg = configFor(role)
  return cfg.capabilities.includes(cap) || cfg.disabled.includes(cap)
}

export function manageableProfiles(role: Role): AccessProfile[] {
  return configFor(role).manageableProfiles
}

/**
 * Quem pode editar campos sensíveis (Tipo, Perfil, Cargo, Horários, Formato, Dias)
 * do próprio cadastro: somente Administrador:MGR.
 * Para editar de outro usuário: depende de manageableProfiles.
 */
export function canEditUserField(
  selfRole: Role,
  isEditingSelf: boolean,
  targetProfile: AccessProfile | null
): boolean {
  if (isEditingSelf) return can(selfRole, "users.editProfileFields")
  if (!targetProfile) return false
  return manageableProfiles(selfRole).includes(targetProfile)
}

export const ACCESS_PROFILES: AccessProfile[] = ["QA", "UX", "TW", "MGR"]
