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

export const MOCK_USERS: MockUser[] = [
  {
    id: "U-00",
    name: "Rodrigo",
    email: "rodridioli@gmail.com",
    type: "Administrador",
    avatar: "",
    active: true,
  },
]


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
