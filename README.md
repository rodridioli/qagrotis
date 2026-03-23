# MVP Boilerplate

A complete, production-ready SaaS base. No business features included — add them separately.

## Stack

- **Next.js 14+** (App Router, TypeScript strict)
- **Auth.js v5** — Google OAuth + Magic Link (Resend)
- **Prisma 6** + **PostgreSQL** (Neon)
- **Stripe** — Subscriptions, Customer Portal, Webhooks
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query**
- **Sonner** (toasts)
- **Storybook** (base configured)
- **Design System** — wired tokens, single source of truth

---

## Quick Start

### 1. Clone & install

```bash
git clone <your-repo-url>
cd <project>
npm run setup
```

### 2. Configure environment

Fill in `.env` with your credentials:

```
DATABASE_URL=        # Neon PostgreSQL connection string
AUTH_SECRET=         # openssl rand -base64 32
AUTH_GOOGLE_ID=      # Google Cloud Console
AUTH_GOOGLE_SECRET=
AUTH_RESEND_KEY=     # Resend API key
RESEND_API_KEY=
STRIPE_SECRET_KEY=   # Stripe secret key
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_PRO=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up database

```bash
npx prisma db push      # Apply schema to Neon
npx prisma generate     # Generate client
```

### 4. Run locally

```bash
npm run dev
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run tokens` | Regenerate CSS tokens from design-system/tokens.ts |
| `npm run tokens:check` | Validate tokens are in sync |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run storybook` | Start Storybook |
| `npm run setup` | Full project setup script |

---

## Project Structure

```
app/
  (public)/         Landing page
  (auth)/login/     Login page
  (protected)/      Protected routes (dashboard, etc.)
  api/
    auth/           Auth.js handlers
    stripe/         Checkout, Portal, Webhook

components/
  ui/               shadcn/ui components
  forms/            Form components (LoginForm, etc.)
  layout/           Header, Footer, Providers
  paywall/          PaywallGate component

lib/
  auth.ts           Auth.js config
  db.ts             Prisma client
  stripe.ts         Stripe helpers
  email.ts          Resend email
  subscription.ts   Trial/subscription logic
  paywall.ts        PLAN_LIMITS, checkUsageLimit
  validations.ts    Zod schemas

design-system/
  tokens.ts         Single source of truth for all design tokens
  utils.ts          CSS var helper utilities
  generate-css.ts   Script to sync tokens to globals.css

hooks/
  useSubscription.ts  TanStack Query hooks for subscriptions

prisma/
  schema.prisma     Database schema (User, Account, Session, VerificationToken)
```

---

## Auth Setup

### Google OAuth
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Secret to `.env`

### Resend (Magic Link)
1. Create account at resend.com
2. Create API key
3. Verify your domain
4. Add `AUTH_RESEND_KEY` and `RESEND_API_KEY` to `.env`

---

## Stripe Setup

1. Create account at stripe.com
2. Create a product + recurring price in the Stripe dashboard
3. Copy the Price ID to `STRIPE_PRICE_ID_PRO`
4. For webhooks locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

**Required webhook events:**
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `customer.subscription.updated`
- `customer.subscription.deleted`

---

## Design System

All design tokens live in `design-system/tokens.ts`. To regenerate CSS variables:

```bash
npm run tokens
```

**Rule:** Never use hardcoded HEX values. Always use semantic tokens.

---

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

For the Stripe webhook in production, set the endpoint URL to:
`https://yourdomain.com/api/stripe/webhook`
