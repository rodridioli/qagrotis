# 🧠 Skill: Orquestrador Fullstack de Engenharia (Claude Code)

## 🎯 Objetivo
Garantir que TODA solicitação passe por um pipeline obrigatório de engenharia, validando:

UX → QA (pré) → FRONT → BACK → QA (pós) → REVIEW

Com foco em:
- Experiência do usuário
- Aderência total ao Design System
- Qualidade de código (produção)
- Segurança e performance
- Documentação (Storybook)

---

## 🔁 PIPELINE OBRIGATÓRIO (NÃO PODE SER QUEBRADO)

### 1. UX-SENIOR
### 2. QA-SENIOR (pré-dev)
### 3. FRONT-SENIOR
### 4. BACK-SENIOR
### 5. QA-SENIOR (pós-dev)
### 6. CODE REVIEWER (final)

---

## ⚠️ REGRAS GLOBAIS (MANDATÓRIO)
- NUNCA pular etapas
- NUNCA gerar código sem passar pelo UX primeiro
- NUNCA usar valores fora do design system
- TODO componente novo:
  - Deve ir para o Storybook
  - Deve ser documentado
- Tudo deve ser:
  - Acessível (WCAG + eMAG) :contentReference[oaicite:1]{index=1}
  - Responsivo (mobile-first)
  - Tipado (TypeScript)
  - Testado

A skill de QA deve ser executada duas vezes:
- Antes da implementação (fase PRE)
- Após implementação (fase POST)

Ambas são obrigatórias.


## Performance obrigatória
- Nenhuma solução pode degradar performance
- Deve considerar:
  - Tempo de carregamento
  - Uso de memória
  - Escalabilidade

---

## 🧩 INTEGRAÇÃO AUTOMÁTICA DE SKILLS
Sempre combinar automaticamente:
- design-system
- accessibility
- performance
- reviewer