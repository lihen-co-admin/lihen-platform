export interface IdGenerator {
  generate(): string;
}

export class UuidGenerator implements IdGenerator {
  public generate(): string {
    return crypto.randomUUID();
  }
}

export class FakeIdGenerator implements IdGenerator {
  public constructor(private readonly id: string) {}

  public generate(): string {
    return this.id;
  }
}
