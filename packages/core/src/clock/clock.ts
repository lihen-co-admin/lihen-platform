export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}

export class FakeClock implements Clock {
  public constructor(private readonly current: Date) {}

  public now(): Date {
    return new Date(this.current);
  }
}
