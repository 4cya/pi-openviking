# ADR-012: Auto-recall via custom message (not system prompt)

Auto-recall injects relevant memories from OpenViking into the agent's context on each `before_agent_start` event. This ADR documents why we inject via a custom message in the message list rather than appending to the system prompt.

## Context

When `before_agent_start` fires, the extension receives `BeforeAgentStartEventResult` with two ways to inject content:

1. **`message?: Pick<CustomMessage, ...>`** — inject a custom message (`role: "custom"`) into the conversation history. `display: false` means it's excluded from the rendered TUI. `convertToLlm()` transforms custom messages into LLM-compatible context.

2. **`systemPrompt?: string`** — replace (or chain into) the system prompt string. Multiple extensions' `systemPrompt` values are chained.

Both work. The question is which is architecturally correct for memory injection.

## Decision

**Use custom message** (`customType: "memory_context"`, `display: false`).

## Rationale

1. **Semantic separation**: Memories are data, not instructions. A system prompt contains behavioral rules, tool definitions, and output formatting. Appending `<relevant-memories>...</relevant-memories>` to it conflates declarative context with imperative instructions. A custom message keeps the distinction clear.

2. **Encapsulation**: The custom message is a first-class `AgentMessage` in the conversation history. It can be inspected, filtered, or removed by other extensions or by Pi's own message processing. System prompt mutations are opaque — they merge into a single monolithic string.

3. **`display: false`**: The memory injection is invisible to the user in the TUI. There's no distracting block of raw memory text in the chat. The agent still sees it via `convertToLlm()`.

4. **Debugging**: A custom message with `customType: "memory_context"` is identifiable in the message list. You can grep, log, or filter by customType. System prompt mutations are invisible after chaining.

5. **Extensibility**: GraphExpander (F8) merges expanded relations into the same custom message with a `[graph]` prefix. With system prompt, we'd need to append multiple times or manage dedup logic inside a growing string.

6. **Token management**: Custom messages are subject to Pi's normal context window management (compaction, summarization). System prompt mutations persist across the entire agent loop.

## Consequences

- The custom message counts toward the context window token budget. This is acceptable — the RecallCurator already enforces `maxTokens` on recall output.
- `convertToLlm()` must support custom messages. It does as of Pi SDK current version.
- Multiple custom messages from different extensions are handled independently. No merge conflicts (unlike systemPrompt chaining where order matters).
- The `before_agent_start` handler returns one message. If future needs require multiple memory blocks, they'd need to be concatenated into one message.

## Alternatives considered

- **System prompt append**: Simpler to implement (one string concat), but semantically wrong and harder to debug.
- **`context` event**: `ContextEvent` fires before each LLM call (multiple times per turn). `before_agent_start` fires once per user input — more appropriate for recall which doesn't change within a turn.
