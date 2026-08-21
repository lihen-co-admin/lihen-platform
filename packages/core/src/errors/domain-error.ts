export class DomainError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ValidationError extends DomainError {
  public constructor(message: string) {
    super('VALIDATION_ERROR', message);
  }
}

export class PermissionDeniedError extends DomainError {
  public constructor(message = 'Permission denied.') {
    super('PERMISSION_DENIED', message);
  }
}

export class DuplicateOperationError extends DomainError {
  public constructor(operationKey: string) {
    super('DUPLICATE_OPERATION', `Operation ${operationKey} has already been processed.`);
  }
}
