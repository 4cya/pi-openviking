# pi-openviking — Visão Geral

> Extensão de memória persistente para o agente Pi.
> Conecta o Pi ao OpenViking, um banco de conhecimento com
> busca semântica, grafo de relações e sistema de arquivos virtual.

## O problema

O Pi é stateless entre sessões. Cada conversa começa do zero.
Decisões tomadas, preferências expressas, descobertas feitas —
tudo se perde quando a sessão termina.

## A solução

O OpenViking (OV) é um servidor de memória persistente. O
pi-openviking conecta o Pi a ele, permitindo:

1. **Auto-recall**: antes de cada resposta do agente, o plugin
   busca memórias relevantes no OV e as injeta no contexto automaticamente.
2. **Session sync**: mensagens da conversa são sincronizadas com
   uma sessão OV em tempo real. Ao final da sessão, o commit
   dispara a extração de memórias no servidor.
3. **Busca semântica**: encontre memórias, recursos e skills
   pelo significado, não só por palavras-chave.
4. **Sistema de arquivos virtual**: acesse e armazene conhecimento
   em uma hierarquia `viking://` com leitura em múltiplos níveis
   (L0 abstrato, L1 overview, L2 completo).
5. **Grafo de relações**: conecte recursos relacionados e
   expanda o recall navegando relações.
6. **Perfis comportamentais**: troque entre presets (`default`,
   `web-dev`, `docs`, `learning`) que ajustam topN, threshold,
   escopo, modo de busca e expansão de grafo.

## O que NÃO é

- **Não substitui Git.** Código fonte mora no Git. OV guarda
  _conhecimento sobre_ o código.
- **Não substitui o Pi.** Pi mantém o histórico da conversa.
  OV só guarda o que foi extraído como memória.
- **Não tem auto-save heurístico.** O plugin segue o padrão
  OpenClaw: commit da sessão dispara extração no servidor;
  o agente usa `ov_write` explicitamente quando precisa salvar.

## Como o conhecimento flui

```
Sessão Pi → message_end hook → sendMessage() → OV session
         → session_shutdown → commit() → OV extrai memórias
         → before_agent_start → recall() → memórias no contexto
         
Agente → ov_write → viking:// filesystem → indexação → busca semântica
       → ov_read  → L0/L1/L2 content
       → ov_search/ov_glob/ov_grep → resultados tipados
```

## Perfis de uso

| Perfil | Para quem | Comportamento |
|--------|-----------|---------------|
| `default` | Uso geral | topN=3, threshold=0.5, search mode |
| `web-dev` | Desenvolvimento de projeto | topN=3, threshold=0.5, search mode |
| `docs` | Documentação | topN=5, threshold=0.3, busca ampla |
| `learning` | Aprendizado máximo | topN=8, threshold=0.2, captura tudo |

## Stack

- **Runtime:** Node.js / Bun
- **Framework:** Pi Agent SDK (`@earendil-works/pi-*`)
- **Servidor:** OpenViking (Docker, v0.3+)
- **Config:** Zod schema + cascading (defaults → env → file → profile)
- **Testes:** Vitest
- **Arquitetura:** Hexagonal (Ports & Adapters)
