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
  date: string;       // 成交日期
  category: string;   // 類別 (現股)
  code: string;       // 商品 (2890 永豐金)
  quantity: number;   // 成交數量
  price: number;      // 成交價格
  buyAmt: number;     // 買進金額
  sellAmt: number;    // 賣出金額
  pnl: number;        // 損益
  yield: number;      // 報酬率 (%)
  orderNo: string;    // 委託單號
  currency: string;   // 幣別
}

export interface BrokerSyncResult {
  totalPnl: number;
  dailyResults: { date: string; pnl: number }[];
  details: TransactionDetail[];
}

export type BackendStatus = 'ready' | 'server_only' | 'offline' | 'checking' | 'sleeping';
