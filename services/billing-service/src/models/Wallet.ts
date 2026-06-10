export class Wallet {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public availableBalance: number,
    public parkedBalance: number,
    public readonly currency: string = 'INR'
  ) {}

  public get totalBalance(): number {
    return this.availableBalance + this.parkedBalance;
  }

  public hasSufficientBalance(amount: number): boolean {
    return this.availableBalance >= amount;
  }

  public parkFunds(amount: number): void {
    if (!this.hasSufficientBalance(amount)) {
      throw new Error('INSUFFICIENT_FUNDS');
    }
    this.availableBalance -= amount;
    this.parkedBalance += amount;
  }

  public unparkFunds(amount: number): void {
    if (this.parkedBalance < amount) {
      throw new Error('INVALID_UNPARK_AMOUNT');
    }
    this.parkedBalance -= amount;
    this.availableBalance += amount;
  }

  public deduct(amount: number): void {
    if (!this.hasSufficientBalance(amount)) {
      throw new Error('INSUFFICIENT_FUNDS');
    }
    this.availableBalance -= amount;
  }

  public deductParked(amount: number): void {
    if (this.parkedBalance < amount) {
      throw new Error('INSUFFICIENT_PARKED_FUNDS');
    }
    this.parkedBalance -= amount;
  }

  public addFunds(amount: number): void {
    if (amount <= 0) throw new Error('AMOUNT_MUST_BE_POSITIVE');
    this.availableBalance += amount;
  }
}
