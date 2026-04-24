/** Substitui linhas `- nome.ext` no markdown por links/imagens após upload ao Jira. */
export function applyJiraAttachmentUrlsToMarkdown(
  markdown: string,
  uploaded: { name: string; contentUrl: string }[],
): string {
  let out = markdown
  for (const att of uploaded) {
    const escaped = att.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const linePattern = new RegExp(`^- ${escaped}$`, "m")
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att.name)) {
      out = out.replace(linePattern, `![${att.name}](${att.contentUrl})`)
    } else if (/\.(pdf|mp4|m4v|webm|mov|mkv|avi|mpeg|mpg|ogv)$/i.test(att.name)) {
      out = out.replace(linePattern, `[${att.name}](${att.contentUrl})`)
    }
  }
  return out
}
