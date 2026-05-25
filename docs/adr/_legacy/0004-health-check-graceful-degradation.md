# Health check com graceful degradation no bootstrap

Bootstrap tenta `GET /health` no servidor OpenViking antes de wirear auto-recall. Se falha, registra tools e commands normalmente, mas desabilita auto-recall e marca `serverAvailable = false`. Recovery é on-demand: antes de cada auto-recall ou tool call, se `serverAvailable === false`, tenta health check novamente e reabilita se passar. Circuit breaker no session sync: após 3 falhas consecutivas em `onMessageEnd`, para de tentar até próximo recovery.

**Considered Options**: (A) Graceful degradation (escolhido) vs (B) Fail-fast — não registrar extension se server indisponível. Escolhido (A) porque Pi deve funcionar sem OV. Server down não é condição de erro, é estado normal quando usuário não precisa de memória. Consistente com ADR-001 (shutdown zero I/O).

**Consequences**: Ferramentas falham com erro claro se chamadas com server down. Primeira tool call após recovery tem latência extra do health check. Nenhum background timer — zero lifecycle complexity.
