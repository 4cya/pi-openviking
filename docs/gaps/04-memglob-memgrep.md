# Gap 04 — `memglob` + `memgrep` / Busca por Padrão e Conteúdo

## Definição

O OpenViking expõe dois modos de busca além da busca semântica:
- `POST /api/v1/search/glob` — busca por **padrão de path** no filesystem
  (`docs/**/*.md`, `*decisions*`, `**/*.ts`)
- `POST /api/v1/search/grep` — busca por **texto literal no conteúdo**
  (case-sensitive, regex opcional)

O pi-openviking **só expõe a busca semântica** via `memsearch`.
Não há como o agente ou usuário buscar recursos por nome/padrão de path
ou por correspondência textual direta.

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Encontrar por extensão** | `memglob "docs/**/*.md"` — todos os markdowns em docs/ |
| **Busca por termo exato** | `memgrep "OPENVIKING_ENDPOINT"` — onde esse termo aparece |
| **Listar recursos de um tipo** | `memglob "**/skills/*.md"` — skills disponíveis |
| **Debug de imports** | `memglob "temp_*"` — recursos não organizados |
| **Auditoria de nomenclatura** | `memgrep "[TODO|FIXME]"` — encontrar dívida técnica em recursos |
| **Integração com write-back** | Após `memsave`, verificar se URI já existe com `memglob` |
| **CI/CD validation** | Script que checa se docs obrigatórios existem via glob |

## Importância e Impacto da Correção

### 🟡 Médio — Busca semântica não resolve todos os problemas

Busca semântica é excelente para encontrar "coisas parecidas com X",
mas péssima para:
- Encontrar um recurso pelo nome exato
- Verificar se algo existe antes de criar
- Fazer auditoria estrutural

### Impactos específicos:

1. **Busca cega para metadados** — O usuário sabe o nome do recurso mas
   não consegue encontrá-lo se a busca semântica não o rankear bem.

2. **Sem validação de existência** — `memsave` ou `memmkdir` precisam
   saber se o URI já existe. Sem glob, é tentativa-e-erro.

3. **Impossível listar por padrão** — "Mostre todos os ADRs" ou "quais
   skills eu tenho?" requerem glob, não semântica.

4. **Debug difícil** — Recurso sumiu? Sem grep/glob, não há como
   confirmar se foi deletado ou renomeado.

5. **Dependência de embedding** — Busca semântica depende do modelo de
   embedding estar funcionando e bem calibrado. Grep é determinístico.

### Esforço estimado de implementação

```
Baixo (~2h)
├── src/operations/glob.ts + grep.ts   → operações
├── src/tools/glob.ts + grep.ts        → memglob + memgrep tools
├── src/commands/glob.ts + grep.ts     → /ov-glob + /ov-grep
├── src/ov-client/client.ts            → add glob() + grep() ao KnowledgeClient
└── src/bootstrap/register.ts          → registrar
```

### API OV necessária

```http
# Glob — busca por path pattern
POST /api/v1/search/glob
Content-Type: application/json

{ "pattern": "docs/**/*.md", "limit": 50 }

# Grep — busca por texto no conteúdo
POST /api/v1/search/grep
Content-Type: application/json

{
  "pattern": "OPENVIKING_ENDPOINT",
  "regex": false,
  "case_sensitive": false,
  "uri": "viking://user/default/"
}
```
