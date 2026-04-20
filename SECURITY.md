# Segurança de segredos e Vercel

## Contexto (abril/2026)

Houve relatos na comunidade e em redes sociais sobre **instabilidade e possível incidente de segurança** envolvendo a Vercel. **Confirme sempre** o que é oficial no site da Vercel, no [status](https://www.vercel-status.com/) e nos canais oficiais da empresa antes de tomar decisões legais ou de comunicação externa.

**Princípio:** mesmo sem incidente confirmado, **rotacionar segredos** periodicamente e **nunca confiar em cópias antigas** de variáveis em painéis comprometidos é boa prática.

---

## O que fazer agora (ordem sugerida)

### 1. Conta e integrações Vercel

- Alterar **senha** da conta Vercel e garantir **2FA** ativo para todos os membros do time.
- Em **Team / Project → Settings → Git**: revisar integrações; se necessário, **reconectar** o repositório e revogar tokens antigos no GitHub/GitLab/Bitbucket e criar novos.
- Revogar **tokens de deploy** ou **PATs** que tenham sido usados só para a Vercel e recriar com escopo mínimo.

### 2. Variáveis de ambiente no painel da Vercel

No projeto (ex.: **Production**, **Preview**, **Development**), **regere** tudo que for segredo. Lista usada por este app (consulte também `.env` local):

| Área | Variáveis (exemplos) | Onde regerar |
|------|----------------------|--------------|
| Banco | `DATABASE_URL` | Provedor do Postgres (Neon, Supabase, RDS, etc.): **nova senha** ou novo usuário; atualizar URL na Vercel. |
| Auth.js | `AUTH_SECRET` | Gerar novo: `openssl rand -base64 32` (ou equivalente). **Todos os usuários precisarão entrar de novo.** |
| Google OAuth | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | [Google Cloud Console](https://console.cloud.google.com/) → credenciais OAuth → **novo client secret** (e revisar origens/redirects). |
| E-mail | `RESEND_API_KEY`, `AUTH_RESEND_KEY`, `EMAIL_FROM` | Painel Resend (ou provedor SMTP: `SMTP_*`). |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO` | Dashboard Stripe: **roll keys**, novo **signing secret** do webhook; atualizar endpoint se necessário. |
| IA / APIs | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY` | Cada provedor: revogar chave antiga, criar nova. |
| GitBook (assistente) | `GITBOOK_API_TOKEN`, `GITBOOK_PRIVATE_KEY`, etc. | Painel GitBook: rotacionar tokens. |
| App | `NEXT_PUBLIC_APP_URL` | Apenas URL pública; conferir se aponta para o domínio correto após mudanças. |

Depois de salvar na Vercel: **Redeploy** do último deploy ou push vazio para forçar novo build.

### 3. Banco de dados

- Assumir que **connection strings** antigas podem ter vazado: **trocar senha** ou usuário de aplicação.
- Se o provedor oferecer **lista de IPs permitidos** ou **network rules**, use para reduzir superfície.

### 4. Como usar `.env` daqui pra frente

- **Nunca** commitar `.env`, `.env.local`, `.env.production` (o `.gitignore` já ignora `.env*`).
- **Produção:** segredos só no **painel da Vercel** (ou outro secret manager), não em repositório.
- **Local:** `.env.local` ou `.env` na máquina; não colar segredos em tickets, Slack público ou prints.
- **Por ambiente:** valores diferentes para Preview vs Production quando fizer sentido.
- **Rotação:** calendário (ex.: trimestral) para chaves de API e segredos críticos.

---

## Verificação de build (local)

Após `npx prisma generate` com sucesso na sua rede:

```bash
npm run build
```

Saída sem erro e exit code `0` indica alinhamento com o comando de build usado na Vercel (`vercel.json`: `prisma generate && next build`).

---

## Referências úteis

- [Auth.js — errors / configuration](https://errors.authjs.dev)
- Documentação oficial da Vercel sobre **Environment Variables** e **Security**

Se surgir comunicado oficial da Vercel sobre o incidente, siga as orientações deles além deste checklist.
