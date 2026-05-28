# Tela: PDI (Plano de Desenvolvimento Individual)

**Rota:** `/pdi`  
**Acesso:** Todos os usuários autenticados (visível como item desabilitado para todos os perfis)  
**Arquivo:** `src/app/(protected)/pdi/page.tsx`

## Descrição

Tela reservada para o módulo de PDI — em desenvolvimento. Exibe mensagem "Em desenvolvimento." no centro da página.

## Estado Atual

`Em desenvolvimento` — sem funcionalidade implementada.

## RBAC

| Capability | Roles |
|---|---|
| `menu.pdi` | Nenhum (aparece como `disabled` para todos os roles) |

O item é visível no menu lateral como desabilitado (cinza) para todos os perfis, via `isDisabled()` no RBAC.

## Observações

- Quando implementado, deverá cobrir planejamento de desenvolvimento individual por colaborador.
- A rota existe mas está protegida pelo layout `(protected)` — usuários não autenticados são redirecionados para login.
