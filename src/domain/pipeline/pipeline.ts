export type Middleware<T> = (
  next: () => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

export class Pipeline<T> {
  private readonly middlewares: Middleware<T>[] = [];

  use(mw: Middleware<T>): this {
    this.middlewares.push(mw);
    return this;
  }

  async execute(
    handler: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    let chain = handler;
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const mw = this.middlewares[i];
      const next = chain;
      chain = () => mw(next, signal);
    }
    return chain();
  }
}
