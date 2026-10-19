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

export interface TimeframeMatrixScore {
  tf: '1m' | '5m' | '15m' | '1h' | '4h' | string;
  score: number;
  status: 'bullish' | 'neutral' | 'bearish';
  rsi: number;
  trend: 'up' | 'down' | 'flat';
  volRatio: number;
  label: string;
}

export interface MarketHealthData {
  score: number;
  status?: string;
  log?: MarketScoreLogEntry[];
  matrix?: {
    '1m'?: TimeframeMatrixScore;
    '5m'?: TimeframeMatrixScore;
    '15m'?: TimeframeMatrixScore;
    '1h'?: TimeframeMatrixScore;
    '4h'?: TimeframeMatrixScore;
  };
  macroScore?: number;
  microScore?: number;
  macroStatus?: 'bullish' | 'neutral' | 'bearish';
  microStatus?: 'bullish' | 'neutral' | 'bearish';
  macroMicroSynergy?: 'PERFECT_5_TF' | 'STRONG_TREND' | 'MIXED_DIVERGENCE' | 'BEARISH_DANGER';
  synergyLabel?: string;
  alignment?: 'full' | 'partial' | 'divergent';
  scalpOpportunity?: boolean;
  recommendation?: string;
  targetProjection?: string;
}

export interface ExplosionCandidate {
  rank?: number;
  symbol: string;
  price: number;
  score: number;
  reasons: string[];
  bbw: string;
  target: string;
  tradeType?: 'SCALP' | 'SWING_1_2_DAYS';
  holdingPeriod?: string;
  slPrice?: number;
  slPercent?: string;
  riskReward?: string;
  volSpikeRatio?: string;
  rsiValue?: number;
  trendDirection?: 'strong_up' | 'breakout' | 'pullback';
}
