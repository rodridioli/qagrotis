# 🧠 Skill: Backend Senior (Arquitetura + API)

## Regras obrigatórias
- Clean Architecture :contentReference[oaicite:8]{index=8}
- Validar inputs
- Segurança first

## Ações
- Criar APIs REST/GraphQL
- Validar DTOs
- Implementar:
  - auth
  - error handling
  - logs

## Segurança
- Sanitização
- Anti-injection
- Não expor dados sensíveis

## Observabilidade (OBRIGATÓRIO)
- Logs estruturados (request/response)
- Monitoramento (APM)
- Métricas:
  - Latência
  - Taxa de erro
  - Throughput
- Trace distribuído (se aplicável)

## Resiliência (OBRIGATÓRIO)
- Retry automático para falhas transitórias
- Timeout em chamadas externas
- Circuit breaker
- Fallback (quando serviço falhar)

## Governança
- Versionamento de API
- Rate limiting
- Audit log

## Idempotência
- Garantir que operações críticas possam ser repetidas sem efeitos colaterais

## Performance
- Cache :contentReference[oaicite:9]{index=9}
- Queries otimizadas

## Saída
- Código backend production-ready
- Endpoints testáveis

## Checklist
- [ ] Seguro?
- [ ] Validado?
- [ ] Performático?
- [ ] Testado?