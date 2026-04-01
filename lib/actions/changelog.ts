"use server"

// Static import — bundled at build time, works on Vercel (no fs access needed)
import changelogData from "@/data/changelog.json"

export interface ChangelogEntry {
  version: string
  commit: string
  date: string
  tag: string
  author: string
  changes: string[]
}

export async function getChangelog(): Promise<ChangelogEntry[]> {
  return changelogData as ChangelogEntry[]
}
