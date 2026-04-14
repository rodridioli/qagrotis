#!/usr/bin/env node
/**
 * Automatically adds a new changelog entry based on git commits since the last entry.
 * Run: node scripts/update-changelog.js <version> <tag> [author]
 *
 * Example: node scripts/update-changelog.js 1.6.0 Melhoria "Rodrigo Diego de Oliveira"
 */
const fs = require("fs")
const { execSync } = require("child_process")
const path = require("path")

const [,, version, tag = "Melhoria", author = "Rodrigo Diego de Oliveira"] = process.argv

if (!version) {
  console.error("Usage: node scripts/update-changelog.js <version> [tag] [author]")
  process.exit(1)
}

const changelogPath = path.join(__dirname, "../data/changelog.json")
const data = JSON.parse(fs.readFileSync(changelogPath, "utf-8"))

// Get date of last entry to use as 'since'
const lastDate = data[0]?.date ?? "2026-01-01"

// Get commits since last changelog
let commits = []
try {
  const log = execSync(
    `git log --since="${lastDate}T00:00:00" --format="%s" --no-merges`,
    { encoding: "utf-8" }
  ).trim()
  commits = log.split("\n").filter(Boolean).filter(s =>
    !s.startsWith("prisma") && !s.includes("seed") && !s.includes("Merge")
  )
} catch {
  commits = ["Melhorias gerais e correções de bugs."]
}

if (commits.length === 0) {
  console.log("No new commits found since last entry. Nothing added.")
  process.exit(0)
}

const today = new Date().toISOString().split("T")[0]

const newEntry = {
  version,
  commit: "deploy-vercel",
  date: today,
  tag,
  author,
  changes: commits.slice(0, 15) // max 15 entries
}

data.unshift(newEntry)
fs.writeFileSync(changelogPath, JSON.stringify(data, null, 2), "utf-8")
console.log(`✅ Added changelog entry ${version} with ${newEntry.changes.length} changes.`)
