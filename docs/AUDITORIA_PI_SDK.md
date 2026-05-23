# Auditoria: pi-openviking × Pi SDK — Gaps, Oportunidades e Melhorias

**Data:** 2026-05-23
**Escopo:** Documentação do agente Pi, recursos do SDK não utilizados, pontos de atrito, exemplos práticos
**Status:** 2.515 LOC | 7 ADRs | 29 test files | 6 tools + 6 commands

---

## 1. Recursos do Pi SDK Aplicáveis à Integração

### 1.1 Recursos JÁ Utilizados ✅

| Recurso SDK | Uso no Projeto | Localização |
|---|---|---|
| `ExtensionAPI.registerTool()` | 6 ferramentas (memsearch, memread, membrowse, memcommit, memdelete, memimport) | `src/shared/tool-def.ts` |
| `ExtensionAPI.registerCommand()` | 6 comandos (/ov-search, /ov-ls, etc.) | `src/shared/command-def.ts` |
| `pi.on("session_start")` | Bootstrap do sessionSync + health check | `src/index.ts` |
| `pi.on("message_end")` | Sync de mensagens para OV | `src/index.ts` |
| `pi.on("session_shutdown")` | Cleanup | `src/index.ts` |
| `pi.on("before_agent_start")` | Auto-recall (injeção de contexto no system prompt) | `src/bootstrap.ts` |
| `pi.appendEntry()` | Persistir `ov-session` ID na branch | `src/session-sync/session.ts` |
| `ctx.sessionManager` | Walk da branch para recuperar ovSessionId | `src/session-sync/session.ts` |
| `tool_result` details | Metadata nas respostas das ferramentas | `src/shared/tool-def.ts` |
| Pi Package (`"pi": {...}`) | Distribuição como extensão instalável | `package.json` |

### 1.2 Recursos NÃO Utilizados — Alto Impacto 🔴

#### A. Custom Rendering (`renderCall` / `renderResult`)

**O que é:** O Pi SDK permite renderizar customizada de tool calls e resultados no TUI, com cores temáticas, ícones e formatação rica.

**O gap:** As 6 ferramentas OV usam renderização padrão. Nenhuma define `renderCall` ou `renderResult`. Experiência visual genérica.

**Impacto:** Médio. O agente e o usuário veem output plaintext. Não diferencia visualmente memsearch de memread, etc.

**Exemplo prático:**

```typescript
// src/tools/search.ts — ANTES (genérico)
export function registerMemsearchTool(pi: ExtensionAPI, deps: ToolDeps) {
  defineTool(pi, deps, { name: "memsearch", ... });
}

// DEPOIS — com renderCall + renderResult customizados
import { Text } from "@mariozechner/pi-tui";

export function registerMemsearchTool(pi: ExtensionAPI, deps: ToolDeps) {
  pi.registerTool({
    name: "memsearch",
    // ... description, parameters, execute ...
    renderCall(args, theme) {
      const label = theme.fg("toolTitle", theme.bold("memsearch "));
      const query = theme.fg("dim", `"${args.query}"`);
      const mode = theme.fg("accent", args.mode ?? "auto");
      return new Text(`${label}${query} ${mode}`, 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details as { total?: number };
      const count = details?.total ?? 0;
      const icon = count > 0 ? theme.fg("success", "✓") : theme.fg("dim", "○");
      const text = theme.fg("muted", ` ${count} results`);
      return new Text(`${icon}${text}`, 0, 0);
    },
  });
}
```

#### B. Status Line (`ctx.ui.setStatus()`)

**O que é:** Footer persistente com status da extensão. Atualizável a cada evento.

**O gap:** Nenhuma indicação visual do estado da conexão OV. Usuário não sabe se OV está disponível sem executar um comando.

**Impacto:** Médio. Health check já existe (`healthChecker`) mas resultado fica invisível.

**Exemplo prático:**

