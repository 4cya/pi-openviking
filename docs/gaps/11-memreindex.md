# Gap 11 — `memreindex` / Reindexação Forçada de Conteúdo

## Definição

O OpenViking expõe `POST /api/v1/content/reindex`, que força a
reindexação de um recurso ou subárvore. Útil quando:
- O conteúdo de um recurso foi alterado diretamente (via write-back)
- O embedding parece desatualizado ou incorreto
- Um recurso não aparece em buscas onde deveria aparecer

O pi-openviking **não expõe este endpoint**. Não há como o agente ou
usuário solicitar reindexação.

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Pós write-back** | Após `memsave` alterar conteúdo, reindexar para busca encontrar |
| **Correção de embedding** | Recurso existe mas não aparece em buscas relevantes |
| **Reparo** | Após migração/restore, reindexar lote para garantir consistência |
| **Debug** | "Esse recurso deveria aparecer nessa busca mas não aparece" → reindex |
| **Pós-import** | Garantir que recurso importado está indexado antes de usar |

## Importância e Impacto da Correção

### 🟢 Baixo — Operacional, nicho

Reindex é uma ferramenta de reparo. A maioria dos usuários nunca vai
precisar. Mas quando precisar, não ter a opção é frustrante.

### Impactos específicos:

1. **Write-back sem efeito na busca** — Se `memsave` escreve conteúdo
   mas não reindexa, o novo conteúdo pode não aparecer em buscas
   semânticas.

2. **Sem auto-repair** — Se um embedding ficou corrompido (ex: modelo
   de embedding mudou), não há como forçar regeneração.

3. **Dependência do fluxo normal** — Só confiando no reindex automático
   do servidor OV, que pode ter delay.

### Esforço estimado de implementação

```bash
Mínimo (~30min)
├── src/operations/reindex.ts    → reindexOp()
├── src/tools/reindex.ts         → memreindex tool
├── src/commands/reindex.ts      → /ov-reindex
├── src/ov-client/client.ts      → add reindex() ao FsClient
└── src/bootstrap/register.ts    → registrar
```

### API OV necessária

```http
POST /api/v1/content/reindex
Content-Type: application/json

{
  "uri": "viking://user/default/memories/decisions/",
  "recursive": true
}
```
