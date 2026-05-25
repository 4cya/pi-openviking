# Gap 03 — `memlink` / Grafo de Relações

## Definição

O OpenViking oferece um sistema completo de **grafo de conhecimento**
através dos endpoints:
- `POST /api/v1/relations/link` — criar aresta entre dois recursos
- `DELETE /api/v1/relations/link` — remover aresta
- `GET /api/v1/relations` — consultar relações de um recurso
- `POST /api/v1/relations/build_graph` — reconstruir grafo completo

O pi-openviking **não utiliza nenhum destes endpoints**. O sistema de
auto-recall busca memórias por similaridade semântica isoladamente, sem
navegar por arestas de relação entre recursos.

Isso significa que o agente não consegue:
- Ligar uma decisão de arquitetura ao ADR que a gerou
- Conectar um bug report ao commit que o corrigiu
- Navegar de uma memória para recursos relacionados
- Usar o grafo para enriquecer o contexto injetado

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Ligar decisão à evidência** | `memlink docs/adr-001.md docs/benchmark-results.md "fundamenta"` |
| **Cadeia causal** | Bug report → Investigation → Fix commit → Test result |
| **Auto-recall expandido** | Ao achar memória relevante, seguir arestas para recursos conexos e injetar também |
| **Mapa do projeto** | Agente pergunta "o que está relacionado a X?" e navega o grafo |
| **Rastreabilidade** | `memgraph docs/auth-flow.md` mostra dependências, decisões, referências |
| **Descoberta serendípita** | Grafo revela conexões que busca semântica não captura |

## Importância e Impacto da Correção

### 🔴 Crítico — Perde o diferencial mais poderoso do OV

O grafo de conhecimento é **o diferencial do OpenViking frente a soluções
de memória vetorial pura** (ex: mem0, LangMem). Sem ele, o OV vira um
"banco vetorial com protocolo HTTP" — útil, mas substituível.

### Impactos específicos:

1. **Contexto raso** — Auto-recall injeta só o que a similaridade
   semântica encontra. Relações causais, hierárquicas, de dependência
   ficam invisíveis.

2. **Memórias isoladas** — Cada memória/ recurso é uma ilha. O potencial
   de "navegar o conhecimento" (como a web) não existe.

3. **Sem raciocínio multi-hop** — O agente não consegue fazer
   "memória A → link → recurso B → link → recurso C" para responder
   perguntas complexas.

4. **Perda de rastreabilidade** — Não há como responder "por que essa
   decisão foi tomada?" ou "o que impacta esse código?".

5. **Subutilização do OV** — O servidor OV já indexa relações e oferece
   o endpoint. O custo de implementar é baixo comparado ao ganho.

### Esforço estimado de implementação

```
Médio (~4h kernel, ~2h auto-recall integration)
├── src/operations/link.ts            → linkOp(), unlinkOp(), graphOp()
├── src/tools/link.ts                 → memlink tool
├── src/commands/link.ts              → /ov-link command
├── src/ov-client/client.ts           → add link/unlink/graph ao KnowledgeClient
├── src/auto-recall/expand-graph.ts   → follow edges from seed memories
└── src/bootstrap/register.ts         → registrar
```

### API OV necessária

```http
# Criar relação
POST /api/v1/relations/link
Content-Type: application/json

{
  "source": "viking://user/default/adrs/001-use-vite.md",
  "target": "viking://user/default/benchmarks/vite-vs-webpack.md",
  "predicate": "supported_by"
}

# Consultar grafo
GET /api/v1/relations?uri=viking://user/default/adrs/001-use-vite.md
```
