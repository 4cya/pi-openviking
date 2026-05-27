export class TokenBudget {
  constructor(
    readonly maxTokens: number,
    public used: number = 0,
  ) {}

  remaining(): number {
    return Math.max(0, this.maxTokens - this.used);
  }

  tryAllocate(count: number): boolean {
    if (this.remaining() < count) return false;
    this.used += count;
    return true;
  }

  reset(): void {
    this.used = 0;
  }
}
