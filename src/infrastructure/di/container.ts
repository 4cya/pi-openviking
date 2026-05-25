export class DIContainer {
  private entries = new Map<string, { factory: () => unknown; singleton: boolean; instance?: unknown }>();

  register<T>(token: string, factory: () => T, singleton?: boolean): void {
    this.entries.set(token, { factory, singleton: singleton ?? false });
  }

  resolve<T>(token: string): T {
    const entry = this.entries.get(token);
    if (!entry) throw new Error(`DI: ${token} not registered`);

    if (entry.singleton) {
      if (!entry.instance) {
        entry.instance = entry.factory();
      }
      return entry.instance as T;
    }

    return entry.factory() as T;
  }
}