```typescript
// src/index.ts — ADICIONAR status de saúde no footer
import { notifyOnce } from "./shared/notify";

export default function openVikingExtension(pi: ExtensionAPI) {
  let sessionSync: SessionSync | undefined;

  pi.on("session_start", async (_event, ctx) => {
    if (!sessionSync) {
      const result = bootstrapExtension(pi, {
        cwd: ctx.cwd,
        sessionManager: ctx.sessionManager,
      });
      sessionSync = result.sessionSync;

      // Status de saúde do OV no footer
      const hc = result.healthChecker;
      const theme = ctx.ui.theme;
      if (hc.isAvailable()) {
        ctx.ui.setStatus("ov-status", theme.fg("success", "●") + theme.fg("dim", " OV"));
      } else {
        ctx.ui.setStatus("ov-status", theme.fg("error", "○") + theme.fg("dim", " OV"));
      }
    }
    sessionSync.onSessionStart();
  });

  pi.on("turn_end", async (_event, ctx) => {
    // Atualizar status após cada turno (health pode ter mudado)
    // Implementação no healthChecker com callback
  });
}
```

#### C. Custom Tool Rendering com `renderResult` para Tool Output Grande

**O que é:** Resultados truncados com expand/collapse visual. Evita flood do terminal.

**O gap:** `memread` e `memsearch` retornam textos longos. Output padrão do Pi trunca bruscamente. `formatSearch` gera blocos grandes sem indicação visual de truncamento.

**Impacto:** Médio-baixo. Funcional mas polui o histórico.

**Exemplo — renderResult expandido para memsearch:**

```typescript
renderResult(result, { expanded }, theme) {
  if (!expanded) {
    const details = result.details as SearchResult;
    const count = details?.total ?? 0;
    return new Text(
      theme.fg("muted", `${count} results — press Enter to expand`), 0, 0
    );
  }
  // Expanded: formatado com cores
  const lines = [];
  const details = result.details as SearchResult;
  for (const m of details.memories.slice(0, 5)) {
    const score = theme.fg("accent", m.score.toFixed(2));
    const text = theme.fg("text", m.text.slice(0, 100));
    lines.push(`  ${score} ${text}`);
  }
  return new Text(lines.join("\n"), 0, 0);
},
```

### 1.3 Recursos NÃO Utilizados — Médio Impacto 🟡

#### D. Autocomplete Providers (`addAutocompleteProvider`)

**O que é:** Autocomplete inline no editor. Exemplo: `#1234` expande para issues do GitHub.

**O gap:** Nenhum autocomplete para URIs Viking. Usuário precisa digitar `viking://user/...` completo.

**Exemplo prático:**

```typescript
pi.on("session_start", async (_event, ctx) => {
  ctx.ui.addAutocompleteProvider({
    // Autocomplete viking:// URIs quando o usuário digita "viking://"
    async complete(text) {
      if (!text.includes("viking://")) return [];
      const uri = text.match(/viking:\/\/\S*/)?.[0];
      if (!uri) return [];

      try {
        const result = await fsClient.fsList(uri);
        return result.children.map(c => ({
          text: c.uri,
          display: c.uri.split("/").pop() ?? c.uri,
          type: c.type === "directory" ? "directory" : "resource",
        }));
      } catch {
        return [];
      }
    },
  });
});
```

#### E. Widget / Footer Customizado (`ctx.ui.setWidget`)

**O que é:** Widget acima do editor. Renderiza linhas customizadas com refresh periódico.

**O gap:** Auto-recall status invisível. Usuário não sabe se auto-recall está ativo ou quantos itens foram injetados.

**Exemplo prático:**

```typescript
// No bootstrap, após auto-recall
pi.on("before_agent_start", async (event, ctx) => {
  if (!healthChecker.isAvailable()) return;
  const result = await autoRecall(event);
  autoRecallState.lastInjectedItems = result.injectedItems ?? [];

  // Widget: mostrar itens recallados
  if (result.injectedItems.length > 0 && ctx.hasUI) {
    const theme = ctx.ui.theme;
    const lines = [
      theme.fg("dim", `┌ OV Auto-Recall: ${result.injectedItems.length} memories injected`),
      theme.fg("dim", "└ Use memread to retrieve full content"),
    ];
    ctx.ui.setWidget("ov-recall", lines);
  }

  return result;
});
```

#### F. `session_tree` / `session_before_fork` Events

**O que é:** Eventos de branching do Pi. `session_tree` dispara após navigation, `session_before_fork` antes de criar branch.

**O gap:** Quando o usuário faz branch, o `ovSessionId` do branch pai vira lixo. O novo branch precisa criar uma nova sessão OV ou herdar a do ponto de fork. Atualmente, `onSessionStart` caminha a branch para encontrar `ov-session` entry — isso funciona, mas não é otimizado.

