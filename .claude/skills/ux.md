---
name: ux
description: Gate de entrada UX obrigatório antes de qualquer implementação. Define fluxo do usuário, estados da interface, estrutura da tela, acessibilidade, micro-interações e padrões de texto. Use SEMPRE que o usuário pedir para criar, modificar ou planejar qualquer tela, componente ou fluxo. Nunca gere código de UI sem passar por esta skill primeiro.
---

# UX

Nenhum código de UI é escrito antes deste gate passar.
**[RESTRIÇÃO ABSOLUTA: NO CODE]** — A saída é puramente conceitual: listas, tabelas e fluxos. Nenhum JSX, CSS ou TypeScript.

---

## Princípios

- **Clareza antes de estética** — compreensão > beleza
- **Mobile-first real** — projete para 375px e escale, nunca o contrário
- **Acessibilidade não é opcional** — WCAG AA, teclado, sem dependência exclusiva de cor
- **Nunca invente padrão** — se não existe no DS, sinalize "a criar" antes de propor
- **Fricção mínima** — questione cada campo e cada passo; elimine o que não agrega

---

## Ações Obrigatórias

### 1. Fluxo do Usuário
Mapeie o caminho completo em linguagem direta:
> "Usuário clica em X → sistema exibe Y → usuário preenche Z → sistema confirma"

Inclua: ponto de entrada, saída, fluxos alternativos e fluxos de erro extremo.

### 2. Matriz de Estados

| Estado    | O que mostrar |
|-----------|---------------|
| loading   | Skeleton com dimensões reais (nunca spinner genérico em listas/cards) |
| erro      | Mensagem amigável + ação de recuperação |
| vazio     | Ícone + texto orientativo + CTA |
| sucesso   | Toast via sonner |
| bloqueado | Quando e por que elementos ficam inativos |

### 3. Wireframe Descritivo + Tokens Semânticos

Defina hierarquia visual em texto com intenção semântica dos tokens:
- "Fundo do card" → `Surface Card` (não "cinza claro")
- "Texto secundário" → `Text Muted` (não "cinza #999")
- Hierarquia de ações: Primária / Secundária / Destrutiva
- Liste componentes necessários marcando `[existente]` ou `[a criar]`

### 4. Micro-interações

Defina comportamentos dinâmicos:
- **Hover/Active**: o que acontece ao interagir? (ex: linha de tabela ganha highlight, botão escala levemente)
- **Transições**: como modais abrem, como alertas surgem
- **Feedback**: sensação visual da ação concluída

### 5. Acessibilidade (A11y)

O Front-end não adivinha — especifique:
- Ícones interativos que precisam de `aria-label`
- Ordem de navegação por teclado (`Tab`)
- Focus trap em modais/drawers + restore ao fechar
- `aria-live` onde há atualizações dinâmicas (contadores, notificações, resultados)

### 6. Padronização de Texto (CRÍTICO)

Inconsistência textual é um bug de UX.

**Casing**: escolha Sentence case ou Title Case — aplique em tudo (botões, títulos, labels, toasts). Nunca misture.

**Vocabulário**: mesmo conceito = mesma palavra. Proibido: "Salvar" vs "Gravar", PT-BR vs inglês isolado ("Submit", "Cancel").

**Especifique exatamente**: textos de toast (sucesso/erro/aviso), confirmações destrutivas, estados vazios, mensagens de erro.

---

## Saída + Checklist (Entregar Juntos)

Apresente o relatório com estes 6 itens e confirme o checklist antes de liberar:

1. **Fluxo** — caminho feliz e triste
2. **Wireframe + Tokens** — estrutura e intenções semânticas
3. **Tabela de Estados** — todos os 5 estados
4. **Interações + A11y** — micro-animações, focus trap, aria
5. **Copywriting** — textos exatos e casing
6. **Componentes** — existentes vs a criar

**Checklist de saída:**
- [ ] Todos os estados definidos (incluindo bloqueado)?
- [ ] Mobile descrito?
- [ ] Fluxo alternativo (erro de rede, sem permissão) coberto?
- [ ] Casing e vocabulário consistentes?
- [ ] Nenhum padrão inventado fora do DS?
- [ ] Micro-interações e responsividade especificadas?

---

## 🛑 Bloqueios

❌ Estados de erro, loading ou vazio não definidos  
❌ Mistura de idiomas ou vocabulários  
❌ Responsividade ou micro-interações não especificadas  
❌ Qualquer código de UI gerado nesta fase
