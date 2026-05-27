import { DomainError } from "./domain-error";

export class NotFoundError extends DomainError {
  constructor(message: string, code?: string) {
    super(message, code);
  }
}
