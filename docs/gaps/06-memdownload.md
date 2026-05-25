# Gap 06 — `memdownload` / Download de Recursos

## Definição

O OpenViking expõe `GET /api/v1/content/download`, que permite baixar
o conteúdo bruto de qualquer URI `viking://` como um arquivo.

O pi-openviking não oferece nenhuma ferramenta para baixar recursos.
O fluxo de leitura existente (`memread`) mostra o conteúdo no contexto
do agente, mas não permite que o usuário obtenha o recurso como arquivo
local no filesystem.

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Exportar docs** | Baixar documentação técnica salva no OV para o projeto local |
| **Extrair templates** | Skills importadas como referência → baixar para usar offline |
| **Backup seletivo** | Baixar recursos específicos antes de deletar |
| **Workflow offline** | Pegar lista de dependências / configs salvas no OV |
| **Compartilhar** | Extrair conteúdo de uma memória para colar em outro contexto |

## Importância e Impacto da Correção

### 🟢 Baixo — Funcionalidade útil mas não crítica

O `memread` já permite ler qualquer recurso. O download adiciona
conveniência, mas não desbloqueia novos padrões de uso.

### Impactos específicos:

1. **Sem saída para o filesystem** — Conteúdo lido fica preso no
   contexto do agente. Não há como materializá-lo como arquivo.

2. **Workaround custoso** — Usuário precisa copiar manualmente o
   output do `memread` e colar num arquivo local.

3. **Quebra de expectativa** — Sistema de arquivos virtual sem
   download parece incompleto para usuários acostumados com
   cp/scp/download.

### Esforço estimado de implementação

```bash
Muito baixo (~30min)
├── src/tools/download.ts       → memdownload tool (retorna content as text)
├── src/commands/download.ts    → /ov-download <uri> [output-path]
└── src/operations/download.ts  → downloadOp() (reutilizável)
```

### API OV necessária

```http
GET /api/v1/content/download?uri=viking://user/default/docs/architecture.md

Response: raw file content (application/octet-stream)
```
