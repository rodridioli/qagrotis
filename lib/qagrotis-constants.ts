export type UserType = "Administrador" | "Padrão"
export type CenarioTipo = "Automatizado" | "Manual" | "Man./Auto."
export type SuiteTipo = "Sprint" | "Kanban" | "Outro"

export interface MockUser {
  id: string
  name: string
  email: string
  type: UserType
  avatar: string
  active: boolean
}

export interface MockCenario {
  id: string
  scenarioName: string
  system: string
  module: string
  client: string
  execucoes: number
  erros: number
  suites: number
  tipo: CenarioTipo
  active: boolean
}

export interface MockSuite {
  id: string
  suiteName: string
  versao: string
  modulo: string
  cliente: string
  execucoes: number
  automacao: number
  erros: number
  cenarios: number
  tipo: SuiteTipo
  active: boolean
}

export interface DashboardMetric {
  label: string
  value: string
  change?: string
  percentage?: string
}

const SYSTEMS = ["Gerencial", "Financeiro", "Comercial", "Agrícola", "RH"]
const MODULES = [
  "Cadastros",
  "Financeiro",
  "Estoque",
  "Vendas",
  "Compras",
  "Produção",
  "RH",
  "Relatórios",
  "Configurações",
  "Users",
  "C. Pagar",
  "C. Receber",
]
const CLIENTS = [
  "Fazenda São João",
  "Agro Tech Ltda",
  "Cooperativa Sul",
  "Rancho Grande",
  "AgroVerde SA",
  "Campo Aberto",
  "Sementes Norte",
  "Pecuária Leste",
  "Irrigação Plus",
  "Solo Fértil",
]

const firstNames = [
  "Ana", "Bruno", "Carlos", "Diana", "Eduardo", "Fernanda", "Gabriel", "Helena",
  "Igor", "Julia", "Kevin", "Laura", "Marcos", "Natalia", "Oscar", "Paula",
  "Quellison", "Rafael", "Sandra", "Tiago", "Ursula", "Vitor", "Wendy", "Xavier",
  "Yasmin", "Zeca", "André", "Beatriz", "Cesar", "Daniela",
]
const lastNames = [
  "Silva", "Santos", "Oliveira", "Souza", "Lima", "Costa", "Ferreira", "Alves",
  "Rodrigues", "Nascimento", "Obed", "Roger", "Aquino", "Nemetz", "Pereira",
  "Martins", "Carvalho", "Araújo", "Gomes", "Ribeiro",
]

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function rng(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000
  return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min
}

