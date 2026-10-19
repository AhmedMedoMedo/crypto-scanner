export interface StrategyBreakdown {
  trend: number;
  volume: number;
  rsi: number;
  setup: number;
  btc: number;
  candle: number;
  confirm?: number;
}

export interface Trade {
  docId: string;
  symbol: string;
  entryPrice: number;
  currentPrice?: number;
  maxPrice?: number;
  trailActive?: boolean;
  slLevel?: number;
  status: 'open' | 'won' | 'lost' | 'canceled';
  openTime: number;
  closeTime?: number;
  pnl?: number;
  strategy?: 'Momentum' | 'Breakout' | 'Sniper' | 'BB_RSI' | 'TurboScalp' | 'Manual' | string;
  entryScore?: number;
  liveScore?: number;
  entryBreakdown?: StrategyBreakdown;
  liveBreakdown?: StrategyBreakdown;
}

export interface StrategyFlags {
  momentum: boolean;
  breakout: boolean;
  sniper: boolean;
  bbrsi?: boolean;
  turboScalp?: boolean;
}

export interface ScannerSettings {
  tf: string;
  sl_perc: number;
  min_tp: number;
  trail_dist: number;
  vol_mult: number;
  cooldown_mins: number;
  auto_kill: boolean;
  strats: StrategyFlags;
}

export interface MarketScoreLogEntry {
  time: number;
  score: number;
}

export interface MarketHealthData {
  score: number;
  status?: string;
  log?: MarketScoreLogEntry[];
}

export interface ExplosionCandidate {
  symbol: string;
  price: number;
  score: number;
  reasons: string[];
  bbw: string;
  target: string;
}
