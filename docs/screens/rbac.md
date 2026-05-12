# RBAC — Controle de Acesso por Papel

**Implementação:** `src/core/rbac/policy.ts`

## Papéis (Roles)

| UserType | AccessProfile | Role ID |
|----------|--------------|---------|
| Padrão | QA | `padrao-qa` |
| Padrão | UX | `padrao-ux` |
| Padrão | TW | `padrao-tw` |
| Administrador | QA | `admin-qa` |
| Administrador | UX | `admin-ux` |
| Administrador | TW | `admin-tw` |
| Administrador | MGR | `admin-mgr` |

## Capabilities por Tela

| Capability | Descrição | Quem tem |
|------------|-----------|---------|
| `menu.cenarios` | Ver cenários no menu | Todos |
| `menu.suites` | Ver suítes no menu | Todos |
| `menu.gerador` | Ver gerador de IA | Todos |
| `menu.equipe` | Ver equipe | Todos |
| `menu.individual` | Ver área individual | Todos |
| `menu.configuracoes` | Ver configurações | Todos |
| `menu.configuracoes.clientes` | Ver clientes | Todos |
| `menu.configuracoes.sistemas` | Ver sistemas | Todos |
| `menu.configuracoes.modulos` | Ver módulos | Todos |
| `menu.configuracoes.credenciais` | Ver credenciais | Todos |
| `menu.configuracoes.usuarios` | Ver usuários | Todos |
| `menu.configuracoes.modelos-ia` | Ver modelos de IA | Admin |
| `individual.view-others` | Ver dados de outros | Admin MGR |

## Funções de verificação

```typescript
import { buildRole, can, isVisible, isDisabled } from "@/core/rbac/policy"

const role = buildRole(user.type, user.accessProfile)
const podeVerConfig = can(role, "menu.configuracoes")
const campoVisivel = isVisible(role, "campo-x")
const campoDesabilitado = isDisabled(role, "campo-y")
```

## requireAdmin / requireSession

- `requireAdmin()` — lança erro se não for Administrador (server actions)
- `requireSession()` — lança erro se não autenticado (server actions)

**Implementação:** `src/core/session.ts`
