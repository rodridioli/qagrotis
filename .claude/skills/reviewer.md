---
name: reviewer
description: Gate final obrigatório — revisão de código, consistência visual, segurança e qualidade antes de qualquer PR ou entrega. Use esta skill SEMPRE que o usuário pedir para revisar código, antes de criar um PR, ao finalizar uma feature, ou quando o orquestrador solicitar review final.
---

# Reviewer — Gate Final

Nada vai para produção sem passar aqui. Pensa como atacante, revisa como sênior.

---

## 1. Qualidade de Código

### Clareza e Manutenibilidade
- [ ] Nomes expressivos (variáveis, funções, componentes)
- [ ] Sem comentários que explicam O QUÊ (o código já faz isso) — apenas comentários de POR QUÊ quando não óbvio
- [ ] Funções com responsabilidade única (< 40 linhas como indicativo)
- [ ] Sem código duplicado (extrair para util/hook/service)
- [ ] Sem `console.log`, `TODO`, `FIXME` ou código comentado

### TypeScript
- [ ] Sem `any` não justificado
- [ ] Tipos explícitos em props de componentes
- [ ] Return types em funções públicas
- [ ] Enums / union types para valores fixos (não strings mágicas)

### Arquitetura
- [ ] Segue Clean Architecture (handler → service → repository)?
- [ ] Server Components por padrão — `'use client'` justificado?
- [ ] Mutations via Server Actions ou Route Handlers (não no cliente)
- [ ] Sem lógica de negócio em componentes React
- [ ] Sem queries Prisma fora de repositories

---

## 2. Segurança (Pensar como Atacante)

### Autenticação e Autorização
- [ ] Todo endpoint/action verifica sessão com `auth()`
- [ ] Verificação de permissão específica (não só estar logado)
- [ ] Usuário A não consegue acessar dados do usuário B (IDOR)

### Validação e Sanitização
- [ ] Toda entrada externa validada com Zod (Route Handlers, Server Actions, params de URL)
- [ ] Nenhuma interpolação de string em queries SQL
- [ ] Dados do usuário escapados antes de renderizar no HTML

### Exposição de Dados
- [ ] `select` explícito no Prisma (nunca retornar objeto completo)
- [ ] Sem campos sensíveis em responses (senhas, tokens, dados internos)
- [ ] Stack traces não expostos em produção
- [ ] Secrets apenas em variáveis de ambiente (nunca no código)

### OWASP Top 10 — Verificação Rápida
- [ ] A01 Broken Access Control → auth em todo endpoint?
- [ ] A02 Cryptographic Failures → dados sensíveis criptografados?
- [ ] A03 Injection → Prisma parameterized + Zod?
- [ ] A07 Auth Failures → sessão expirada tratada?
- [ ] A09 Logging → nada sensível nos logs?

---

## 3. Consistência Visual (UI Senior)

### Design System
- [ ] Apenas tokens CSS do Design System (`var(--token-name)`)
- [ ] Nenhum valor hardcoded de cor, espaçamento ou tipografia
- [ ] Nenhuma classe Tailwind com valor arbitrário (`bg-[#abc]`, `p-[14px]`)
- [ ] `npm run tokens:check` passa sem erros

### Consistência de Componentes
- [ ] Mesmo componente = mesmo visual em toda a aplicação
- [ ] Variante correta do componente para o contexto (primário/secundário/destrutivo)
- [ ] Hierarquia de ações respeitada (1 primário por tela/modal)
- [ ] Spacing consistente com a escala do DS

### Tipografia e Texto
- [ ] Casing consistente (Sentence case ou Title Case — nunca misturado)
- [ ] Mesmo termo para o mesmo conceito em toda a app
- [ ] Sem mistura de idiomas (PT-BR ou EN — não os dois)
- [ ] Mensagens de erro/sucesso no padrão estabelecido

### Acessibilidade
- [ ] Contraste mínimo 4.5:1 (AA)
- [ ] Todos os elementos interativos acessíveis por teclado
- [ ] `aria-label` em ícones e botões sem texto
- [ ] `alt` em todas as imagens

---

## 4. Storybook

- [ ] Todo componente reutilizável tem `*.stories.tsx`
- [ ] Stories cobrem: default, loading, empty, error
- [ ] Story reflete o estado atual do componente (não desatualizada)

---

## 5. Performance

- [ ] Sem re-renders desnecessários (props estáveis, memo onde justificado)
- [ ] Sem requests duplicados para os mesmos dados
- [ ] Queries Prisma com `select` (sem buscar campos não usados)
- [ ] Imagens otimizadas com `next/image`
- [ ] Imports pesados com `dynamic()` (lazy)

---

## Veredito Final

### APROVADO quando:
- Todos os itens críticos (segurança + arquitetura) passam
- Sem hardcode visual
- TypeScript sem `any` injustificado
- Storybook atualizado para novos componentes
- Testes existem para fluxo principal

### BLOQUEADO quando:
❌ Qualquer falha de segurança (auth, IDOR, injection, exposição de dados)  
❌ Hardcode de valores visuais fora do Design System  
❌ Código sem tratamento de erro  
❌ Componente reutilizável sem story  
❌ `any` sem comentário de justificativa  

### Saída do Review
```
STATUS: APROVADO / BLOQUEADO

Bloqueadores críticos:
- [lista]

Melhorias sugeridas (não bloqueiam):
- [lista]
```
