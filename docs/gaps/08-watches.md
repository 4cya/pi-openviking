# Gap 08 — Watches / Observação de Mudanças em Recursos

## Definição

O OpenViking expõe um sistema de watches que permite observar
mudanças em recursos do filesystem `viking://`:
- `POST /api/v1/watches` — criar watch (com URI pattern opcional)
- `GET /api/v1/watches` — listar watches ativos
- `PATCH /api/v1/watches` — modificar watch por URI
- `DELETE /api/v1/watches` — remover watch por URI
- `POST /api/v1/watches/trigger` — disparar watch manualmente
- Endpoints por ID: `GET/PATCH/DELETE /api/v1/watches/{task_id}`

O pi-openviking **não utiliza nenhum endpoint de watch**. Não há
mecanismo para o agente reagir a mudanças no OV ou ser notificado
quando novos recursos são adicionados.

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Reação a novo recurso** | Quando um skill é importado, auto-recall passa a considerá-lo |
| **Cache warming** | Quando conteúdo muda, invalidar cache local (autocomplete, search results) |
| **Monitoramento de import** | Saber quando um `memimport` assíncrono terminou de processar |
| **Pipeline automático** | Watch em `viking://.../decisions/` → gatilho para revisão |
| **Status de extração** | Watch na task de `memcommit` → notificar quando memórias foram extraídas |

## Importância e Impacto da Correção

### 🟢 Baixo — Útil para automação, não para uso direto

Watches são mecanismos de infraestrutura. O benefício para o usuário
final é indireto (ex: autocomplete mais fresco, notificações de
processamento completo).

### Impactos específicos:

1. **Cache manual** — Autocomplete de `viking://` URIs tem cache TTL
   de 30s. Com watch, daria para invalidar na hora.

2. **Sem feedback de processamento** — `memimport` e `memcommit` são
   assíncronos. Não há como o agente saber quando terminaram sem
   polling manual (`getTaskStatus`).

3. **Estado defasado** — Sem watch, o plugin descobre mudanças só
   quando o usuário faz uma consulta.

### Esforço estimado de implementação

```
Médio (~3h — integração com event system do Pi)

├── src/operations/watch.ts      → watchOp(), unwatchOp(), listWatchesOp()
├── src/tools/watch.ts           → memwatch tool
├── src/commands/watch.ts        → /ov-watch
├── src/ov-client/client.ts      → add watch methods
├── src/bootstrap/hooks.ts       → wire on('watch_trigger') handler
└── src/bootstrap/register.ts    → registrar

```

### API OV necessária

```http
# Criar watch
POST /api/v1/watches
Content-Type: application/json

{
  "uri": "viking://user/default/memories/events/**",
  "webhook": "http://pi-agent:1933/internal/ov-watch-callback"
}

# Listar
GET /api/v1/watches

# Trigger manual
POST /api/v1/watches/trigger
Content-Type: application/json

{ "uri": "viking://user/default/memories/events/2026/05/24/" }
```
