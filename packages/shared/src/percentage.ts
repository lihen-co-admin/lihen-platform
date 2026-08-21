export class Percentage {
  public readonly value: number;

  public constructor(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error('Percentage must be between 0 and 100.');
    }
    this.value = value;
  }
}
