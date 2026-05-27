import { DomainError } from "./domain-error";

export class ConnectionError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