**Melhoria:** Reagir a `session_before_fork` para marcar o ponto de fork no OV:

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // Registrar no OV que este ponto é um fork point
  if (sessionSync?.getOvSessionId()) {
    const branchLabel = `fork-${Date.now()}`;
    // Marcar metadata no OV para rastreabilidade
    logger.debug("fork point marked:", branchLabel);
  }
});
```

#### G. `tool_call` Event Gate

**O que é:** Middleware que pode bloquear ou mutar tool calls antes da execução.

**O gap:** Nenhuma gate de proteção. Ferramentas OV (especialmente `memdelete`) não pedem confirmação.

**Exemplo prático — gate para memdelete:**

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "memdelete") {
    const uri = event.input?.uri;
    const ok = await ctx.ui.confirm(
      "Delete from OpenViking?",
      `About to delete: ${uri}\nThis cannot be undone.`
    );
    if (!ok) return { block: true, reason: "User cancelled deletion" };
  }
});
```

#### H. `tool_result` Middleware

**O que é:** Middleware que pode transformar resultados de ferramentas antes de chegar ao agente.

**O gap:** Resultados do memsearch chegam raw ao agente. Poderia enriquecer com sugestões automáticas:

```typescript
pi.on("tool_result", async (event) => {
  if (event.toolName === "memsearch" && !event.isError) {
    // Enriquecer com dica de próximo passo
    const content = event.content;
    const hasResults = content.some(c => c.type === "text" && c.text.includes("Total:") && !c.text.includes("Total: 0"));
    if (hasResults) {
      return {
        content: [...content, {
          type: "text",
          text: "\n💡 Tip: Use memread with a URI to get full content, or memimport to add new resources."
        }],
      };
    }
  }
});
```

### 1.4 Recursos NÃO Utilizados — Baixo Impacto 🟢

| Recurso | Uso Potencial | Prioridade |
|---|---|---|
| `pi.registerShortcut()` | Atalho para `/ov-commit` (ex: `Ctrl+O, C`) | Baixa |
| `pi.registerFlag()` | Flag `--no-ov` para desabilitar OV em uma sessão | Baixa |
| `pi.setModel()` | Trocar modelo se OV detectar que precisa de mais contexto | Muito baixa |
| `ctx.compact()` | Compactação customizada que preserva `relevant-memories` | Baixa |
| `ctx.getContextUsage()` | Adaptar auto-recall baseado no uso de contexto | Média |
| `ctx.getSystemPrompt()` | Já usado via `before_agent_start`, mas poderia ser mais direto | Baixa |
| `pi.registerMessageRenderer()` | Render customizado para entries do tipo `ov-session` | Baixa |
| `pi.setLabel()` | Label human-readable nas entries de sessão OV | Baixa |
| `pi.getSessionName()` / `pi.setSessionName()` | Nomear sessão OV com nome da sessão Pi | Baixa |

---

## 2. Pontos de Atrito na Integração

### 2.1 Atrito Atual — Configuração 🔴

**Problema:** Configuração totalmente manual via `.pi/settings.json` com chaves não-documentadas (`openVikingEndpoint`, `openVikingApiKey`, etc.). Nenhum comando de setup.

**Solução via Pi SDK:**

```typescript
pi.registerCommand("ov-setup", {
  description: "Configure OpenViking connection (interactive wizard)",
  handler: async (_args, ctx) => {
    if (!ctx.hasUI) return;

    const endpoint = await ctx.ui.prompt("OpenViking endpoint:", "http://localhost:1933");
    const apiKey = await ctx.ui.prompt("API Key:", "dev");

    // Ler settings atuais, mesclar, salvar
    const settingsPath = join(ctx.cwd, ".pi", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    settings.openVikingEndpoint = endpoint;
    settings.openVikingApiKey = apiKey;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    ctx.ui.notify("OpenViking configured! Use /reload to apply.", "success");
  },
});
```

### 2.2 Atrito Atual — Health Check Invisível 🔴

**Problema:** OV server down = ferramentas falham silenciosamente. Health check existe mas resultado é invisível. Usuário só descobre quando ferramenta retorna erro.

**Solução:** Status line (ver seção 1.2.B) + notificação proativa:

