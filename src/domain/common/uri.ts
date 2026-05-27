export class Uri {
  constructor(readonly value: string) {
    if (!value) throw new Error("Uri cannot be empty");
    if (!value.startsWith("viking://")) {
      throw new Error(`Invalid URI: "${value}" — must start with viking://`);
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: Uri): boolean {
    return this.value === other.value;
  }
}
