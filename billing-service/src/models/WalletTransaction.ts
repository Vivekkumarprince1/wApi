export enum TransactionType {
  RECHARGE = 'RECHARGE',
  SPEND = 'SPEND',
  PARK = 'PARK',
  UNPARK = 'UNPARK',
  REFUND = 'REFUND',
  DEDUCTION = 'DEDUCTION' // e.g. monthly subscription fee
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export class WalletTransaction {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly amount: number,
    public readonly type: TransactionType,
    public readonly previousBalance: number,
    public readonly newBalance: number,
    public readonly description: string,
    public readonly referenceType?: string,
    public readonly referenceId?: string,
    public readonly externalReferenceId?: string,
    public status: TransactionStatus = TransactionStatus.COMPLETED,
    public readonly createdAt: Date = new Date()
  ) {}
}
