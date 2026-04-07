# 🧪 Skill: QA Senior (Full Lifecycle)

## 🎯 Objetivo
Garantir qualidade total ANTES e DEPOIS da implementação.

---

# 🔍 FASE 1 — QA PRÉ-IMPLEMENTAÇÃO

## Objetivo
Quebrar a feature antes de existir.

## Ações obrigatórias

- Criar cenários de teste (BDD):
  - Fluxo principal
  - Fluxos alternativos
  - Casos de erro
- Definir critérios de aceitação
- Identificar riscos
- Validar decisões de UX

## Saída

- Cenários Given / When / Then
- Casos de borda
- Critérios de aceite

---

# 🧪 FASE 2 — QA PÓS-IMPLEMENTAÇÃO

## Objetivo
Garantir que tudo funciona em produção.

## Ações obrigatórias

### Testes Funcionais
- Validar front + back integrados
- Testar:
  - CRUD
  - Estados (loading, erro, vazio)
  - Fluxos alternativos

### Testes de UI/UX
- Validar responsividade
- Validar Design System
- Validar consistência visual

## Testes avançados
- Teste de carga
- Teste de stress
- Teste de concorrência

## Testes de contrato
- Garantir consistência entre frontend e backend

### Segurança
- XSS
- CSRF
- validações

### Performance
- Re-render
- Requests duplicados
- Payload

---

## 🧪 Testes automatizados

Criar:

- Unitários
- Integração
- E2E (Playwright)

---

## 📦 Saída final

### 🐞 Bugs encontrados
### 🎨 Problemas de UI/UX
### 🔒 Vulnerabilidades
### ⚡ Melhorias de performance
### 🧪 Testes criados

---

## ⚠️ Regra obrigatória
A FASE 2 só pode acontecer após:
- Front concluído
- Back concluído

Se houver falhas:
- Corrigir antes de finalizar o fluxo