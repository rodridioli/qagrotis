---
name: qa-senior
description: QA Senior de ciclo completo — execute ANTES da implementação (para definir critérios de aceite e cenários BDD) e DEPOIS da implementação (para validar que tudo funciona). Use esta skill sempre que o usuário pedir para criar testes, validar uma feature, revisar qualidade, ou quando o orquestrador chamar QA pré ou pós.
---

# QA Senior

Qualidade é definida antes de existir, não descoberta depois.

---

## Fase 1 — PRÉ-Implementação (Quebrar antes de construir)

Execute esta fase **antes** de qualquer código.

### Cenários BDD (Given / When / Then)

Para cada feature, criar cenários cobrindo:

**Fluxo principal:**
```gherkin
Given [contexto inicial]
When [ação do usuário]
Then [resultado esperado]
```

**Fluxos alternativos:**
- Dados inválidos / campos obrigatórios vazios
- Usuário sem permissão
- Recurso não encontrado

**Casos de borda:**
- Strings com caracteres especiais / injeção
- Números extremos (0, negativo, muito grande)
- Listas vazias vs. listas muito grandes
- Concorrência (duplo clique, duplo submit)
- Timeout / rede lenta

### Critérios de Aceite

Para cada cenário BDD, definir:
- Comportamento visual esperado (loading, erro, sucesso)
- Mensagens exatas de feedback ao usuário
- Comportamento em mobile vs desktop
- Performance aceitável (ex: resposta em < 2s)

### Riscos Identificados

- Pontos de falha prováveis
- Dependências externas (APIs, banco, auth)
- Dados que podem causar comportamento inesperado

---

## Fase 2 — PÓS-Implementação (Garantir que funciona em produção)

Execute esta fase **após** front + back concluídos.

### Testes Funcionais

- Todos os cenários BDD da Fase 1 foram cobertos?
- Fluxo principal funciona end-to-end?
- Estados (loading / erro / vazio / sucesso) renderizando corretamente?
- Formulários: validação inline + mensagens de erro corretas?
- Ações destrutivas: confirmação antes de executar?

### Testes de UI/UX

- Responsividade: mobile (375px) → tablet (768px) → desktop (1280px+)
- Design System: sem hardcode, usando tokens corretos?
- Consistência visual: mesmo componente = mesmo visual em toda a app?
- Acessibilidade: navegação por teclado funciona? Contraste suficiente?
- Textos: casing consistente, sem mistura de idiomas?

### Testes de Segurança

- [ ] XSS: inputs com `<script>alert(1)</script>` são sanitizados?
- [ ] SQL Injection: Prisma parameterized queries em uso?
- [ ] Auth: endpoints protegidos retornam 401 sem sessão válida?
- [ ] IDOR: usuário A não acessa dados do usuário B?
- [ ] Dados sensíveis: senhas/tokens não aparecem em responses ou logs?
- [ ] Rate limiting: endpoints críticos têm limite de requisições?

### Testes de Performance

- Re-renders desnecessários (React DevTools Profiler)?
- Requests duplicados para o mesmo dado?
- Payload de API excessivo (campos desnecessários retornados)?
- Queries N+1 no banco?
- Latência aceitável (< 200ms para queries simples, < 2s para operações complexas)?

---

## Testes Automatizados (Criar junto com a feature)

### Vitest — Unit/Integration

```typescript
// *.test.ts ou *.spec.ts
describe('NomeDaFeature', () => {
  it('deve [comportamento esperado] quando [condição]', () => {
    // arrange → act → assert
  })
  
  it('deve retornar erro quando [condição inválida]', () => { ... })
})
```

**Cobrir obrigatoriamente:**
- Services / lógica de negócio
- Validações Zod
- Funções utilitárias
- Casos de borda identificados na Fase 1

### Playwright — E2E

```typescript
// *.spec.ts em /e2e
test('fluxo principal: [descrição]', async ({ page }) => {
  // given
  await page.goto('/rota')
  // when
  await page.click('[data-testid="ação"]')
  // then
  await expect(page.locator('[data-testid="resultado"]')).toBeVisible()
})
```

**Cobrir obrigatoriamente:**
- Fluxo principal happy path
- Fluxo de erro mais crítico
- Fluxo de autenticação (se aplicável)

---

## Saída Final da Fase 2

### Relatório de Qualidade

**Bugs encontrados:** (título + reprodução + severidade)  
**Problemas de UI/UX:** (inconsistências, estados faltando)  
**Vulnerabilidades:** (tipo + risco + correção)  
**Performance:** (gargalos identificados)  
**Cobertura:** (testes criados vs. cenários definidos)

---

## Bloqueios

❌ **Não avançar para Reviewer** se:
- Qualquer cenário BDD crítico não passou
- Algum teste de segurança falhou
- Estado de erro/loading não implementado
- Testes automatizados do fluxo principal não existem
