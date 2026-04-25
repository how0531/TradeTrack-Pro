/**
 * 券商相關型別定義
 */

export interface BrokerConfig {
  id: string; // Unique identifier for the account
  alias?: string; // Optional user-defined name
  provider: 'mock' | 'shioaji';
  apiKey: string;
  apiSecret: string;
  personId: string;
  branch?: string; // e.g. "新店"
  branch_name?: string; // e.g. "新店 (STOCK)"
  branchCode?: string; // e.g. "9A95"
  accounts?: string; // Comma-separated list of account numbers (e.g. "9162673,9162674")
  brokerUsername?: string; // e.g. "SimulationUser"
  environment?: 'production' | 'simulation';
  caPath: string;
  caPassword: string;
  isConnected: boolean;
  apiKeyHint?: string; // Hint derived from the actual key used by the backend
  caContent?: string;  // Base64 content of the .pfx file for dynamic uploads
  accountType?: 'S' | 'F'; // Optional type filter for PnL fetching (S=Stock, F=Future)
  signedAccounts?: string; // Comma-separated list of account IDs that have API access
}

export interface BrokerProfile {
  status?: string;
  branch?: string;
  branchCode?: string;
  username?: string;
  environment?: 'production' | 'simulation';
  apiKeyHint?: string;
  accountId?: string; // Individual account ID for single account login
  accounts?: BrokerAccount[];
}

export interface BrokerAccount {
  branch_code: string;
  branch_name: string;
  account_id: string;
  account_type?: string;
  username?: string;
  signed?: boolean;
}

export interface TransactionDetail {
  accountId?: string;
  date: string;
  category: string;
  code: string;
  quantity: number;
  price: number;
  buyAmt: number;
  sellAmt: number;
  pnl: number;
  yield: number;
  orderNo: string;
  currency?: string;
  entryPrice?: number;
  exitPrice?: number;
}

export interface AccountSummary {
  account_id: string;
  account_type: string;
  signed: boolean;
  record_count: number;
  pnl: number;
  status: 'ok' | 'empty' | 'error' | 'skipped';
  reason: string | null;
}

export interface BrokerSyncResult {
  totalPnl: number;
  dailyResults: { date: string; pnl: number }[];
  details: TransactionDetail[];
  caStatus?: 'activated' | 'not_activated';
  emptyReason?: 'ca_not_activated' | 'no_trades_in_range' | string | null;
  // Per-account diagnostic — surfaces "which account got how many records and why" so
  // the user can self-diagnose blank PnL screens (CA off, unsigned account, empty range, etc.)
  accountSummaries?: AccountSummary[];
  emptyDiagnostic?: string | null;
  dateRangeUsed?: { start: string; end: string };
}

// BackendStatus is defined in src/context/BackendContext.tsx
