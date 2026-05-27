import { DomainError } from "./domain-error";

export class ValidationError extends DomainError {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
    code?: string,
  ) {
    super(message, code);
  }
}
