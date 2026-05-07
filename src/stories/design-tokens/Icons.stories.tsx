import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  // Navigation & Actions
  ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, ArrowDownIcon,
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon,
  PlusIcon, MinusIcon, XIcon, CheckIcon,
  // Files & Data
  FileTextIcon, FolderIcon, FolderOpenIcon, DownloadIcon, UploadIcon,
  // Status
  CheckCircleIcon, XCircleIcon, AlertCircleIcon, AlertTriangleIcon,
  InfoIcon, ClockIcon, Loader2Icon, RefreshCwIcon,
  // User & Auth
  UserIcon, UsersIcon, LogInIcon, LogOutIcon, ShieldIcon, KeyIcon,
  // UI Elements
  SearchIcon, FilterIcon, SlidersIcon, SettingsIcon, MoreHorizontalIcon,
  MoreVerticalIcon, MenuIcon, GridIcon, ListIcon,
  // Agriculture / Domain
  LeafIcon, SproutIcon, SunIcon, DropletsIcon, ThermometerIcon, WindIcon,
  // Testing / Dev
  BugIcon, FlaskConicalIcon, TerminalIcon, CodeIcon, GitBranchIcon,
  PlayIcon, PauseIcon, StopCircleIcon, RotateCcwIcon,
  // Communication
  BellIcon, MailIcon, MessageSquareIcon, SendIcon,
  // Analytics
  BarChart2Icon, LineChartIcon, PieChartIcon, TrendingUpIcon, TrendingDownIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ── Icon sets ─────────────────────────────────────────────────

const ICON_GROUPS: { title: string; icons: { name: string; Icon: LucideIcon }[] }[] = [
  {
    title: "Navegação & Ações",
    icons: [
      { name: "ArrowLeft",     Icon: ArrowLeftIcon },
      { name: "ArrowRight",    Icon: ArrowRightIcon },
      { name: "ArrowUp",       Icon: ArrowUpIcon },
      { name: "ArrowDown",     Icon: ArrowDownIcon },
      { name: "ChevronLeft",   Icon: ChevronLeftIcon },
      { name: "ChevronRight",  Icon: ChevronRightIcon },
      { name: "ChevronDown",   Icon: ChevronDownIcon },
      { name: "ChevronUp",     Icon: ChevronUpIcon },
      { name: "Plus",          Icon: PlusIcon },
      { name: "Minus",         Icon: MinusIcon },
      { name: "X",             Icon: XIcon },
      { name: "Check",         Icon: CheckIcon },
    ],
  },
  {
    title: "Status & Feedback",
    icons: [
      { name: "CheckCircle",    Icon: CheckCircleIcon },
      { name: "XCircle",        Icon: XCircleIcon },
      { name: "AlertCircle",    Icon: AlertCircleIcon },
      { name: "AlertTriangle",  Icon: AlertTriangleIcon },
      { name: "Info",           Icon: InfoIcon },
      { name: "Clock",          Icon: ClockIcon },
      { name: "Loader2",        Icon: Loader2Icon },
      { name: "RefreshCw",      Icon: RefreshCwIcon },
    ],
  },
  {
    title: "Testes & Desenvolvimento",
    icons: [
      { name: "Play",           Icon: PlayIcon },
      { name: "Pause",          Icon: PauseIcon },
      { name: "StopCircle",     Icon: StopCircleIcon },
      { name: "RotateCcw",      Icon: RotateCcwIcon },
      { name: "Bug",            Icon: BugIcon },
      { name: "FlaskConical",   Icon: FlaskConicalIcon },
      { name: "Terminal",       Icon: TerminalIcon },
      { name: "Code",           Icon: CodeIcon },
      { name: "GitBranch",      Icon: GitBranchIcon },
    ],
  },
  {
    title: "Domínio Agrícola",
    icons: [
      { name: "Leaf",           Icon: LeafIcon },
      { name: "Sprout",         Icon: SproutIcon },
      { name: "Sun",            Icon: SunIcon },
      { name: "Droplets",       Icon: DropletsIcon },
      { name: "Thermometer",    Icon: ThermometerIcon },
      { name: "Wind",           Icon: WindIcon },
    ],
  },
  {
    title: "Analytics & Dados",
    icons: [
      { name: "BarChart2",      Icon: BarChart2Icon },
      { name: "LineChart",      Icon: LineChartIcon },
      { name: "PieChart",       Icon: PieChartIcon },
      { name: "TrendingUp",     Icon: TrendingUpIcon },
      { name: "TrendingDown",   Icon: TrendingDownIcon },
      { name: "FileText",       Icon: FileTextIcon },
      { name: "Folder",         Icon: FolderIcon },
      { name: "FolderOpen",     Icon: FolderOpenIcon },
      { name: "Download",       Icon: DownloadIcon },
      { name: "Upload",         Icon: UploadIcon },
    ],
  },
  {
    title: "Interface",
    icons: [
      { name: "Search",         Icon: SearchIcon },
      { name: "Filter",         Icon: FilterIcon },
      { name: "Sliders",        Icon: SlidersIcon },
      { name: "Settings",       Icon: SettingsIcon },
      { name: "MoreHorizontal", Icon: MoreHorizontalIcon },
      { name: "MoreVertical",   Icon: MoreVerticalIcon },
      { name: "Menu",           Icon: MenuIcon },
      { name: "Grid",           Icon: GridIcon },
      { name: "List",           Icon: ListIcon },
    ],
  },
  {
    title: "Utilizadores & Auth",
    icons: [
      { name: "User",    Icon: UserIcon },
      { name: "Users",   Icon: UsersIcon },
      { name: "LogIn",   Icon: LogInIcon },
      { name: "LogOut",  Icon: LogOutIcon },
      { name: "Shield",  Icon: ShieldIcon },
      { name: "Key",     Icon: KeyIcon },
      { name: "Bell",    Icon: BellIcon },
      { name: "Mail",    Icon: MailIcon },
      { name: "Message", Icon: MessageSquareIcon },
      { name: "Send",    Icon: SendIcon },
    ],
  },
]