```typescript
pi.on("turn_start", async (_event, ctx) => {
  if (healthChecker && !healthChecker.isAvailable()) {
    const recovered = await healthChecker.check();
    if (recovered) {
      ctx.ui.notify("OpenViking server recovered!", "success");
      sessionSync.recover();
    }
    // Se ainda down, status line já mostra ○ OV (vermelho)
  }
});
```

### 2.3 Atrito Atual — Session Sync Opcional sem Feedback 🟡

**Problema:** `sessionSync` é fire-and-forget. Falhas consecutivas = circuit breaker silencioso. Usuário não sabe que parou de sincronizar.

**Solução:** Notificação quando circuit breaker abre:

```typescript
// No SessionSync, quando consecutiveFailures >= maxFailures:
if (this.consecutiveFailures === this.maxFailures) {
  // Callback para a extensão notificar
  this.opts.onCircuitOpen?.();
}

// No bootstrap:
const sessionSync = new SessionSync(sessionClient, {
  ...,
  onCircuitOpen: () => {
    pi.on("turn_end", async (_event, ctx) => {
      ctx.ui.notify("OV sync paused — server unreachable. Data buffered locally.", "warning");
    });
  },
});
```

### 2.4 Atrito Atual — Auto-Recall Não Adaptativo 🟡

**Problema:** Auto-recall gasta tokens fixos (budget: 700) independentemente do contexto disponível. Sessões com contexto cheio = desperdício. Sessões vazias = poderia injetar mais.

**Solução via `ctx.getContextUsage()`:**

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  if (!healthChecker.isAvailable()) return;

  // Adaptar budget baseado no uso de contexto
  const usage = ctx.getContextUsage();
  const adaptiveBudget = usage && usage.percent > 80
    ? Math.floor(config.curator.maxTokens * 0.5)  // Reduzir se contexto cheio
    : config.curator.maxTokens;

  const result = await autoRecall({
    ...event,
    maxTokens: adaptiveBudget,
  });

  autoRecallState.lastInjectedItems = result.injectedItems ?? [];
  return result;
});
```

### 2.5 Atrito Atual — Import de URLs sem Progresso 🟡

**Problema:** `memimport` com URL grande não mostra progresso. Usuário pensa que travou.

**Solução via `onUpdate`:**

```typescript
// src/tools/import.ts — já recebe onUpdate no execute
async execute({ params, deps, onUpdate }) {
  onUpdate?.({ content: [{ type: "text", text: "Fetching URL..." }] });
  const result = await deps.knowledge.addResource({ ... });
  onUpdate?.({ content: [{ type: "text", text: "Importing into OpenViking..." }] });
  // ...
}
```

---

## 3. Gaps de Documentação Identificados

### 3.1 Gaps Críticos 🔴

| Gap | Descrição | Ação |
|---|---|---|
| **Sem CHANGELOG.md** | Nenhuma documentação de evolução. Usuários não sabem o que mudou. | Criar `CHANGELOG.md` com entries por versão |
| **Sem CONTRIBUTING.md** | Não há guia para contribuidores externos. | Criar com setup steps, test commands, PR conventions |
| **README sem arquitetura visual** | Arquitetura Docker descrita em texto. Sem diagrama. | Adicionar mermaid diagram |
| **ADR-003 marcado "superseded" mas sem link de replacement** | Diz "superseded by ADR-006" mas não redireciona formalmente | Adicionar frontmatter `status: superseded` + `superseded_by: 0006` |

### 3.2 Gaps Médios 🟡

| Gap | Descrição | Ação |
|---|---|---|
| **Sem docs de troubleshooting** | Erros comuns (OV down, API key errada, timeout) não documentados | Criar `docs/TROUBLESHOOTING.md` |
| **Config keys não documentadas centralmente** | Chaves em `config.ts` espalhadas. README tem tabela mas incompleta | Criar `docs/CONFIGURATION.md` |
| **Sem docs de migração** | ADR-003→006 breaking changes sem guia de migração | Adicionar seção em cada ADR superseded |
| **Test coverage não reportado** | 29 test files mas sem `vitest --coverage` no CI | Adicionar coverage report |
| **Exemplo `.pi/settings.json` incompleto** | README mostra settings mas sem todos os campos possíveis | Expandir tabela |

### 3.3 Gaps Baixos 🟢

| Gap | Ação |
|---|---|
| Sem badges no README (build, coverage, version) | Adicionar shields.io badges |
| Sem docs de performance/benchmarks | Documentar latência típica das operações |
| Sem docs de security model | Documentar que API key viaja em header, sem HTTPS enforcement |
| `docs/ANALISE_DOCUMENTACAO_OV.md` desatualizado | Recomendações já implementadas em ADRs 006/007 |

---

## 4. Boas Práticas de Configuração e Uso do SDK

### 4.1 Estrutura de Extensão Recomendada

A estrutura atual está **boa**, mas pode ser otimizada:

```
src/
├── index.ts              # Entry point — OK, minimal ✅
├── bootstrap.ts          # Setup — OK, mas cresceu muito (109 linhas) ⚠️
├── ov-client/            # HTTP client — OK ✅
│   ├── client.ts         # Client adapters — OK ✅
│   ├── transport.ts      # HTTP transport — OK ✅
│   ├── types.ts          # OV types — OK ✅
│   ├── fs-ops.ts         # FS operations — OK ✅
│   └── session-ops.ts    # Session operations — OK ✅
├── session-sync/         # Session sync — OK, mas 347 linhas é grande ⚠️
│   └── session.ts
├── auto-recall/          # Auto-recall — OK ✅
│   ├── auto-recall.ts
│   └── recall-curator.ts # 280 linhas — candidato a split ⚠️
├── operations/           # Business logic — OK, boa separação ✅
├── tools/                # Tool definitions — OK ✅
├── commands/             # Command definitions — OK ✅
├── importer/             # URL/file import — OK ✅
└── shared/               # Shared utilities — OK ✅
    ├── config.ts         # Config cascade — OK ✅
    ├── tool-def.ts       # Tool helper — OK, mas poderia ser mais idiomático ⚠️
    ├── health.ts         # Health check — OK ✅
    └── format-*.ts       # Formatters — OK ✅
