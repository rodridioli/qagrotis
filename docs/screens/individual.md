# Tela: Individual

**Rota:** `/individual`  
**Acesso:** Cada usuário vê apenas seus próprios dados; Admin MGR vê todos  
**Arquivo:** `src/app/(protected)/individual/`

## Descrição

Área pessoal do usuário com avaliações de desempenho, feedbacks e progressões de carreira.

## Seções (tabs)

| Seção | Rota | Descrição |
|-------|------|-----------|
| Meu Perfil | `/individual/perfil` | Dados pessoais, formação, horários |
| Minhas Avaliações | `/individual/minhas-avaliacoes` | Avaliações 180° do próprio usuário |
| Meus Feedbacks | `/individual/meus-feedbacks` | Feedbacks recebidos pelo usuário |
| Avaliações | `/individual/avaliacoes` | Admin MGR: ver todas as avaliações |
| Feedbacks | `/individual/feedbacks` | Admin MGR: ver/criar todos os feedbacks |
| Progressões | `/individual/progressoes` | Admin MGR: histórico salarial/PLR |

## Avaliação de Desempenho

- 23 competências com pesos (0,2 a 1,0)
- Score calculado por `computePerformanceScorePercent()` em `src/features/individual/lib/`
- Níveis: Não Atende (0), Parcialmente (1), Em Desenvolvimento (2), Esperado (3), Excelente (4)
- Gera PDF com os resultados

## Feedbacks

- Tipos: Positivo, Construtivo, 360 (TREZENTOS_SESSENTA)
- Feedback 360 tem campos específicos além dos padrões

## Progressões

- Regimes: CLT, PJ, COOPERADO
- Histórico de aumentos/mudanças com data e valor

## RBAC

- `can(role, 'menu.individual')` — visibilidade do menu
- `can(role, 'individual.view-others')` — ver dados de outro usuário (Admin MGR)
- Usuário Padrão: vê apenas próprios dados
