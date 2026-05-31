# Dashboard TW — Sincronização de Worklogs e Cálculo Trimestral

## Fluxo de dados

```
Jira API
  └─► syncMonthsForUser()          — busca worklogs por mês via JQL
        └─► JiraWorklogCache (DB)  — upsert por (userId, issueKey, startedAt)
              └─► getUxWorklogsForYear()  — serve cache filtrado por (userId, year)
                    └─► TwDashboardClient — calcula horas, investimento e contagens por mês
```

## Política de sincronização (needsSync)

| Situação | Comportamento |
|---|---|
| Mês > currentMonth (futuro) | Nunca sincroniza |
| Mês atual ou anterior imediato | Re-sincroniza diariamente |
| Meses mais antigos | Serve do cache (imutável) |
| `force=true` (botão Atualizar) | Apaga cache do ano e re-sincroniza todos os meses até o atual |

## Cálculo de investimento

```
investimento (centavos) = ∑ round((timeSpentSeconds / 3600) × valorHora)
```

- `valorHora` vem de `IndividualProgressao` em **centavos** (ex: R$28,00/h → `2800`)
- É buscado por `getValorHoraForMonth()` usando o histórico DESC — retorna a taxa vigente no último dia do mês
- Se o usuário não tiver progressão cadastrada, `valorHora = null` e o investimento desse membro é `R$0,00`

## Por que os números podem divergir de um levantamento manual

1. **Membro sem sync**: se o e-mail do membro no sistema não existe no Jira, `findJiraAccountIdByEmail` retorna `null` e o sync é abortado. O membro contribui 0 horas. Verifique os logs `[tw-sync]` no servidor.
2. **valorHora não cadastrado**: membro sem `IndividualProgressao` tem horas contadas mas investimento zerado.
3. **Coluna "Aguardando" (AvatarStrip)**: o dashboard mostra o status atual das issues no Jira, não o histórico do período.
4. **Fuso horário**: worklogs registrados perto da virada do mês podem cair no mês seguinte (UTC vs UTC-3).

## Como diagnosticar um membro sem dados

1. Abra os logs do servidor (Vercel Logs ou console local) e filtre por `[tw-sync]`
2. Se aparecer `email=X não encontrado no Jira`, verifique se o e-mail em `CreatedUser` bate exatamente com o e-mail da conta Jira do membro
3. Se não aparecer nenhum log para o membro, o cache já existe — use o botão **Atualizar** na tela (force=true) para forçar re-sync

## Badge de aviso no AvatarStrip

O ícone `⚠` amarelo aparece no avatar quando `rawMemberEntries[userId].length === 0` após o carregamento. Indica que nenhum worklog foi encontrado no cache para o ano selecionado. O tooltip exibe o nome do membro e instrução para verificar o e-mail.
