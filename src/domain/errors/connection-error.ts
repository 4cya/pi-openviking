import { DomainError } from "./domain-error";

export class ConnectionError extends DomainError {
  constructor(message: string, code?: string) {
    super(message, code);
  }
}
