export class DomainError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConnectionError extends DomainError {
  constructor(message: string, code?: string) {
    super(message, code);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, code?: string) {
    super(message, code);
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
    code?: string,
  ) {
    super(message, code);
  }
}
