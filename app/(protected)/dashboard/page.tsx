import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
  DASHBOARD_METRICS,
  AUTOMATION_COVERAGE_DATA,
  MONTHLY_TESTS_DATA,
  MONTHLY_ERRORS_DATA,
  FILA_AUTOMACAO,
  ULTIMAS_TAREFAS,
} from "@/lib/qagrotis-constants"
import { DashboardCharts } from "./DashboardCharts"

function MetricCard({
  label,
  value,
  change,
  percentage,
}: {
  label: string
  value: string
  change?: string
  percentage?: string
}) {
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-card">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
      {change && (
        <p className="mt-1 text-xs font-medium text-green-600">{change}</p>
      )}
      {percentage && (
        <p className="mt-1 text-xs text-text-secondary">{percentage}</p>
      )}
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {DASHBOARD_METRICS.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      <DashboardCharts
        automationData={AUTOMATION_COVERAGE_DATA}
        monthlyTests={MONTHLY_TESTS_DATA}
        monthlyErrors={MONTHLY_ERRORS_DATA}
        filaAutomacao={FILA_AUTOMACAO}
        ultimasTarefas={ULTIMAS_TAREFAS}
      />
    </div>
  )
}
