import { notFound } from "next/navigation"
import { isEquipeTabId } from "@/features/equipe/components/equipeNavEntries"

export async function generateMetadata({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = await params
  const labels: Record<string, string> = {
    performance: "Performance",
    chapters: "Chapters",
    horarios: "Horários",
    ferias: "Férias",
    ausencias: "Ausências",
    metas: "Metas",
    aniversarios: "Aniversários",
  }
  return { title: labels[secao] ? `Equipe — ${labels[secao]}` : "Equipe" }
}

export default async function EquipeSecaoPage({
  params,
}: {
  params: Promise<{ secao: string }>
}) {
  const { secao } = await params
  if (!isEquipeTabId(secao)) notFound()
  return null
}
