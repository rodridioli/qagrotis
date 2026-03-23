#!/usr/bin/env node
/**
 * setup.js — automated project setup script
 * Run with: npm run setup
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const ROOT = path.resolve(__dirname, "..")

function log(msg) {
  console.log(`\n→ ${msg}`)
}

function success(msg) {
  console.log(`✅ ${msg}`)
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`)
}

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts })
}

// ── Step 1: Check .env ───────────────────────────────────────
log("Checking .env file...")
const envPath = path.join(ROOT, ".env")
const envExamplePath = path.join(ROOT, ".env.example")

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(envExamplePath, envPath)
  warn(".env not found — copied from .env.example. Fill in your variables!")
} else {
  success(".env already exists.")
}

// ── Step 2: Install dependencies ─────────────────────────────
log("Installing dependencies...")
run("npm install")
success("Dependencies installed.")

// ── Step 3: Generate Prisma client ───────────────────────────
log("Generating Prisma client...")
try {
  run("npx prisma generate")
  success("Prisma client generated.")
} catch {
  warn("Prisma generate failed — make sure DATABASE_URL is set in .env")
}

// ── Step 4: Generate design tokens ───────────────────────────
log("Generating design tokens...")
try {
  run("npm run tokens")
  success("Design tokens generated.")
} catch {
  warn("Token generation failed.")
}

// ── Done ─────────────────────────────────────────────────────
console.log(`
╔═══════════════════════════════════════╗
║          Setup complete! 🎉           ║
╚═══════════════════════════════════════╝

Next steps:
1. Fill in your .env file with real credentials
2. Run: npx prisma db push  (to create your database tables)
3. Run: npm run dev         (to start the dev server)

Need help? See README.md
`)
