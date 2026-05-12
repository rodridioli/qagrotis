# Tela: Gerador de Cenários

**Rota:** `/gerador`  
**Acesso:** Todos os usuários autenticados  
**Arquivo:** `src/app/(protected)/gerador/`

## Descrição

Interface de geração de cenários de teste via IA. Usa as integrações cadastradas em Configurações → Modelos de IA. Suporta streaming de resposta em tempo real.

## Pré-requisitos

- Pelo menos uma integração ativa em `/configuracoes/modelos-de-ia`
- Se não houver integração, exibe mensagem orientando o administrador a configurar

## Rate Limiting

| Tipo | Limite |
|------|--------|
| Geração | 30 requisições / hora |
| Validação de API Key | 10 requisições / minuto |

## Funcionalidades

- **Seletor de modelo** — lista apenas integrações ativas (`getIntegracoesSafe()`)
- **Campo de prompt** — descrição do que deve ser testado
- **Streaming** — resposta exibida em tempo real
- **Validar API Key** — verifica se a API Key da integração está funcionando
- **Importar gerados** — cenários gerados podem ser importados diretamente para `/cenarios`

## Segurança

- API Key nunca é exposta no cliente — `getIntegracoesSafe()` omite o campo `apiKey`
- Rate limit via `src/core/rate-limit.ts` ou similar

## Estados

| Estado | Comportamento |
|--------|--------------|
| Sem integração | EmptyState com link para configurar |
| Loading de resposta | Indicador de streaming ativo |
| Erro de API | Mensagem de erro da IA exibida inline |
| Rate limit atingido | Mensagem clara com tempo de espera |