export const MOCK_USERS: MockUser[] = [
  {
    id: "U-00",
    name: "Rodrigo",
    email: "rodridioli@gmail.com",
    type: "Administrador",
    avatar: "",
    active: true,
  },
  ...Array.from({ length: 100 }, (_, i) => {
  const firstName = pick(firstNames, i * 3 + 7)
  const lastName = pick(lastNames, i * 2 + 5)
  const name = `${firstName} ${lastName}`
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@empresa.com.br`
  return {
    id: `U-${String(i + 1).padStart(2, "0")}`,
    name,
    email,
    type: (i % 4 === 0 ? "Administrador" : "Padrão") as UserType,
    avatar: "",
    active: i % 7 !== 0,
  }
})]

const cenarioNames = [
  "Cadastro de Produtores",
  "Emissão de Receituário Agronômico",
  "Cálculo do peso líquido de grãos",
  "Lançamento de Notas Fiscais",
  "Consulta de Estoque",
  "Relatório de Vendas Mensais",
  "Aprovação de Compras",
  "Pagamento de Fornecedores",
  "Controle de Pragas",
  "Análise de Solo",
  "Orçamento de Produtos",
  "Cadastro de Clientes",
  "Fechamento de Caixa",
  "Importação de XML",
  "Exportação para Jira",
  "Login e Autenticação",
  "Configuração de Permissões",
  "Geração de Boletos",
  "Conciliação Bancária",
  "Rastreabilidade de Lotes",
]

export const MOCK_CENARIOS: MockCenario[] = Array.from({ length: 1000 }, (_, i) => {
  const tipos: CenarioTipo[] = ["Automatizado", "Manual", "Man./Auto."]
  return {
    id: `CT-${String(i + 1).padStart(3, "0")}`,
    scenarioName: `${pick(cenarioNames, i)} - Caso ${i + 1}`,
    system: pick(SYSTEMS, i + 3),
    module: pick(MODULES, i * 2 + 1),
    client: pick(CLIENTS, i + 2),
    execucoes: rng(i + 100, 0, 150),
    erros: rng(i + 200, 0, 20),
    suites: rng(i + 300, 0, 10),
    tipo: tipos[i % 3],
    active: i % 8 !== 0,
  }
})

const suiteNames = [
  "SPRINT-001",
  "SPRINT-002",
  "SPRINT-003",
  "KANBAN-2026-Q1",
  "KANBAN-2026-Q2",
  "RELEASE-1.0",
  "RELEASE-2.0",
  "HOTFIX-001",
  "REGRESSÃO-GERAL",
  "SMOKE-TEST",
  "INTEGRACAO-ERP",
  "MODULO-FINANCEIRO",
  "MODULO-ESTOQUE",
  "MODULO-VENDAS",
  "MODULO-RH",
]

export const MOCK_SUITES: MockSuite[] = Array.from({ length: 1000 }, (_, i) => {
  const tipos: SuiteTipo[] = ["Sprint", "Kanban", "Outro"]
  const automacao = [0, 20, 50, 75, 100][i % 5]
  return {
    id: `S-${String(i + 1).padStart(3, "0")}`,
    suiteName: `${pick(suiteNames, i)} - v${Math.floor(i / 15) + 1}`,
    versao: `${Math.floor(i / 20) + 1}.${(i % 10) + 1}.0`,
    modulo: pick(MODULES, i + 4),
    cliente: pick(CLIENTS, i + 1),
    execucoes: rng(i + 400, 0, 200),
    automacao,
    erros: rng(i + 500, 0, 30),
    cenarios: rng(i + 600, 1, 50),
    tipo: tipos[i % 3],
    active: i % 6 !== 0,
  }
})

export const DASHBOARD_METRICS: DashboardMetric[] = [
  { label: "Módulos", value: "6" },
  { label: "Total de cenários", value: "1.000", change: "+11.01%" },
  { label: "Manuais", value: "200", percentage: "20%" },
  { label: "Automatizados", value: "800", percentage: "80%" },
]

export const AUTOMATION_COVERAGE_DATA = [
  { module: "Cadastros", coverage: 85 },
  { module: "Financeiro", coverage: 60 },
  { module: "Estoque", coverage: 45 },
  { module: "Vendas", coverage: 72 },
  { module: "Compras", coverage: 30 },
  { module: "RH", coverage: 20 },
]

export const MONTHLY_TESTS_DATA = [
  { month: "Jan", value: 120 },
  { month: "Fev", value: 180 },
  { month: "Mar", value: 150 },
  { month: "Abr", value: 220 },
  { month: "Mai", value: 190 },
  { month: "Jun", value: 280 },
  { month: "Jul", value: 310 },
  { month: "Ago", value: 260 },
  { month: "Set", value: 340 },
  { month: "Out", value: 290 },
  { month: "Nov", value: 380 },
  { month: "Dez", value: 420 },
]

export const MONTHLY_ERRORS_DATA = [
  { month: "Jan", value: 12 },
  { month: "Fev", value: 18 },
  { month: "Mar", value: 8 },
  { month: "Abr", value: 22 },
  { month: "Mai", value: 15 },
  { month: "Jun", value: 28 },
  { month: "Jul", value: 10 },
  { month: "Ago", value: 16 },
  { month: "Set", value: 24 },
  { month: "Out", value: 19 },
  { month: "Nov", value: 38 },
  { month: "Dez", value: 20 },
]

export const FILA_AUTOMACAO = [
  { id: "9889", module: "Users", title: "Cálculo do peso líquido...", priority: "Crítica" },
  { id: "9890", module: "Users", title: "Cálculo do peso líquido...", priority: "Crítica" },
  { id: "9891", module: "C. Pagar", title: "Emissão de Receituário Agronômico...", priority: "Normal" },
  { id: "9892", module: "C. Pagar", title: "Emissão de Receituário Agronômico...", priority: "Normal" },
]

export const ULTIMAS_TAREFAS = [
  { name: "Julia Obed", execucoes: "3 execuções", avatarColor: "bg-primary-200" },
  { name: "Quellison Roger", execucoes: "2 execuções", avatarColor: "bg-primary-200" },
  { name: "João Aquino", execucoes: "12 hours ago", avatarColor: "bg-primary-200" },
  { name: "André Nemetz", execucoes: "2 execuções", avatarColor: "bg-primary-200" },
]

export const MODULE_LIST = MODULES
export const SYSTEM_LIST = SYSTEMS
export const CLIENT_LIST = CLIENTS
export const TIPO_CENARIO_LIST: CenarioTipo[] = ["Automatizado", "Manual", "Man./Auto."]
export const TIPO_SUITE_LIST: SuiteTipo[] = ["Sprint", "Kanban", "Outro"]
export const PRIORIDADE_LIST = ["Alto", "Médio", "Baixo"]
