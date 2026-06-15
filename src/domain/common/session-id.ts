export class SessionId {
  constructor(readonly value: string) {
    if (!value) throw new Error("SessionId cannot be empty");
  }

  toString(): string {
    return this.value;
  }
}
