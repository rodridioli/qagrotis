---
name: qa
description: QA de ciclo completo — execute ANTES da implementação (para definir critérios de aceite e cenários BDD) e DEPOIS da implementação (para validar que tudo funciona). Use esta skill sempre que o usuário pedir para criar testes, validar uma feature, revisar qualidade, ou quando o orquestrador chamar QA pré ou pós.
---

# QA

Qualidade é definida antes de existir, não descoberta depois.

**Identifique em qual fase você está antes de agir: PRÉ ou PÓS.**

---

## FASE PRÉ — Definir o que "funciona" significa

Execute **antes** de qualquer código.

### Cenários BDD

```gherkin
Dado que [contexto/pré-condição]
Quando [ação do usuário ou sistema]
Então [resultado esperado]
```

Cobrir obrigatoriamente:
- **Happy path** — tudo funciona como esperado
- **Fluxos alternativos** — caminhos válidos mas não ideais (ex: registro duplicado, sem dados)
- **Casos de borda** — injeção/caracteres especiais, números extremos, duplo submit/concorrência, timeout/rede lenta

### Critérios de Aceite

Condições **objetivas e verificáveis** — sem linguagem vaga. Exemplos corretos:
- ✅ "Retorna 200 com campo `id` preenchido"
- ✅ "Toast de sucesso aparece em < 500ms"
- ❌ "Deve funcionar bem"

Inclua: comportamento visual esperado, mensagens exatas de feedback, performance aceitável (ex: < 2s).

### Riscos Identificados

Liste: pontos de falha prováveis, dependências externas (auth, banco, API), condições de corrida, edge cases de timezone/locale.

---

## FASE PÓS — Garantir que funciona em produção

Execute **após** Front + Back concluídos. O UI Checker já validou tokens e padrões visuais — foque em integração e automação.

### Validação Funcional

- Integração real Front ↔ Back (não testar isolado)
- CRUD completo com persistência verificada
- Todos os estados de UI: loading, erro, vazio, sucesso
- Fluxos alternativos e casos de borda da FASE PRÉ

### Segurança Básica

- XSS: inputs não executam script
- Autorização: usuário sem permissão não acessa dados de outro usuário
- Dados sensíveis ausentes em logs e respostas

### Testes Automatizados (Obrigatório)

**Stack**: Vitest (unit/integration) + Playwright (E2E)

```typescript
// Vitest — unit/integration
describe('Feature', () => {
  it('deve [comportamento] quando [condição]', () => {
    // arrange → act → assert
  })
})

// Playwright — E2E (e2e/*.spec.ts)
test('happy path: [descrição]', async ({ page }) => {
  await page.goto('/rota')
  await page.getByTestId('acao').click()
  await expect(page.getByTestId('resultado')).toBeVisible()
})
```

Cobrir obrigatoriamente:
- **Vitest**: services, validações Zod, utilitários, casos de borda — **sem mock de banco** (use banco de teste real)
- **Playwright**: happy path completo + principal caso de erro

---

## Saída da FASE PÓS

```
✅ APROVADO → avançar para Reviewer
🚫 BLOQUEADO → listar bugs com severidade (blocker/major/minor) e passos para reproduzir

Testes criados: [arquivos] | BDDs cobertos: [N/total]
Vulnerabilidades: [descrever ou "nenhuma"]
```

❌ **Não avançar para Reviewer** se houver bugs blockers ou vulnerabilidades críticas.
