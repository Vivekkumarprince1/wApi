# Billing, Credits & Ledger System

wApi uses a credit-based billing system where workspaces maintain a wallet balance for messaging and subscription costs.

## 1. The Wallet Model

Credits are stored as integers in **Paise** (1/100th of an INR) to avoid floating-point inaccuracies.
- `walletBalance`: The active balance available for spending.
- `walletParkedBalance`: Funds reserved for active campaigns.

## 2. Ledger Operations (`LedgerService`)

All financial operations are wrapped in **MongoDB ACID Transactions** to ensure consistency even in the event of server failures.

### Key Operations:

#### `deduct(amount, metadata)`
- **When**: Used for sending a single message or buying a subscription.
- **Process**:
  1. Starts a session.
  2. Checks if `balance >= amount`.
  3. Updates `walletBalance`.
  4. Creates a `WalletTransaction` record with `referenceType` (e.g., "MESSAGE", "CAMPAIGN").
  5. Commits.

#### `park(amount, campaignId)`
- **When**: Triggered before a bulk campaign starts.
- **Why**: To "lock" the maximum possible spend for a campaign so the user doesn't overspend their wallet while the campaign is running.
- **Process**: Moves `amount` from `walletBalance` to `walletParkedBalance`.

#### `resolveCampaign(actualSpent, campaignId)`
- **When**: After a campaign finishes.
- **Process**: 
  1. Calculates `refund = parked - actualSpent`.
  2. Moves `refund` back to `walletBalance`.
  3. Clears the parked amount for that campaign.

## 3. Usage Tracking (`UsageTracker`)

The `UsageTracker` is a lightweight service called by other modules (Messaging, Contacts, CRM) to increment counters for billable entities.
- It helps enforce plan limits (e.g., "Standard Plan allows 5000 contacts").
- It provides data for the usage charts in the Dashboard.

## 4. Payment Gateway Integration

- **Razorpay**: Integrated for wallet recharges and subscription payments.
- **Idempotency**: Every recharge uses an `externalReferenceId` (the Razorpay Payment ID). If the same ID is sent twice (e.g., due to a webhook retry), the `LedgerService` detects the existing transaction and prevents a double credit.

## 5. Real-time Synchronization

Whenever the wallet balance changes, a socket event `workspace:wallet_update` is emitted. This ensures the user's dashboard header always shows the correct current balance without requiring a page refresh.
