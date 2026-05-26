# pi-openviking — Visão Geral

> Extensão de memória persistente para o agente Pi.
> Conecta o Pi ao OpenViking, um banco de conhecimento com
> busca semântica, grafo de relações e sistema de arquivos virtual.

## O problema

O Pi é estateless entre sessões. Cada conversa começa do zero.
Decisões tomadas, preferências expressas, descobertas feitas —
tudo se perde quando a sessão termina.

## A solução

O OpenViking (OV) é um servidor de memória persistente. O
pi-openviking conecta o Pi a ele, permitindo:

1. **Salvar conhecimento**: decisões de arquitetura, preferências,
   notas técnicas, documentação relevante
2. **Recuperar automaticamente**: antes de cada resposta, o Pi
   busca memórias relevantes e as injeta no contexto
3. **Navegar o conhecimento**: sistema de arquivos virtual
   (`viking://`), busca semântica, grafo de relações

## O que NÃO é

- **Não substitui Git.** Código fonte mora no Git. OV guarda
  _conhecimento sobre_ o código.
- **Não substitui o Pi.** Pi mantém o histórico da conversa.
  OV só guarda o que foi extraído como memória.
- **Não é automático mágico.** O usuário (ou agente) decide
  o que salvar. Auto-recall ajuda, mas não decide sozinho.

## Conceitos fundamentais

```yaml
# Como o plugin se conecta ao OV
Pi Agent → pi-openviking (plugin) → HTTP API → OpenViking Server

# Como o conhecimento flui
Conversa → memsave() → viking:// filesystem → indexação → busca semântica
Sessão   → memcommit() → extração → memórias → auto-recall

# Autonomia progressiva
Nível 1 (off)    → Só faz o que você mandar
Nível 2 (propose)  → Detecta oportunidade, SUGERE, você confirma  [DEFAULT]
Nível 3 (auto)     → Detecta e EXECUTA automaticamente
```

## Perfis de uso

| Perfil | Para quem | Escopo | Automação |
|--------|-----------|--------|-----------|
| `default` | Uso geral | Global | Propositiva |
| `web-dev` | Desenvolvimento de projeto | Escopado | Propositiva |
| `docs` | Documentação | Global | Off |
| `learning` | Aprendizado máximo | Global | Automática |

## Stack

- **Runtime:** Node.js / Bun
- **Framework:** Pi Agent SDK (`@earendil-works/pi-*`)
- **Servidor:** OpenViking (Docker, v0.3+)
- **Config:** Zod schema + cascading (env → file → profile)
- **Testes:** Vitest
- **Arquitetura:** Hexagonal (Ports & Adapters)
