# Gap 07 — `ov-pack` / Backup e Restore via Ovpack

## Definição

O OpenViking expõe um sistema completo de backup e restauração via
formato **ovpack**:
- `POST /api/v1/pack/export` — exportar dados para arquivo .ovpack
- `POST /api/v1/pack/import` — importar dados de arquivo .ovpack
- `POST /api/v1/pack/backup` — criar backup completo
- `POST /api/v1/pack/restore` — restaurar de backup

O pi-openviking **não expõe nenhum destes endpoints**. Não há como
o usuário fazer backup das memórias, exportar conhecimento para
transferência entre servidores OV, ou restaurar dados de um snapshot.

## Principais Casos de Uso

| Caso | Descrição |
|------|-----------|
| **Backup manual** | Antes de atualizar servidor OV, exportar memórias |
| **Migração** | Transferir memórias de dev para produção |
| **Compartilhar contexto** | Exportar memórias de um projeto e enviar para outro time |
| **Sandbox → prod** | Desenvolver skills num OV de teste, exportar, importar no OV real |
| **Rollback** | Restaurar estado anterior após import problemático |
| **CI/CD** | Pipeline de testes faz backup antes de testes destrutivos |

## Importância e Impacto da Correção

### 🟡 Médio — Sem backup, dados estão vulneráveis

O OV armazena meses de interações, memórias, preferências. Sem backup,
todo esse conhecimento pode ser perdido com um `docker compose down`
mal executado ou corrupção de dados.

### Impactos específicos:

1. **Dados sem proteção** — Não há snapshot. Se o volume Docker for
   corrompido, todo o conhecimento acumulado desaparece.

2. **Sem migração** — Para promover memórias de dev para staging/prod,
   o único caminho é reimportar tudo manualmente.

3. **Sem compartilhamento** — Skills e memórias de um projeto não
   podem ser exportadas para outro time ou repositório.

4. **Viola boas práticas** — Qualquer sistema de dados deve ter
   backup/restore. O OV oferece, o plugin ignora.

5. **Dependência do volume Docker** — Dados só existem no container.
   `docker compose down -v` = perda total.

### Esforço estimado de implementação

```
Baixo (~2h)
├── src/operations/pack.ts        → exportOp(), importOp(), backupOp(), restoreOp()
├── src/tools/pack.ts             → memexport / memimport-pack tools
├── src/commands/pack.ts          → /ov-pack-export / /ov-pack-import
├── src/ov-client/client.ts       → add pack methods
└── src/bootstrap/register.ts     → registrar
```

### API OV necessária

```http
# Exportar
POST /api/v1/pack/export
Content-Type: application/json

{
  "uri": "viking://user/default/",
  "format": "ovpack"
}

# Response: { "download_url": "...", "size": 12345 }

# Restaurar
POST /api/v1/pack/restore
Content-Type: application/json

{
  "source_url": "...",
  "strategy": "merge" | "overwrite"
}
```