```

### 4.2 Boas Práticas NÃO Seguidas

#### BP-1: Async Factory Function para Health Check Inicial

**Atual:** Health check fire-and-forget no `bootstrapExtension`. Se OV estiver down no startup, ferramentas tentam e falham.

**Recomendado pelo SDK:** Async factory function — Pi aguarda antes de continuar:

```typescript
// src/index.ts — DEPOIS
export default async function openVikingExtension(pi: ExtensionAPI) {
  // Health check bloqueante no startup
  const config = loadConfig(process.cwd());
  const transport = createTransport(config);
  const healthChecker = createHealthChecker(transport, config.healthPath);
  const available = await healthChecker.check();

  if (!available) {
    // Registrar tools em modo degraded (retornam erro imediatamente)
    console.warn("[pi-openviking] Server unavailable — tools in degraded mode");
  }

  // Continuar com bootstrap normal
  pi.on("session_start", (_event, ctx) => {
    // ...
  });
}
```

#### BP-2: `defineTool` Poderia Usar `defineTool` do SDK

**Atual:** Helper custom `defineTool` em `src/shared/tool-def.ts` (104 linhas) reimprime lógica que o SDK já oferece.

**Recomendado:** Usar `defineTool` exportado do Pi SDK:

```typescript
import { defineTool } from "@earendil-works/pi-coding-agent";

// O SDK já exporta defineTool — usar diretamente
export const memsearch = defineTool({
  name: "memsearch",
  description: "...",
  parameters: SearchParams,
  async execute(params, { signal }) {
    // ...
  },
});
```

> **Nota:** Verificar se o `defineTool` do SDK suporta `promptSnippet`, `promptGuidelines`, `label` e `renderCall`/`renderResult`. Se sim, eliminar helper custom. Se não, manter mas documentar o delta.

#### BP-3: State Management via Session Entries

**Atual:** `ovSessionId` persistido via `pi.appendEntry("ov-session", { ovSessionId })`. Correto.

**Recomendado:** Também persistir health state e auto-recall state:

```typescript
// Persistir auto-recall toggle por sessão
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && (entry as any).customType === "ov-recall-state") {
      autoRecallState.enabled = (entry as any).data?.enabled ?? true;
      break;
    }
  }
});

