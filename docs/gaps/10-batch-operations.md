# Gap 10 — Operações em Lote (Batch Import / Batch Delete)

## Definição

O pi-openviking expõe `memimport` e `memdelete` apenas para operações
individuais. Não há suporte para:

- **Batch import**: importar múltiplas URLs ou arquivos de uma vez
- **Batch delete**: deletar múltiplos recursos por URI pattern
- **Import recursivo de diretório**: importar árvore local mantendo estrutura

Cada `memimport` ou `memdelete` exige uma chamada de ferramenta separada,
o que consome tokens do contexto (tool calls) e tempo do usuário.

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Onboarding de repositório** | Importar `docs/`, `examples/`, `templates/` de uma vez |
| **Limpeza em massa** | Deletar todos os recursos temporários de `temp/` |
| **Migração** | Reimportar lote de skills após atualização |
| **Setup de workspace** | Script de bootstrap importa estrutura inicial inteira |
| **Carga de documentação** | Página de docs com múltiplos links → importar todos |

## Importância e Impacto da Correção

### 🟢 Baixo — Conveniência, não funcionalidade nova

Batch operations reduzem atrito e custo de tokens, mas não desbloqueiam
capacidades que não existiam antes. O usuário sempre pode chamar
`memimport` N vezes.

### Impactos específicos:

1. **Custo de tokens alto** — Cada import/delete individual é uma
   tool call completa (JSON input + output + render). Para 10 arquivos,
   são 10 tool calls vs 1 batch.

2. **Fricção para onboarding** — Setup inicial de um workspace exige
   múltiplas chamadas manuais ou um script externo.

3. **Import de diretório não preserva estrutura** — O `memimport` atual
   para diretórios faz upload de um zip. A estrutura original se perde
   (tudo vai para o mesmo parent).

### Abordagem de implementação

Em vez de novas tools, estender as existentes:

```typescript
// memimport estendido
memimport({
  source: ["https://.../doc1.md", "https://.../doc2.md"],  // array
  kind: "resource",
  batch: true
})

// memdelete estendido
memdelete({
  uri: "viking://user/default/temp/",   // diretório
  recursive: true                       // força remoção em massa
})
```

Ou criar `memimport-batch` como tool separada com parâmetro array.

### Esforço estimado de implementação

```
Baixo (~2h)
├── src/operations/batch.ts       → batchImportOp(), batchDeleteOp()
├── src/tools/import.ts           → estender parâmetro source para array
├── src/tools/delete.ts           → estender parâmetro recursive
└── src/importer/source-resolver.ts → suporte a múltiplas sources
```
