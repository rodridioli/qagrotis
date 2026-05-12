# Documentação de Telas — QAgrotis

Este diretório documenta todas as telas da aplicação QAgrotis.

## Índice

| Tela | Arquivo | Rota |
|------|---------|------|
| Autenticação (Login / Definir Senha) | [auth.md](auth.md) | `/login`, `/definir-senha/[token]` |
| Dashboard | [dashboard.md](dashboard.md) | `/dashboard` |
| Cenários | [cenarios.md](cenarios.md) | `/cenarios` |
| Suítes | [suites.md](suites.md) | `/suites` |
| Equipe (Chapters) | [equipe.md](equipe.md) | `/equipe` |
| Feedbacks | [feedbacks.md](feedbacks.md) | `/feedbacks` |
| Individual | [individual.md](individual.md) | `/individual` |
| Gerador de Cenários (IA) | [gerador.md](gerador.md) | `/gerador` |
| Config — Clientes | [config-clientes.md](config-clientes.md) | `/configuracoes/clientes` |
| Config — Credenciais | [config-credenciais.md](config-credenciais.md) | `/configuracoes/credenciais` |
| Config — Sistemas | [config-sistemas.md](config-sistemas.md) | `/configuracoes/sistemas` |
| Config — Módulos | [config-modulos.md](config-modulos.md) | `/configuracoes/modulos` |
| Config — Usuários | [config-usuarios.md](config-usuarios.md) | `/configuracoes/usuarios` |
| Config — Modelos de IA | [config-modelos-ia.md](config-modelos-ia.md) | `/configuracoes/modelos-de-ia` |
| RBAC — Controle de Acesso | [rbac.md](rbac.md) | — |

## Convenções

- **Acesso**: quem pode ver a tela (todos autenticados, apenas admin, etc.)
- **Estados**: loading, vazio, erro, sucesso
- **RBAC**: capabilities necessárias por ação
- **Validações**: regras de negócio aplicadas no front e back
