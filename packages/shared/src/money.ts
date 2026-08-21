export type Currency = 'COP' | 'USD' | 'EUR';

export class Money {
  public readonly amount: number;
  public readonly currency: Currency;

  public constructor(amount: number, currency: Currency = 'COP') {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Money amount must be a finite non-negative number.');
    }

    this.amount = amount;
    this.currency = currency;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  public equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error('Cannot operate on Money values with different currencies.');
    }
  }
}
