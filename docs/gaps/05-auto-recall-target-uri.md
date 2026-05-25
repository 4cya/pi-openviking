# Gap 05 — Auto-recall sem Escopo (target_uri ausente)

## Definição

O endpoint `POST /api/v1/search/search` (deep mode) aceita o parâmetro
`target_uri`, que restringe a busca a uma subárvore do filesystem
`viking://`. Exemplo:

```json
{
  "query": "como configurar o banco",
  "target_uri": "viking://user/default/projetos/meu-app/"
}
```

Retorna só resultados dentro daquela subárvore.

O pi-openviking **não usa `target_uri` no auto-recall**. A busca é
sempre global — todas as memórias de todos os projetos, contextos e
domínios são candidatas. O parâmetro é exposto apenas na ferramenta
`memsearch` (como `uri` opcional), mas o pipeline automático de
injeção de contexto ignora escopo.

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Projetos isolados** | Usuário tem 3 projetos no OV. Auto-recall do projeto A não deve trazer memórias do projeto B |
| **Contexto por workspace** | Ao abrir workspace X, auto-recall escopa para `viking://.../workspaces/X/` |
| **Domínios diferentes** | Memórias de "design system" vs "backend" não se misturam |
| **Hierarquia de pastas** | Ao discutir `docs/auth/`, auto-recall prioriza subtree `auth/` |
| **Onboarding vs daily** | Memórias de onboarding vs desenvolvimento diário em subárvores separadas |

## Importância e Impacto da Correção

### 🟡 Médio — Poluição de contexto entre domínios

Sem escopo, o auto-recall pode injetar memórias de projetos não
relacionados, diluindo a relevância do contexto.

### Impactos específicos:

1. **Ruído no prompt** — Memórias de outros projetos competem por tokens
   preciosos com memórias realmente relevantes.

2. **Falsa correlação** — Agente pode achar que uma memória de outro
   projeto é relevante porque a similaridade semântica coincidiu.

3. **Vazamento de contexto** — Informação de um projeto aparece durante
   trabalho em outro. Pode causar confusão ou (pior) sugestões erradas.

4. **Subutilização do OV** — O `target_uri` já existe no servidor, é
   parâmetro opcional. Não usá-lo é deixar capacidade na mesa.

5. **Impossível escalar** — Conforme o OV acumula meses de interações
   em múltiplos projetos, o ruído cresce linearmente.

### Abordagem de implementação

Diferente das outras gaps, esta **não requer novas ferramentas ou
endpoints**. Requer apenas modificar o auto-recall existente para
aceitar e propagar `target_uri`.

### Esforço estimado de implementação

```
Baixo (~1.5h)
├── src/auto-recall/auto-recall.ts
│   └── add targetUri param → passar para knowledge.search()
│
├── src/bootstrap/hooks.ts
│   └── before_agent_start → detectar escopo (ex: workspace, cwd)
│
├── src/shared/config.ts
│   └── targetUri resolver (opcional via settings.json)
│
└── docs: documentar estratégia de escopo
```

#### Estratégia de resolução de escopo

```typescript
function resolveTargetUri(cwd: string): string | undefined {
  // 1. Config explícita em settings.json
  // 2. Mapeamento cwd → subárvore OV
  // 3. Tags de workspace do Pi
  // 4. Fallback: undefined (busca global)
}
```
