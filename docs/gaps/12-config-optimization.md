# Gap 12 — Configuração Não Otimizada

## Definição

O arquivo `.pi/settings.json` atual contém apenas:

```json
{
  "extensions": ["../src/index.ts"],
  "openVikingTimeout": 120000,
  "openVikingCommitTimeout": 120000
}
```

Apenas timeouts foram ajustados. Todos os parâmetros de auto-recall
e comportamento estão nos **defaults da biblioteca**, que podem não
ser ideais para o perfil de uso real.

Parâmetros deixados em default:

| Parâmetro | Default | Problema potencial |
|-----------|---------|--------------------|
| `openVikingAutoRecallTopN` | 5 | Pode ser alto para contextos pequenos |
| `openVikingAutoRecallScoreThreshold` | 0.15 | Muito baixo — injeta memórias de baixa relevância |
| `openVikingAutoRecallTokenBudget` | 700 | Pode consumir 25%+ de contexto pequeno (4k janela) |
| `openVikingAutoRecallPreferAbstract` | true | Correto para maioria, mas pode perder detalhes |
| `openVikingAutoRecallMaxContentChars` | 500 | Razoável, mas sem validação empírica |
| `openVikingAutoRecall` | true | OK, mas sem fallback condicional |

## Principais Casos de Uso da Correção

| Caso | Descrição |
|------|-----------|
| **Ajuste por janela de contexto** | 4k tokens → budget menor (300-500). 200k → budget maior (1500+) |
| **Filtro de relevância** | Threshold 0.15 injeta muita memória irrelevante. 0.3-0.5 é mais seletivo |
| **Preferência por profundidade** | Projetos técnicos podem preferir overview em vez de abstract |
| **Perfil por projeto** | Cada workspace pode ter configuração OV diferente |
| **Debug tuning** | Sem métricas, não há como saber se os defaults são adequados |

## Importância e Impacto da Correção

### 🟡 Médio — Performance do auto-recall pode estar abaixo do ótimo

Diferente das outras gaps que adicionam funcionalidades, esta gap é
sobre **ajustar finamente o que já existe** para máxima efetividade.

### Impactos específicos:

1. **Memórias irrelevantes no prompt** — Threshold 0.15 é muito baixo.
   Memórias com score quase zero são injetadas, consumindo tokens e
   potencialmente confundindo o agente.

2. **Budget desalinhado** — 700 tokens num contexto de 4k = 17.5% do
   contexto só para memórias. Pode ser muito ou pouco, mas sem métricas
   não dá para saber.

3. **Sem perfil por workspace** — Mesmo setup para projeto grande (muitas
   memórias relevantes) e projeto pequeno (poucas memórias). Deviam ter
   topN e threshold diferentes.

4. **Oportunidade de adaptive tuning** — O `resolve-budget.ts` já ajusta
   budget por uso de contexto. Daria para estender para ajustar topN e
   threshold dinamicamente.

### Abordagem de implementação

```typescript
// Config sugerida para .pi/settings.json
{
  "extensions": ["../src/index.ts"],
  "openVikingTimeout": 120000,
  "openVikingCommitTimeout": 120000,

  // Auto-recall tuning
  "openVikingAutoRecallTopN": 3,
  "openVikingAutoRecallScoreThreshold": 0.3,
  "openVikingAutoRecallTokenBudget": 500,
  "openVikingAutoRecallPreferAbstract": true,
  "openVikingAutoRecallMaxContentChars": 400,

  // Escopo
  "openVikingAutoRecallTargetUri": "viking://default/user/default/projetos/meu-app/"
}
```

### Esforço estimado de implementação

```
Mínimo (~30min) — só documentação e ajuste de config
├── .pi/settings.json → atualizar com valores otimizados
└── docs/ → documentar estratégia de tuning por perfil

Se quiser adaptive tuning automático:
├── src/auto-recall/resolve-budget.ts → estender para topN + threshold adaptativos
└── ~1h extra
```
