export interface LogContext {
  readonly module?: string;
  readonly operation?: string;
  readonly entityId?: string;
  readonly operationKey?: string;
  readonly errorCode?: string;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
