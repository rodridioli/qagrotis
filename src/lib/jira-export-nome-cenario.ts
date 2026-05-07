/**
 * Título do cenário no Markdown enviado ao Jira: usa o nome do cadastro quando existir,
 * senão o nome na suíte/histórico, e remove prefixo redundante tipo `C01 – ` (código interno).
 */
export function nomeParaTituloExportJira(opts: {
  nomeNaSuiteOuHistorico: string
  scenarioNameCadastro?: string | null
}): string {
  const raw =
    (opts.scenarioNameCadastro ?? "").trim() ||
    (opts.nomeNaSuiteOuHistorico ?? "").trim()
  const cleaned = raw.replace(/^\s*C\d+\s*[–—\-]\s*/i, "").trim()
  return cleaned || raw
}
