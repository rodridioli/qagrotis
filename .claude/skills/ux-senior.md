---
name: ux-senior
description: Gate de entrada UX obrigatório antes de qualquer implementação. Define fluxo do usuário, estados da interface, estrutura da tela e padrões de texto. Use SEMPRE que o usuário pedir para criar, modificar ou planejar qualquer tela, componente ou fluxo. Nunca gere código de UI sem passar por esta skill primeiro.
---

# UX Senior

Nenhum código de UI é escrito antes deste gate passar.

---

## Ações Obrigatórias

### 1. Mapear Fluxo do Usuário
- Identificar ponto de entrada e saída
- Listar todas as ações possíveis
- Mapear fluxos alternativos e de erro
- Identificar dependências com outras telas

### 2. Definir Estados da Interface

| Estado   | O que mostrar                          |
|----------|----------------------------------------|
| loading  | Skeleton (nunca spinner genérico)      |
| erro     | Mensagem amigável + ação de recuperação|
| vazio    | Ilustração + CTA orientativo           |
| sucesso  | Feedback visual imediato               |
| parcial  | Progress indicator quando aplicável    |

### 3. Estrutura da Tela (Wireframe Descritivo)
- Hierarquia de informação (o que é primário/secundário)
- Posição e agrupamento dos componentes
- Responsividade: mobile → tablet → desktop
- Hierarquia de ações (primária / secundária / destrutiva)

### 4. Regras de Interação
- Feedback imediato em toda ação do usuário
- Confirmação antes de ações destrutivas
- Validação inline em formulários (não só no submit)
- Timeouts e retentativas em operações longas

---

## Padronização de Texto (CRÍTICO)

Toda inconsistência textual é um bug de UX.

### Regras de Casing
- Escolher **Sentence case** ou **Title Case** — nunca misturar
- Aplicar consistentemente em: botões, labels, títulos, toasts, mensagens de erro

### Regras de Vocabulário
- Mesmo conceito → mesmo termo em toda a aplicação
- Exemplos do que evitar:
  - "Salvar" em um lugar, "Gravar" em outro
  - "Mês Atual" vs "Mês atual"
  - "Usuários" vs "Users" (não misturar idiomas)

### Validar em:
- Labels de formulários
- Opções de select/combobox
- Títulos de modais e páginas
- Botões de ação
- Mensagens de toast (sucesso, erro, aviso)
- Estados vazios
- Textos de confirmação

---

## Lista de Componentes Necessários

Para cada componente identificado, especificar:
- Nome do componente (verificar se existe no Design System)
- Variante necessária
- Se não existir: solicitar criação via `front-senior`

---

## Saída Obrigatória

1. **Fluxo do usuário** (lista de passos)
2. **Estrutura da tela** (wireframe descritivo por seção)
3. **Tabela de estados** (loading/erro/vazio/sucesso para cada área)
4. **Regras de texto** (casing + vocabulário padronizado)
5. **Lista de componentes** (existentes + a criar)
6. **Critérios de aceite UX** (o que valida que está pronto)

---

## Bloqueios

❌ Não avançar para `front-senior` se:
- Estados de erro/loading/vazio não estiverem definidos
- Houver inconsistência de vocabulário não resolvida
- Hierarquia de ações não estiver clara
- Responsividade não estiver especificada
