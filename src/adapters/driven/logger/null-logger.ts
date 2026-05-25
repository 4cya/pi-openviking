import type { Logger, LogLevel } from "../../../domain/ports/logger";

export class NullLogger implements Logger {
  debug(_msg: string, _ctx?: Record<string, unknown>): void {}
  info(_msg: string, _ctx?: Record<string, unknown>): void {}
  warn(_msg: string, _ctx?: Record<string, unknown>): void {}
  error(_msg: string, _ctx?: Record<string, unknown>): void {}
  isEnabled(_level: LogLevel): boolean { return false; }
}
