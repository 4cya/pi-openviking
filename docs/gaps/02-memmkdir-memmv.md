# Gap 02 — `memmkdir` + `memmv` / Operações de Diretório

## Definição

O OpenViking expõe os endpoints:
- `POST /api/v1/fs/mkdir` — criar diretórios no filesystem `viking://`
- `POST /api/v1/fs/mv` — mover ou renomear recursos

O pi-openviking atualmente **não implementa nenhuma das duas operações**.
Uma vez que um recurso é importado, ele fica imutável em termos de
organização. O usuário não pode:

- Criar pastas para organizar imports
- Renomear recursos que chegam com nomes automáticos
- Mover recursos entre categorias (ex: de `temp/` para `docs/`)
- Estruturar o conhecimento em hierarquias lógicas

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Organizar imports** | Após `memimport` de vários arquivos, agrupar em `docs/`, `skills/`, `templates/` |
| **Renomear recursos** | Corrigir nomes gerados automaticamente pelo import |
| **Categorizar memórias** | Mover `viking://.../memories/flat-item` para `memories/decisions/` ou `memories/learnings/` |
| **Setup inicial** | Script de bootstrap cria estrutura de diretórios do projeto |
| **Limpeza pós-sessão** | Mover descobertas de `temp/` para local permanente |
| **Namespace por projeto** | Criar `viking://projetos/meu-app/docs/` e mover recursos para lá |

## Importância e Impacto da Correção

### 🟡 Médio — Organização do conhecimento prejudicada

Sem `mkdir`/`mv`, o filesystem `viking://` vira um saco de imports
sem estrutura. A árvore de conhecimento não reflete a organização
lógica do projeto.

### Impactos específicos:

1. **Caos no filesystem** — Todo import cai onde o resolvedor decidir.
   Não há como organizar retrospectivamente. `membrowse` fica menos
   útil porque a estrutura não faz sentido.

2. **URIs quebradas** — Se um recurso foi importado com nome feio
   (`temp_upload_abc123.md`), não há como renomear para algo legível.

3. **Namespace locking** — A estrutura inicial (criada pelo OV no
   primeiro uso) é a única que existe. Projetos com múltiplos domínios
   não conseguem separar contextos.

4. **Impossível migrar** — Se o usuário muda de ideia sobre como
   organizar, não há como refletir isso no OV sem deletar e reimportar.

### Esforço estimado de implementação

```
Muito baixo (~1h cada)
├── src/operations/mkdir.ts          → mkdirOp()
├── src/operations/mv.ts             → mvOp()
├── src/tools/mkdir.ts + mv.ts       → memmkdir + memmv
├── src/commands/mkdir.ts + mv.ts    → /ov-mkdir + /ov-mv
├── src/ov-client/fs-ops.ts          → add mkdir() + mv()
└── src/bootstrap/register.ts        → registrar
```

### API OV necessária

```http
# mkdir
POST /api/v1/fs/mkdir
Content-Type: application/json

{ "uri": "viking://user/default/docs/decisions" }

# mv
POST /api/v1/fs/mv
Content-Type: application/json

{
  "from": "viking://user/default/temp/unorganized-note.md",
  "to": "viking://user/default/docs/decisions/001-use-react-query.md"
}
```
