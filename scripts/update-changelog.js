#!/usr/bin/env node
/**
 * update-changelog.js
 * Reads recent git commits and appends new entries to data/changelog.json.
 *
 * Usage:
 *   node scripts/update-changelog.js
 *   npm run changelog:update
 *
 * Each run adds all commits since the last recorded commit as a single entry.
 * Edit the generated entry in data/changelog.json to adjust the tag and changes.
 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const CHANGELOG_PATH = path.join(__dirname, "..", "data", "changelog.json")

// ── Read existing changelog ───────────────────────────────────────────────────

let entries = []
try {
  entries = JSON.parse(fs.readFileSync(CHANGELOG_PATH, "utf-8"))
} catch {
  console.warn("[changelog] Could not read changelog.json — starting fresh.")
}

const lastCommit = entries[0]?.commit ?? null

// ── Read git log ───────────────────────────────────────────────────────────────

function git(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim()
  } catch {
    return ""
  }
}

// Get commits since last recorded one (or all if no previous entry)
const range = lastCommit && lastCommit !== "pendente" ? `${lastCommit}..HEAD` : "HEAD"
const logOutput = git(`git log ${range} --pretty=format:"%H|%h|%s|%an|%ad" --date=short`)

if (!logOutput) {
  console.log("[changelog] Nenhum commit novo encontrado desde a última entrada.")
  process.exit(0)
}

const commits = logOutput
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [hash, shortHash, subject, author, date] = line.split("|")
    return { hash, shortHash, subject, author, date }
  })

if (commits.length === 0) {
  console.log("[changelog] Nenhum commit novo.")
  process.exit(0)
}

// ── Build new entry ───────────────────────────────────────────────────────────

const latest = commits[0]
const changes = commits.map((c) => {
  // Strip conventional commit prefixes (feat:, fix:, chore:, etc.)
  return c.subject.replace(/^(feat|fix|chore|refactor|style|test|docs|perf|ci|build|revert)(\(.+?\))?:\s*/i, "")
})

// Auto-detect tag from commit messages
function detectTag(subjects) {
  const text = subjects.join(" ").toLowerCase()
  if (/\bfix\b|bug|erro|corr/.test(text)) return "Correção"
  if (/\bfeat\b|novo|add|nova|implementa|gerador|integra/.test(text)) return "Novidade"
  return "Melhoria"
}

// Derive next version number
function nextVersion(existingEntries) {
  if (existingEntries.length === 0) return "1.0.1"
  const last = existingEntries[0]?.version ?? "1.0.0"
  const parts = last.split(".").map(Number)
  parts[2] = (parts[2] ?? 0) + 1
  return parts.join(".")
}

const newEntry = {
  version: nextVersion(entries),
  commit: latest.shortHash,
  date: latest.date,
  tag: detectTag(commits.map((c) => c.subject)),
  author: latest.author,
  changes,
}

// ── Prepend and write ──────────────────────────────────────────────────────────

entries.unshift(newEntry)
fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(entries, null, 2) + "\n", "utf-8")

console.log(`[changelog] ✓ Adicionada entrada v${newEntry.version} (${newEntry.tag}) com ${changes.length} alteração(ões).`)
console.log(`[changelog] Commits incluídos: ${commits.map((c) => c.shortHash).join(", ")}`)
console.log(`[changelog] Revise data/changelog.json para ajustar tag e descrições se necessário.`)
