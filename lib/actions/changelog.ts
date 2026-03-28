"use server"

import { promises as fs } from "fs"
import path from "path"

export interface ChangelogEntry {
  version: string
  commit: string
  date: string
  tag: string
  author: string
  changes: string[]
}

const CHANGELOG_FILE = path.join(process.cwd(), "data", "changelog.json")

export async function getChangelog(): Promise<ChangelogEntry[]> {
  try {
    const content = await fs.readFile(CHANGELOG_FILE, "utf-8")
    return JSON.parse(content) as ChangelogEntry[]
  } catch {
    return []
  }
}