// No comando /ov-recall toggle
const newState = !autoRecallState.enabled;
autoRecallState.enabled = newState;
pi.appendEntry("ov-recall-state", { enabled: newState });
```

#### BP-4: Extension Events para Observabilidade

**Recomendado:** Registrar handlers para `turn_start`/`turn_end` para métricas:

```typescript
pi.on("turn_end", async (_event, ctx) => {
  if (sessionSync) {
    const stats = sessionSync.getStats?.();
    if (stats && ctx.hasUI) {
      const theme = ctx.ui.theme;
      ctx.ui.setStatus("ov-stats", theme.fg("dim",
        `OV: ${stats.messagesSent} msgs, ${stats.failures} failures`
      ));
    }
  }
});
```

### 4.3 Configuração Recomendada para Produção

```jsonc
// .pi/settings.json — Produção
{
  "extensions": ["../src/index.ts"],
  "openVikingEndpoint": "https://ov.example.com",
  "openVikingTimeout": 30000,
  "openVikingCommitTimeout": 120000,
  "openVikingApiKey": "${OPENVIKING_API_KEY}",  // Via env var
  "openVikingAccount": "production",
  "openVikingUser": "${USER}",
  "openVikingAutoRecall": true,
  "openVikingAutoRecallLimit": 10,
  "openVikingAutoRecallTimeout": 5000,
  "openVikingAutoRecallTokenBudget": 700,
  "openVikingAutoRecallScoreThreshold": 0.15
}
```

---

## 5. Sumário de Ações Priorizadas

### P0 — Fazer Agora
| # | Ação | Esforço | Impacto |
|---|---|---|---|
| 1 | Adicionar `renderCall`/`renderResult` nas 6 ferramentas | Médio | UX significativamente melhor |
| 2 | Status line de saúde OV no footer | Baixo | Visibilidade do estado da conexão |
| 3 | Comando `/ov-setup` interativo | Médio | Remove fricção de onboarding |

### P1 — Próximo Sprint
| # | Ação | Esforço | Impacto |
|---|---|---|---|
| 4 | Gate de confirmação para `memdelete` via `tool_call` | Baixo | Segurança |
| 5 | Notificação de circuit breaker aberto | Baixo | Observabilidade |
| 6 | Async factory function para health check inicial | Baixo | Startup mais robusto |
| 7 | `CHANGELOG.md` + `CONTRIBUTING.md` | Baixo | Documentação profissional |
| 8 | Autocomplete `viking://` URIs | Médio | Produtividade |

### P2 — Backlog
| # | Ação | Esforço | Impacto |
|---|---|---|---|
| 9 | Auto-recall adaptativo via `getContextUsage()` | Baixo | Eficiência de tokens |
| 10 | Widget de auto-recall items | Baixo | Transparência |
| 11 | `tool_result` middleware para enriquecimento | Baixo | Experiência do agente |
| 12 | Branch fork tracking no OV | Médio | Rastreabilidade |
| 13 | Coverage report no CI | Baixo | Qualidade |
| 14 | ADRs com frontmatter estruturado | Baixo | Governança |

---

## 6. Comparação: Pi SDK Features vs Uso Atual

```
Pi SDK Feature                        Usado?    Prioridade
─────────────────────────────────────────────────────────
registerTool()                        ✅        —
registerCommand()                     ✅        —
on("session_start")                   ✅        —
on("message_end")                     ✅        —
on("session_shutdown")                ✅        —
on("before_agent_start")              ✅        —
appendEntry()                         ✅        —
sessionManager.getBranch()            ✅        —
tool result details                   ✅        —
Pi Package manifest                   ✅        —
─────────────────────────────────────────────────────────
renderCall / renderResult             ❌        P0
ui.setStatus()                        ❌        P0
on("tool_call") gate                  ❌        P1
on("turn_start/turn_end")             ❌        P1
async factory function                ❌        P1
ui.addAutocompleteProvider()          ❌        P1
ui.notify()                           ❌*       P1
on("tool_result") middleware           ❌        P2
ui.setWidget()                        ❌        P2
getContextUsage()                     ❌        P2
on("session_tree/fork")               ❌        P2
registerShortcut()                    ❌        P2
registerFlag()                        ❌        P2
setLabel()                            ❌        P2
registerMessageRenderer()             ❌        P3
setSessionName()                      ❌        P3
compact()                             ❌        P3
─────────────────────────────────────────────────────────
* notify() usada via helper notifyOnce, não diretamente via evento
```

**Cobertura atual:** ~10/30 recursos relevantes = **33%**

---

*Documento gerado por auditoria automatizada cruzando código-fonte do projeto com documentação oficial do Pi SDK (`docs/extensions.md`, `docs/sdk.md`, `examples/extensions/`).*
