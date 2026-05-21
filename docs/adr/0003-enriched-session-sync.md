# Enriched Session Sync — Tool Calls e Tool Results

Session sync para OV era text-only: `extractText` filtrava apenas `type === "text"`, e `onMessageEnd` ignorava `role: "toolResult"`. Isso significava que OV nunca sabia quais ferramentas o agente usou nem o que retornaram — memória extraída perdia contexto significativo de ações.

Decisão: enviar tool calls como `Part[]` estruturado (nativo do OV), enviar tool results truncados (500 chars) com metadata prefix (`[tool: {name}, error: {bool}]`), descartar thinking content, e usar `role: "toolResult"` para resultados. Assistant messages com blocos mistos (texto + tool calls) viram uma única chamada `sendMessage` com `Part[]`.

**Status**: accepted

**Considered Options**:
- Text serialization de tool calls → rejeitado: OV não distingue tool call de texto, extração de memória menos precisa
- Enviar thinking content → rejeitado: metacognição não é ação, infla sessão com ruído
- Tool results sem truncamento → rejeitado: `read` de arquivo grande = kilobytes, sessão OV explode
- Tool results como `role: "user"` → rejeitado: OV atribuiria ao usuário ações de ferramenta
- Tool results com truncamento configurável → rejeitado: premature configurability, hardcoded 500 chars por ora

**Consequences**:
- Sessões OV agora contêm contexto de ações do agente → extração de memória significativamente melhor
- Sessões OV existentes ficam em formato antigo (text-only) → sem migração, são read-only no OV
- `extractText` deixa de ser "extract text" → renomear para `serializeContent` reflete melhor a responsabilidade
- Novo custo: ~1-2 chamadas HTTP extras por turno (tool results) → negligível vs ganho
