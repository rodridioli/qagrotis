#!/usr/bin/env node
/**
 * Auto-changelog: adiciona entrada ao changelog.json se houver commits novos.
 * Roda via git hook ou manualmente: node scripts/pre-commit-changelog.js
 */
const fs = require("fs")
const { execSync } = require("child_process")
const path = require("path")

const changelogPath = path.join(__dirname, "../data/changelog.json")
const data = JSON.parse(fs.readFileSync(changelogPath, "utf-8"))

// Get latest version and bump patch
const latest = data[0]?.version ?? "1.0.0"
const parts = latest.split(".").map(Number)
parts[2] = (parts[2] ?? 0) + 1
const newVersion = parts.join(".")

// Get last changelog date
const lastDate = data[0]?.date ?? "2026-01-01"

// Get commits since last entry
let commits = []
try {
  const log = execSync(
    `git log --since="${lastDate}T00:00:00" --format="%s" --no-merges`,
    { encoding: "utf-8" }
  ).trim()
  commits = log.split("\n")
    .filter(Boolean)
    .filter(s => !s.startsWith("chore:") && !s.startsWith("debug:") && !s.includes("Merge") && !s.includes("force redeploy"))
    .slice(0, 15)
} catch {
  commits = []
}

if (commits.length === 0) {
  console.log("Nenhum commit novo desde o último changelog. Nada adicionado.")
  process.exit(0)
}

// Format commits as user-friendly messages
const changes = commits.map(s =>
  s.replace(/^(feat|fix|fix crítico|chore|docs|refactor|perf|style|test):\s*/i, "")
    .replace(/^feat!:\s*/i, "")
    .trim()
)

const today = new Date().toISOString().split("T")[0]

const newEntry = {
  version: newVersion,
  commit: "deploy-vercel",
  date: today,
  tag: changes.some(c => c.toLowerCase().includes("feat") || !c.startsWith("fix")) ? "Novidade" : "Melhoria",
  author: "Rodrigo Diego de Oliveira",
  changes
}

data.unshift(newEntry)
fs.writeFileSync(changelogPath, JSON.stringify(data, null, 2), "utf-8")
console.log(`✅ Changelog v${newVersion} adicionado com ${changes.length} entradas.`)
