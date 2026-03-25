import { getSistemas } from "@/lib/actions/sistemas"
import NovoModuloClient from "./NovoModuloClient"

export default async function NovoModuloPage() {
  const sistemas = await getSistemas()
  const sistemasAtivos = sistemas.filter((s) => s.active)
  return <NovoModuloClient sistemas={sistemasAtivos} />
}
