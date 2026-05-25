# Manual Completo do OpenViking Plugin

> **Versão hipotética:** pi-openviking v1.0 — todas as capacidades do
> servidor OV mapeadas como ferramentas, comandos e automações.
>
> *Este manual descreve o que o plugin pode ser quando todos os gaps
> forem preenchidos. Veja `docs/gaps/` para o roadmap.*

---

## Índice

- [1. O que é o OpenViking no Pi?](#1-o-que-é-o-openviking-no-pi)
- [2. Quick Start — 5 minutos para começar](#2-quick-start--5-minutos-para-começar)
- [3. Ferramentas — Referência Completa](#3-ferramentas--referência-completa)
- [4. Comandos — Referência Completa](#4-comandos--referência-completa)
- [5. Dia a Dia: Fluxos de Trabalho](#5-dia-a-dia-fluxos-de-trabalho)
- [6. Configurações Avançadas](#6-configurações-avançadas)
- [7. Integrações](#7-integrações)
- [8. Arquitetura do Conhecimento](#8-arquitetura-do-conhecimento)
- [9. Solução de Problemas](#9-solução-de-problemas)
- [10. Referência Rápida](#10-referência-rápida)

---

## 1. O que é o OpenViking no Pi?

O **pi-openviking** é a ponte entre o agente Pi (seu assistente de
codificação) e o **OpenViking** (um banco de memória persistente com
grafo de conhecimento, busca semântica e sistema de arquivos virtual).

### Para que serve?

Imagine que o Pi funciona como um assistente **sem memória entre
sessões** — cada conversa começa do zero. O OpenViking resolve isso:

- **Persistência**: decisões, preferências, padrões de código e
  documentação sobrevivem ao fim da sessão.
- **Relevância contextual**: antes de cada resposta, o Pi busca
  automaticamente memórias relevantes para o que você está fazendo.
- **Grafo de conhecimento**: recursos são ligados entre si — um ADR
  aponta para o código que implementa, que aponta para o PR que
  revisou, que aponta para o benchmark que validou.
- **Filesystem versionado**: todo conhecimento é armazenado numa
  hierarquia `viking://` com níveis de abstração (L0, L1, L2).

### O que o OpenViking NÃO é?

- Não substitui o Git — o código fonte mora no Git. O OV guarda
  _conhecimento sobre_ o código.
- Não substitui o histórico de conversas do Pi — o Pi é a fonte
  da verdade para mensagens. O OV é a fonte da verdade para
  **memórias extraídas**.
- Não é um banco de dados relacional — é um grafo + vetores.

---

## 2. Quick Start — 5 minutos para começar

### 2.1 Instalação

```bash
# Via npm
npm install -g pi-openviking

# Ou adicione ao package.json do seu projeto pi
npm install pi-openviking

# Adicione ao .pi/settings.json
{
  "extensions": ["./node_modules/pi-openviking/src/index.ts"]
}
```

### 2.2 Configuração mínima

```json
// .pi/settings.json
{
  "extensions": ["./node_modules/pi-openviking/src/index.ts"],
  "openVikingEndpoint": "http://localhost:1933",
  "openVikingApiKey": "dev"
}
```

### 2.3 Iniciar servidor OV local

```bash
docker compose up -d
# Verificar
curl http://localhost:1933/health
# → {"status":"ok","healthy":true,"version":"v0.3.19"}
```

### 2.4 Verificar integração

```bash
# No Pi, execute:
/ov-stats
# → 📊 0 memórias · 0 recursos · 0 skills · 0.1 MB

# Importar primeira referência:
/ov-import https://react.dev/reference/react

# Após conversar, comitar:
/ov-commit
```

### 2.5 Configuração avançada rápida

```bash
# Perfil para desenvolvimento web
/ov-profile apply web-dev
# → target_uri: viking://projetos/web-app/
# → topN: 3, threshold: 0.3, budget: 500

# Perfil para documentação
/ov-profile apply docs
# → target_uri: viking://docs/
# → topN: 5, threshold: 0.2, budget: 700
```

---

## 3. Ferramentas — Referência Completa

> Todas as ferramentas abaixo são acessíveis pelo agente Pi durante a
> conversa e também como comandos `/ov-*`.

### 3.1 Busca e Descoberta

#### `memsearch` — Busca semântica

```typescript
memsearch({
  query: "como configurar autenticação JWT",
  limit: 5,
  mode: "deep",        // auto | fast | deep
  uri: "viking://projetos/web-app/"  // escopo opcional
})
```

- **auto** (default): decide entre fast e deep pelo tamanho da query
- **fast**: busca vetorial simples, sem contexto de sessão
- **deep**: usa contexto da sessão para reranking + query plan

#### `memglob` — Busca por padrão de path

```typescript
memglob({
  pattern: "docs/**/*.md",
  limit: 50
})
```

Retorna todos os URIs que casam o padrão glob. Útil para auditoria,
listagem por tipo, verificação de existência.

#### `memgrep` — Busca por texto no conteúdo

```typescript
memgrep({
  pattern: "TODO|FIXME|HACK",
  regex: true,
  caseSensitive: false,
  uri: "viking://projetos/web-app/"  // escopo opcional
})
```

### 3.2 Leitura e Navegação

#### `memread` — Leitura com níveis

```typescript
memread({
  uri: "viking://projetos/web-app/decisions/001-use-nextjs.md",
  level: "abstract"   // abstract | overview | read | auto
})
```

| Level | O que retorna | Tokens típicos | Uso |
|-------|---------------|----------------|-----|
| `abstract` | Resumo de 1-2 frases | ~100 | Decidir se é relevante |
| `overview` | Sumário executivo | ~2.000 | Entender sem carregar tudo |
| `read` | Conteúdo completo | Variável | Análise profunda |
| `auto` | Abstract para dir, Read para arquivo | — | Padrão seguro |

#### `membrowse` — Navegação no filesystem

```typescript
membrowse({
  uri: "viking://projetos/web-app/",
  view: "tree",       // list | tree | stat
  recursive: true,    // expandir subdiretórios
  simple: false       // só URIs, sem metadados
})
```

### 3.3 Escrita e Organização

#### `memsave` — Salvar conteúdo diretamente

```typescript
memsave({
  uri: "viking://projetos/web-app/notes/obs sobre auth.md",
  content: "# OBS: Fluxo de autenticação\n\nO login usa...",
  mime: "text/markdown"
})
```

**A ferramenta mais importante do ecossistema.** Permite que o agente
salve conhecimento processado — não apenas o que foi importado ou
extraído automaticamente.

#### `memmkdir` — Criar diretório

```typescript
memmkdir({
  uri: "viking://projetos/web-app/templates"
})
```

#### `memmv` — Mover / Renomear

```typescript
memmv({
  from: "viking://projetos/web-app/temp/unorganized.md",
  to: "viking://projetos/web-app/docs/architecture.md"
})
```

#### `memimport` — Importar recursos externos

```typescript
// Simples
memimport({ source: "https://api.example.com/docs" })

// Batch
memimport({
  source: [
    "https://docs.example.com/intro.md",
    "https://docs.example.com/api.md",
    "https://docs.example.com/deploy.md"
  ]
})

// Como skill
memimport({
  source: "./minha-skill.md",
  kind: "skill",
  reason: "Skill para debug de memory leaks",
  to: "viking://skills/debug/"
})
```

Tipos de source suportados:
| Source | Exemplo | Comportamento |
|--------|---------|---------------|
| URL http(s) | `https://...` | Baixa e importa |
| Arquivo local | `./README.md` | Lê e faz upload |
| Diretório | `./docs/` | Comprime em zip, upload, extrai |
| Git | `git://github.com/user/repo` | Clona e importa estrutura |

#### `memdelete` — Deletar recurso

```typescript
// Único
memdelete({ uri: "viking://temp/old-file.md" })

// Recursivo
memdelete({ uri: "viking://temp/", recursive: true })

// Batch
memdelete({ uri: ["viking://a.md", "viking://b.md"] })
```

### 3.4 Grafo de Conhecimento

#### `memlink` — Criar relação entre recursos

```typescript
memlink({
  source: "viking://projetos/web-app/adrs/001-use-nextjs.md",
  target: "viking://projetos/web-app/notes/benchmark-nextjs-vs-vite.md",
  predicate: "supported_by"   // fundamenta | contradiz | implementa | depende_de | ...
})
```

**Predicados comuns:**

| Predicado | Direção | Exemplo |
|-----------|---------|---------|
| `fundamenta` | decisão → evidência | ADR é "fundamentado_por" benchmark |
| `implementa` | issue → PR | Issue é "implementado_por" PR |
| `depende_de` | módulo → módulo | Auth "depende_de" JWT lib |
| `contradiz` | decisão → decisão | Escolha A "contradiz" escolha B |
| `substitui` | recurso → recurso | V3 "substitui" V2 |
| `referencia` | doc → código | Doc "referencia" implementação |

#### `memunlink` — Remover relação

```typescript
memunlink({
  source: "viking://projetos/web-app/adrs/001-use-nextjs.md",
  target: "viking://projetos/web-app/notes/benchmark-nextjs-vs-vite.md"
})
```

#### `memgraph` — Navegar o grafo

```typescript
memgraph({
  uri: "viking://projetos/web-app/adrs/001-use-nextjs.md",
  depth: 2  // quantos hops de profundidade
})
```

### 3.5 Sessão e Memória

#### `memcommit` — Comitar sessão

```typescript
// Fire-and-forget (default)
memcommit()

// Aguardar extração
memcommit({ wait: true })
```

O `memcommit` envia o histórico da sessão para o OV, que extrai
memórias automaticamente (preferências, decisões, padrões).

#### `memreindex` — Forçar reindexação

```typescript
memreindex({
  uri: "viking://projetos/web-app/notes/",
  recursive: true
})
```

Útil após `memsave` alterar conteúdo — garante que a busca semântica
encontre o novo conteúdo imediatamente.

### 3.6 Utilitários

#### `memdownload` — Baixar recurso como arquivo

```typescript
memdownload({
  uri: "viking://projetos/web-app/docs/api-spec.yaml"
})
// → Salva como ./api-spec.yaml no projeto local
```

#### `memexport` — Exportar backup

```typescript
memexport({
  uri: "viking://projetos/web-app/",
  format: "ovpack"
})
// → Gera web-app-2026-05-24.ovpack para download
```

#### `memimport-pack` — Restaurar backup

```typescript
memimport-pack({
  source: "./backup-ontem.ovpack",
  strategy: "merge"   // merge | overwrite
})
```

#### `memwatch` — Observar mudanças

```typescript
memwatch({
  uri: "viking://projetos/web-app/decisions/**",
  callback: "notify"   // como notificar o agente
})
```

---

## 4. Comandos — Referência Completa

Todos os comandos são prefixados com `/ov-` para evitar conflito:

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/ov-search <q>` | Busca semântica formatada | `/ov-search autenticação JWT` |
| `/ov-glob <p>` | Busca por padrão de path | `/ov-glob docs/**/*.md` |
| `/ov-grep <p>` | Busca por texto no conteúdo | `/ov-grep TODO` |
| `/ov-ls [uri]` | Listar diretório (tree) | `/ov-ls viking://projetos/` |
| `/ov-read <uri>` | Ler recurso | `/ov-read viking://.../doc.md` |
| `/ov-save <uri>` | Salvar conteúdo | `/ov-save notes/log.md` |
| `/ov-mkdir <uri>` | Criar diretório | `/ov-mkdir docs/decisions` |
| `/ov-mv <from> <to>` | Mover/renomear | `/ov-mv old.md new.md` |
| `/ov-import <src>` | Importar recurso | `/ov-import https://...` |
| `/ov-delete <uri>` | Deletar recurso | `/ov-delete temp/file.md` |
| `/ov-link <src> <tgt>` | Ligar recursos | `/ov-link adr-001.md benchmark.md` |
| `/ov-graph <uri>` | Ver grafo | `/ov-graph docs/auth.md` |
| `/ov-commit` | Comitar sessão | `/ov-commit` |
| `/ov-recall [on|off|status]` | Auto-recall toggle | `/ov-recall status` |
| `/ov-stats` | Ver estatísticas | `/ov-stats` |
| `/ov-status` | Ver saúde do servidor | `/ov-status` |
| `/ov-profile <nome>` | Aplicar perfil de config | `/ov-profile web-dev` |
| `/ov-reindex <uri>` | Forçar reindexação | `/ov-reindex notes/` |
| `/ov-watch <uri>` | Observar mudanças | `/ov-watch decisions/` |
| `/ov-pack-export` | Exportar backup | `/ov-pack-export` |
| `/ov-pack-import` | Importar backup | `/ov-pack-import backup.ovpack` |
| `/ov-download <uri>` | Baixar recurso | `/ov-download docs/spec.yaml` |

---

## 5. Dia a Dia: Fluxos de Trabalho

### 5.1 Manhã — Nova feature, contexto quente

**Cenário:** Você vai implementar um novo fluxo de autenticação.
O Pi já sabe do projeto porque conversaram ontem.

```
Você:  /ov-search "decisões de autenticação"
Pi:    🔍 3 resultados
       ├── [0.89] ADR-005: Escolha do NextAuth.js
       ├── [0.72] NOTA: Provider Google + GitHub configurados
       └── [0.45] PR #42: Review do fluxo de refresh token

Você:  /ov-read viking://projetos/web-app/adrs/ADR-005-escolha-nextauth.md
       (Lê abstract → parece relevante → pede read)
       /ov-read viking://projetos/web-app/adrs/ADR-005-escolha-nextauth.md
       level:read

Pi:    Contexto carregado. ADR-005 explica por que NextAuth foi escolhido
       (vs Auth0, vs Clerk). Decisão: custo + simplicidade.

Você:  Qual endpoint de callback configurar?

Pi:    (Auto-recall já injetou as memórias relevantes)
       Segundo a nota sobre providers, o callback é /api/auth/callback
       O PR #42 mencionou que o refresh token expira em 1h.

Você:  Implementa. Salva o aprendizado.

       /ov-save viking://projetos/web-app/notes/
       "fluxo-auth-implementado.md"

       # Conteúdo:
       # Fluxo de Autenticação — 24/05/2026
       #
       ## Provider: NextAuth.js
       ## Callback: /api/auth/callback
       ## Refresh token: 1h (configurado no JWT strategy)
       ## Lição: middleware de rota precisa excluir /api/auth/*
```

### 5.2 Tarde — Debug de bug com grafo

**Cenário:** Um bug de produção. Você quer entender a cadeia de
decisões que levou ao código problemático.

```
Você:  /ov-graph viking://projetos/web-app/code/lib/auth.ts

Pi:    Grafo de conhecimento para lib/auth.ts:
       ├── → depende_de → lib/jwt.ts
       ├── → depende_de → lib/session.ts
       ├── ← implementa → issue #89 "Implementar JWT rotativo"
       ├── ← revisado_por → PR #42 "Review fluxo auth"
       ├── ← fundamenta → ADR-005 "Escolha do NextAuth.js"
       └── ← referencia → docs/security/authentication.md

       Seguindo o link para PR #42:
       → Comentário do reviewer: "a rotação de JWT não está
         atualizando o cookie de sessão"

Você:  /ov-graph viking://.../PR-42 --depth 3

Pi:    PR #42 → menciona → issue #93 "Cookie de sessão não atualizado"
       → issue #93 → implementa → hotfix/1.2.1
       → hotfix/1.2.1 → testado_por → teste E2E: `auth-rotation.spec.ts`
```

**Workflow de debug completo:**

1. Identifica o arquivo problemático
2. Navega o grafo para achar decisões relacionadas
3. Segue links para PRs, issues, ADRs
4. Entende a cadeia causal
5. Corrige e salva: `memsave` com lição aprendida
6. Relaciona: `memlink` correção → bug → PR

### 5.3 Tarde — Onboarding num novo projeto

**Cenário:** Você acabou de ser transferido para um novo time.

```
Você:  Limpa workspace.
       /ov-commit (comita sessão atual)
       /ov-profile apply fullstack-app

       (O profile configura:
        - target_uri: viking://fullstack-app/
        - topN: 5 (projeto novo, muita descoberta)
        - threshold: 0.2 (baixo para não perder nada)
        - budget: 1000 (contexto grande)
       )

       1. /ov-search "arquitetura do projeto"
       2. /ov-search "decisões de tecnologia"
       3. /ov-search "padrões de código"
       4. /ov-read viking://fullstack-app/adrs/ADR-001.md

Pi:    (Auto-recall ajuda sem você pedir)
       Antes de cada resposta, já injeta memórias do fullstack-app.

       Após entender o projeto:
       /ov-save viking://fullstack-app/notes/
         "onboarding-2026-05-24.md"

       # Lições do onboarding:
       # - Stack: Next.js 14 + Prisma + tRPC
       # - ADRs: 7 documentados
       # - Testes: Vitest + Playwright
       # - Pontos de atenção: migração de BD manual
```

### 5.4 Sessão de Arquitetura — Decisão estruturada

**Cenário:** Vocês decidem migrar de REST para tRPC.

```
Você:  /ov-mkdir viking://projetos/web-app/adrs/2026/

       /ov-save viking://projetos/web-app/adrs/2026/
         "ADR-008-migrar-tRPC.md"

       # Conteúdo:
       # # ADR-008: Migrar de REST para tRPC
       #
       # Status: Proposto
       # Data: 2026-05-24
       #
       ## Contexto
       # APIs REST estão ficando difíceis de manter.
       # 5 endpoints por feature. Tipagem duplicada.
       #
       ## Decisão
       # Adotar tRPC para novos endpoints.
       # REST existente será mantido até v3.
       #
       ## Consequências
       # Positivo: tipos compartilhados, sem schemas extras
       # Negativo: lock-in com Next.js

       /ov-link adrs/2026/ADR-008-migrar-tRPC.md \
                notes/benchmark-rest-vs-trpc.md \
                fundamenta

       /ov-link adrs/2026/ADR-008-migrar-tRPC.md \
                issues/issue-142-migrar-api.md \
                implementa
```

### 5.5 Fim do dia — Commit e backup

```
Você:  /ov-stats
Pi:    📊 47 memórias · 23 recursos · 5 skills · 3.2 MB
       ├── Eventos: 31
       ├── Preferências: 12
       └── Entidades: 4

Você:  /ov-commit
Pi:    ✓ Session comitted. Task: d8f3a... (status: running)

       (O servidor extrai memórias da conversa de hoje)

Você:  /ov-pack-export --uri viking://projetos/web-app/
Pi:    ✓ Backup: web-app-2026-05-24.ovpack (1.2 MB)
```

---

## 6. Configurações Avançadas

### 6.1 Perfis de Configuração

Múltiplos perfis que se aplicam dependendo do workspace:

```json
// .pi/settings.json
{
  "openVikingProfiles": {
    "web-dev": {
      "targetUri": "viking://projetos/web-app/",
      "autoRecallTopN": 3,
      "autoRecallScoreThreshold": 0.3,
      "autoRecallTokenBudget": 500,
      "autoRecallPreferAbstract": true,
      "searchDefaultMode": "deep"
    },
    "docs": {
      "targetUri": "viking://docs/",
      "autoRecallTopN": 5,
      "autoRecallScoreThreshold": 0.2,
      "autoRecallTokenBudget": 700,
      "autoRecallPreferAbstract": false,
      "searchDefaultMode": "fast"
    },
    "learning": {
      "targetUri": null,
      "autoRecallTopN": 8,
      "autoRecallScoreThreshold": 0.1,
      "autoRecallTokenBudget": 1000,
      "preferAbstract": false,
      "searchDefaultMode": "deep"
    }
  },
  "openVikingAutoDetectProfile": {
    "**/my-react-app/**": "web-dev",
    "**/documentation/**": "docs"
  }
}
```

Troca manual:

```bash
/ov-profile apply web-dev
/ov-profile list   # lista perfis disponíveis
/ov-profile show   # mostra perfil ativo + parâmetros
```

### 6.2 Cascading Config — Tudo customizável

A ordem de precedência (último vence):

1. **Defaults compilados** (código)
2. **Variáveis de ambiente** (`OPENVIKING_*`)
3. **`.pi/settings.json`** (por workspace)
4. **Perfil ativo** (`/ov-profile apply X`)
5. **Flags inline** (parâmetros diretos nas ferramentas)

```bash
# Exemplo: tudo configurável
export OPENVIKING_ENDPOINT=https://ov.meu-time.com
export OPENVIKING_AUTO_RECALL=false
export OPENVIKING_LOG_FILE=/var/log/pi-ov.log

# Ou via .pi/settings.json
{
  "openVikingEndpoint": "https://ov.meu-time.com",
  "openVikingAutoRecall": false,
  "openVikingAutoRecallTopN": 5,
  "openVikingTimeout": 60000
}
```

### 6.3 Escopo de Auto-recall

```json
{
  "openVikingAutoRecallMode": "scoped",
  "openVikingAutoRecallTargetUri": "viking://projetos/web-app/",
  "openVikingAutoRecallFallback": true
  // Se não achar nada no escopo, busca global
}
```

### 6.4 Agendamento de Backup

```json
{
  "openVikingBackup": {
    "enabled": true,
    "interval": "24h",
    "path": "/backups/ov/",
    "onShutdown": true,
    "keepLast": 7
  }
}
```

### 6.5 Notificações e Watch

```json
{
  "openVikingWatches": {
    "async": true,
    "defaultTimeout": 30000,
    "autoClean": true,
    "handlers": {
      "onResourceAdded": "refreshAutocomplete",
      "onMemoryExtracted": "updateStats"
    }
  }
}
```

---

## 7. Integrações

### 7.1 Git Hook — Auto-commit ao push

```bash
# .git/hooks/pre-push
#!/bin/bash
echo "→ Comitando sessão Pi para OpenViking..."
pi -c "/ov-commit"
```

### 7.2 CI/CD — Verificar documentação

```yaml
# .github/workflows/ov-check.yml
name: OV Docs Check
on: [pull_request]

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verificar docs no OV
        run: |
          pi -c "/ov-glob docs/**/*.md || echo '⚠️ docs.md ausente'"
```

### 7.3 VS Code Extension Hook

```json
// .vscode/settings.json
{
  "pi.openViking.enabled": true,
  "pi.openViking.onFileOpen": ["/ov-search {filename}"],
  "pi.openViking.onSave": ["/ov-save {file}"]
}
```

### 7.4 MCP Server (para outros agentes)

```json
// mcp.json
{
  "servers": {
    "openviking": {
      "transport": "stdio",
      "command": "pi",
      "args": ["--mcp", "openviking"]
    }
  }
}
```

### 7.5 Webhook: Notificação de memórias extraídas

```bash
# Configurar webhook no OV
memwatch({
  uri: "viking://user/default/memories/**",
  webhook: "http://localhost:1934/pi-ov-callback"
})

# Callback recebe:
# POST /pi-ov-callback
# {
#   "event": "memory_created",
#   "uri": "viking://user/default/memories/events/2026/05/24/foo.md",
#   "type": "events"
# }
```

---

## 8. Arquitetura do Conhecimento

### 8.1 Estrutura de diretórios recomendada

```
viking://
├── docs/                          # Documentação técnica
│   ├── architecture.md
│   ├── api-spec.yaml
│   └── decisions/
│       └── ADR-001.md
│
├── projetos/                      # Por projeto
│   ├── web-app/
│   │   ├── adrs/
│   │   ├── notes/
│   │   ├── benchmarks/
│   │   └── templates/
│   └── mobile-app/
│
├── skills/                        # Skills do agente
│   ├── debug-memory-leaks.md
│   └── code-review.md
│
└── user/
    └── default/
        ├── memories/
        │   ├── events/            # Extraídas automaticamente
        │   ├── preferences/       # Preferências do usuário
        │   └── entities/          # Entidades do domínio
        └── privacy/               # Configs de privacidade
```

### 8.2 Padrão: Decisão → Evidência → Implementação

```
┌──────────────────┐       fundamenta       ┌──────────────────┐
│   ADR-008: tRPC  │──────────────────────▶│ Benchmark tRPC   │
│   (decisão)      │                       │ vs REST          │
└────────┬─────────┘                       └──────────────────┘
         │                                        ▲
         │ implementa                              │
         ▼                                        │
┌──────────────────┐                              │
│ Issue #142       │── referencia ────────────────┘
│ Migrar API       │
└────────┬─────────┘
         │ implementa
         ▼
┌──────────────────┐
│ PR #89           │
│ tRPC migration   │
└────────┬─────────┘
         │ revisado_por
         ▼
┌──────────────────┐
│ Review PR #89    │
│ (por Maria)      │
└──────────────────┘
```

### 8.3 Níveis de abstração

Cada recurso pode ter três níveis de detalhe:

```
Recurso: architecture.md

L0 (abstract): "Documento de arquitetura do web-app.
                Stack: Next.js + Prisma + tRPC. 3 ADRs."
L1 (overview): "# Arquitetura\n\nStack: ...\nDecisões: ...\n...
                (primeiros 2000 tokens)"
L2 (read):     "# Arquitetura\n\n## Stack\nNext.js 14...\n...
                (documento completo)"
```

Isso permite que o auto-recall injete só L0 (abstract) no contexto,
economizando tokens, e o agente pode pedir L1 ou L2 quando precisar.

---

## 9. Solução de Problemas

| Problema | Causa provável | Solução |
|----------|---------------|---------|
| `memsearch` retorna 0 resultados | OV sem dados ou embedding falhou | Verificar `/ov-stats`. Tentar `memreindex` |
| Auto-recall não injeta memórias | OV offline ou config `enabled: false` | `/ov-status`. Verificar `.pi/settings.json` |
| `memcommit` trava | Sessão grande ou OV lento | Tentar `memcommit { wait: false }`. Verificar logs |
| `memsave` não aparece em busca | Embedding não foi gerado | `memreindex` no URI salvo |
| Link não aparece no grafo | Relação não indexada | `memreindex` nos dois URIs |
| Servidor OV reiniciou | Docker morreu | `docker compose restart`. Verificar `/health` |
| Backup corrompido | Disco cheio | Liberar espaço. Restaurar backup anterior |
| Session sync parou | Circuit breaker (3 falhas) | Recupera automaticamente na próxima tool call |
| `memimport` falha para diretório | Zip muito grande | Importar arquivos individualmente |

### Logs

```bash
# Ver logs do plugin
tail -f ~/.pi/agent/pi-openviking.log

# Ver logs do servidor
docker logs pi-openviking --tail 50
```

---

## 10. Referência Rápida

### 10.1 Cheat Sheet — Ferramentas

```
BUSCA:
  memsearch(query, mode?, uri?)          → busca semântica
  memglob(pattern, limit?)               → busca por path
  memgrep(pattern, regex?, uri?)         → busca por texto

LEITURA:
  memread(uri, level?)                   → ler conteúdo
  membrowse(uri, view?, recursive?)      → navegar filesystem
  memgraph(uri, depth?)                  → ver grafo

ESCRITA:
  memsave(uri, content, mime?)           → salvar conteúdo
  memmkdir(uri)                          → criar diretório
  memmv(from, to)                        → mover/renomear
  memdelete(uri, recursive?)             → deletar

IMPORT/EXPORT:
  memimport(source, kind?, reason?, to?) → importar
  memdownload(uri)                       → baixar
  memexport(uri, format?)                → backup
  memimport-pack(source, strategy?)      → restaurar

RELAÇÕES:
  memlink(source, target, predicate?)    → criar relação
  memunlink(source, target)              → remover relação

SESSÃO:
  memcommit(wait?)                       → comitar sessão
  memreindex(uri, recursive?)            → reindexar

INFRA:
  memwatch(uri, callback?)               → observar mudanças
```

### 10.2 Cheat Sheet — Comandos

```
/ov-search <query>         /ov-save <uri>          /ov-commit
/ov-glob <pattern>         /ov-mkdir <uri>         /ov-recall [on|off]
/ov-grep <pattern>         /ov-mv <from> <to>      /ov-stats
/ov-ls [uri]               /ov-import <src>        /ov-status
/ov-read <uri>             /ov-delete <uri>        /ov-profile
/ov-graph <uri>            /ov-link <src> <tgt>    /ov-reindex [uri]
                           /ov-download <uri>      /ov-watch [uri]
```

### 10.3 Config Rápida

```bash
# Mínimo para começar
echo '{"extensions":["./src/index.ts"]}' > .pi/settings.json
docker compose up -d
pi -c "/ov-status"
```

### 10.4 Ciclo de Vida do Conhecimento

```
APRENDER                          RELEMBRAR
────────────────────────────────────────────────────
1. Conversar com Pi              1. Pi inicia sessão
2. Decisão é tomada               2. Auto-recall busca
3. memsave() salva                3. Memórias injetadas
4. memlink() conecta              4. Contexto enriquecido
5. memcommit() extrai             5. Resposta relevante
6. memreindex() indexa
7. memexport() backup
```

---

> **Manual gerado em 24/05/2026** para pi-openviking v1.0 (hipotético).
> Gaps documentados em `docs/gaps/`. Implementação completa depende
> de mapear ~67 endpoints OV ainda não utilizados.
