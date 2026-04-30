export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  TRIALING = 'TRIALING'
}

export class Subscription {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly planId: string,
    public status: SubscriptionStatus,
    public currentPeriodStart: Date,
    public currentPeriodEnd: Date,
    public cancelAtPeriodEnd: boolean = false
  ) {}

  public isGracePeriod(): boolean {
    if (this.status !== SubscriptionStatus.PAST_DUE) return false;
    const now = new Date();
    const gracePeriodMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    return now.getTime() - this.currentPeriodEnd.getTime() <= gracePeriodMs;
  }

  public renew(newEndDate: Date): void {
    this.status = SubscriptionStatus.ACTIVE;
    this.currentPeriodStart = new Date(); // or keep continuous depending on logic
    this.currentPeriodEnd = newEndDate;
  }
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PAID = 'PAID',
  VOID = 'VOID',
  UNCOLLECTIBLE = 'UNCOLLECTIBLE'
}

export class Invoice {
  constructor(
    public readonly id: string,
    public readonly workspaceId: string,
    public readonly amount: number,
    public readonly currency: string,
    public status: InvoiceStatus,
    public readonly lineItems: { description: string, amount: number }[],
    public readonly dueDate: Date,
    public readonly pdfUrl?: string
  ) {}
}