// ── Sizes reference ───────────────────────────────────────────

const SIZES: { label: string; px: number }[] = [
  { label: "xs", px: 12 },
  { label: "sm", px: 14 },
  { label: "md (default)", px: 16 },
  { label: "lg", px: 20 },
  { label: "xl", px: 24 },
]

// ── Page ──────────────────────────────────────────────────────

function IconsPage() {
  return (
    <div className="flex flex-col gap-12 bg-surface-default p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Icons</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Biblioteca{" "}
          <strong className="font-semibold text-text-primary">Lucide React</strong>{" "}
          (
          <code className="font-mono text-xs">lucide-react</code>). Tamanho
          padrão nos componentes:{" "}
          <code className="font-mono text-xs">size-4</code> (16px). Cor herdada
          do contexto — nunca hardcodar cor no ícone.
        </p>
      </div>

      {/* Sizes */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Tamanhos
        </h2>
        <div className="flex flex-wrap items-end gap-6 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
          {SIZES.map(({ label, px }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <LeafIcon style={{ width: px, height: px }} className="text-brand-primary" />
              <span className="font-mono text-xs text-text-secondary">{label}</span>
              <span className="font-mono text-xs text-neutral-grey-400">{px}px</span>
            </div>
          ))}
        </div>
      </div>

      {/* Colour contexts */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Cor por Contexto (herança)
        </h2>
        <div className="flex flex-wrap gap-4">
          {[
            { label: "brand-primary", color: "var(--brand-primary)" },
            { label: "text-primary",  color: "var(--text-primary)" },
            { label: "text-secondary",color: "var(--text-secondary)" },
            { label: "destructive",   color: "var(--destructive)" },
            { label: "neutral-grey-400", color: "var(--neutral-grey-400)" },
          ].map(({ label, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-custom border border-border-default bg-surface-card px-4 py-3 shadow-card"
            >
              <CheckCircleIcon style={{ color }} className="size-5" />
              <span className="font-mono text-xs" style={{ color }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Icon groups */}
      {ICON_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-4">
          <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
            {group.title}
          </h2>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {group.icons.map(({ name, Icon }) => (
              <div
                key={name}
                className="group flex flex-col items-center gap-2 rounded-custom border border-transparent p-3 transition-colors hover:border-border-default hover:bg-surface-card hover:shadow-card"
              >
                <Icon className="size-5 text-text-primary transition-colors group-hover:text-brand-primary" />
                <span className="text-center font-mono text-[10px] leading-tight text-neutral-grey-400 group-hover:text-text-secondary">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const meta: Meta = {
  title: "Design Tokens/Icons",
  component: IconsPage,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof IconsPage>

export const Icons: Story = {}
