# Gap 01 — `memsave` / Write-Back de Conteúdo no viking://

## Definição

O OpenViking expõe o endpoint `POST /api/v1/content/write`, que permite gravar
qualquer conteúdo textual diretamente em um URI `viking://`. O pi-openviking
atualmente **não possui nenhuma ferramenta ou comando que escreva conteúdo**
no filesystem do OpenViking.

As únicas formas de inserir dados hoje são:

- `memimport` — importa de URL externa ou arquivo local
- `memcommit` — comita o histórico da sessão (extração assíncrona de memórias)

Ambas são indiretas. Não há como o agente (ou o usuário) salvar uma nota,
decisão de arquitetura, trecho de código ou aprendizado diretamente num URI
controlado.

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Salvar decisões** | Após uma discussão arquitetural, agente salva ADR resumido em `viking://user/default/memories/decisions/adr-012.md` |
| **Anotações rápidas** | Usuário manda "salva isso nos favoritos" ou "guarda esse snippet" sem precisar de arquivo externo |
| **Memórias estruturadas** | Agente salva preferências, padrões de código, configurações de projeto em URIs organizados |
| **Auto-documentação incremental** | A cada feature implementada, agente registra resumo técnico no OV |
| **Correção de memórias** | Usuário edita/atualiza um resumo de memória existente |
| **Seed inicial de conhecimento** | Setup script salva contexts iniciais (regras do projeto, tech stack) diretamente |

## Importância e Impacto da Correção

### 🔴 Crítico — Bloqueia o ciclo "aprender → reter → relembrar"

Sem write-back, o OpenViking é **apenas leitura + commit de sessão**.
O valor real de uma memória persistente é poder **salvar conhecimento
processado** — não apenas confiar na extração automática via commit.

### Impactos específicos:

1. **Agente não consegue "aprender ativamente"** — Só pode confiar na
   extração passiva de memórias via `memcommit`. Decisões explícitas,
   preferências do usuário, descobertas durante a sessão ficam perdidas
   se o commit não as capturar.

2. **Navegação assimétrica** — `membrowse` + `memread` permitem explorar,
   mas não há contrapartida de escrita. O filesystem viking:// vira
   **read-only** na prática.

3. **Dependência externa para gravar** — Para salvar conhecimento,
   usuário precisa ter um arquivo local ou URL. Quebra o fluxo "pensei →
   quero salvar".

4. **Impossibilidade de editar memórias existentes** — Se uma memória
   extraída pelo commit está incompleta ou errada, não há como corrigi-la.

### Esforço estimado de implementação

```
Baixo (~2h)
├── src/operations/write.ts      → operação reutilizável
├── src/tools/save.ts            → ferramenta memsave + renderer
├── src/commands/save.ts         → comando /ov-save
├── src/ov-client/client.ts      → add write() ao FsClient
└── src/bootstrap/register.ts    → registrar tool + command
```

### API OV necessária

```http
POST /api/v1/content/write
Content-Type: application/json
X-API-Key: dev

{
  "uri": "viking://user/default/memories/decisions/foo.md",
  "content": "# Decisão: usar React Query\n\n...",
  "mime": "text/markdown"
}
```
