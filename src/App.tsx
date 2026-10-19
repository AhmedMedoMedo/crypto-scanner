import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Trade, ScannerSettings, MarketHealthData } from './types';
import { playSound } from './utils/sound';
import { Header } from './components/Header';
import { MarketHealthCard } from './components/MarketHealthCard';
import { ScannerSettingsCard } from './components/ScannerSettingsCard';
import { PerformanceStats } from './components/PerformanceStats';
import { ManualTradeForm } from './components/ManualTradeForm';
import { ActiveTradesGrid } from './components/ActiveTradesGrid';
import { ClosedTradesList } from './components/ClosedTradesList';
import { ExplosionRadar } from './components/ExplosionRadar';
import { fetchLiveMarketMatrix } from './utils/marketMatrixCalculator';

const defaultSettings: ScannerSettings = {
  tf: '15m',
  sl_perc: 0.03,
  min_tp: 0.05,
  trail_dist: 0.02,
  vol_mult: 2.0,
  cooldown_mins: 15,
  auto_kill: false,
  strats: {
    momentum: true,
    breakout: true,
    sniper: true,
    bbrsi: true,
    turboScalp: true,
  },
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'momentum' | 'radar'>('momentum');
  const [isConnected, setIsConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('momentumSoundEnabled') === 'true';
  });

  const [settings, setSettings] = useState<ScannerSettings>(defaultSettings);
  const [marketHealth, setMarketHealth] = useState<MarketHealthData | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  const [timeFilter, setTimeFilter] = useState(() => {
    return localStorage.getItem('momentumStatsTimeFilter_v35') || '24';
  });

  const [openTradesSort, setOpenTradesSort] = useState(() => {
    return localStorage.getItem('momentumOpenTradesSort_v35') || 'time_desc';
  });

  const prevOpenCountRef = useRef<number | null>(null);

  // Toggle sound
  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('momentumSoundEnabled', String(nextVal));
    if (nextVal) {
      playSound('open', true);
    }
  };

  // Time filter change
  const handleTimeFilterChange = (filter: string) => {
    setTimeFilter(filter);
    localStorage.setItem('momentumStatsTimeFilter_v35', filter);
  };

  // Sort change
  const handleSortChange = (sort: string) => {
    setOpenTradesSort(sort);
    localStorage.setItem('momentumOpenTradesSort_v35', sort);
  };

  // Toggle Auto-Kill
  const handleToggleAutoKill = async (enabled: boolean) => {
    try {
      await setDoc(
        doc(db, 'momentum_system_logs', 'scanner_settings'),
        { auto_kill: enabled },
        { merge: true }
      );
      setSettings((prev) => ({ ...prev, auto_kill: enabled }));
    } catch (e) {
      console.error('Failed to toggle auto kill', e);
    }
  };

  // Save Settings
  const handleSaveSettings = async (newSettings: ScannerSettings): Promise<boolean> => {
    try {
      await setDoc(doc(db, 'momentum_system_logs', 'scanner_settings'), newSettings, {
        merge: true,
      });
      setSettings(newSettings);
      return true;
    } catch (e) {
      console.error('Failed to save settings', e);
      return false;
    }
  };

  // Add Manual Trade
  const handleAddTrade = async (newTrade: Omit<Trade, 'docId'>) => {
    const newDocRef = doc(collection(db, 'momentum_trades_v1'));
    await setDoc(newDocRef, newTrade);
  };

  // Cancel Trade
  const handleCancelTrade = async (docId: string) => {
    if (!window.confirm('هل أنت متأكد من إلغاء وحذف هذه الصفقة؟')) return;
    try {
      await deleteDoc(doc(db, 'momentum_trades_v1', docId));
    } catch (e) {
      console.error('Error canceling trade', e);
    }
  };

  // Clear History
  const handleClearHistory = async () => {
    const closed = trades.filter((t) => t.status === 'won' || t.status === 'lost');
    for (const t of closed) {
      try {
        await deleteDoc(doc(db, 'momentum_trades_v1', t.docId));
      } catch (e) {
        console.error('Error clearing trade', e);
      }
    }
  };

  // Sync Settings from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'momentum_system_logs', 'scanner_settings'),
      (docSnap) => {
        if (docSnap.exists()) {
          const s = docSnap.data();
          setSettings((prev) => ({
            tf: s.tf !== undefined ? s.tf : prev.tf,
            sl_perc: s.sl_perc !== undefined ? s.sl_perc : prev.sl_perc,
            min_tp: s.min_tp !== undefined ? s.min_tp : prev.min_tp,
            trail_dist: s.trail_dist !== undefined ? s.trail_dist : prev.trail_dist,
            vol_mult: s.vol_mult !== undefined ? s.vol_mult : prev.vol_mult,
            cooldown_mins: s.cooldown_mins !== undefined ? s.cooldown_mins : prev.cooldown_mins,
            auto_kill: s.auto_kill !== undefined ? s.auto_kill : prev.auto_kill,
            strats: {
              momentum: s.strats?.momentum ?? prev.strats.momentum,
              breakout: s.strats?.breakout ?? prev.strats.breakout,
              sniper: s.strats?.sniper ?? prev.strats.sniper,
              bbrsi: s.strats?.bbrsi ?? prev.strats.bbrsi,
              turboScalp: s.strats?.turboScalp ?? prev.strats.turboScalp,
            },
          }));
        }
      },
      (error) => {
        console.warn('Settings subscription error', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sync Market Health from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'momentum_system_logs', 'market_health'),
      (docSnap) => {
        if (docSnap.exists()) {
          setIsConnected(true);
          const data = docSnap.data() as MarketHealthData;
          setMarketHealth((prev) => ({
            ...prev,
            ...data,
            matrix: data.matrix || prev?.matrix,
          }));
        }
      },
      (error) => {
        console.warn('Market health subscription error', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Live Multi-Timeframe AI Market Matrix (1m, 5m, 15m)
  useEffect(() => {
    let isMounted = true;

    const loadLiveMatrix = async () => {
      try {
        const liveData = await fetchLiveMarketMatrix();
        if (!isMounted || !liveData) return;
        setMarketHealth((prev) => {
          const combinedLogs =
            prev?.log && prev.log.length > 0
              ? prev.log[0].score !== liveData.score
                ? [{ score: liveData.score, time: Date.now() }, ...prev.log].slice(0, 6)
                : prev.log
              : liveData.log;

          return {
            ...prev,
            ...liveData,
            log: combinedLogs,
          };
        });
      } catch {
        // Silently preserve state
      }
    };

    loadLiveMatrix();
    const interval = setInterval(loadLiveMatrix, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync Trades from Firestore
  useEffect(() => {
    const tradesQuery = query(
      collection(db, 'momentum_trades_v1'),
      orderBy('openTime', 'desc'),
      limit(150)
    );

    const unsubscribe = onSnapshot(
      tradesQuery,
      (snapshot) => {
        setIsConnected(true);
        const fetchedTrades: Trade[] = [];
        snapshot.forEach((docSnap) => {
          fetchedTrades.push({
            docId: docSnap.id,
            ...(docSnap.data() as Omit<Trade, 'docId'>),
          });
        });

        const newOpenCount = fetchedTrades.filter((t) => t.status === 'open').length;

        if (prevOpenCountRef.current !== null) {
          if (newOpenCount > prevOpenCountRef.current) {
            playSound('open', soundEnabled);
          } else if (prevOpenCountRef.current > newOpenCount) {
            playSound('win', soundEnabled);
          }
        }
        prevOpenCountRef.current = newOpenCount;

        setTrades(fetchedTrades);
      },
      (error) => {
        console.warn('Trades subscription error', error);
      }
    );

    return () => unsubscribe();
  }, [soundEnabled]);

  // Connect to Binance WebSocket for ticker prices
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;

    const connectWs = () => {
      if (isDisposed) return;
      try {
        if (ws) {
          try {
            ws.close();
          } catch (e) {}
          ws = null;
        }

        ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

        ws.onmessage = (event) => {
          if (isDisposed) return;
          try {
            const data = JSON.parse(event.data) as Array<{ s: string; c: string }>;
            if (!Array.isArray(data)) return;

            setLivePrices((prev) => {
              const updated = { ...prev };
              let changed = false;
              for (const ticker of data) {
                const price = parseFloat(ticker.c);
                if (price > 0 && updated[ticker.s] !== price) {
                  updated[ticker.s] = price;
                  changed = true;
                }
              }
              return changed ? updated : prev;
            });
          } catch (e) {
            // ignore parse errors
          }
        };

        ws.onerror = () => {
          if (ws) {
            try {
              ws.close();
            } catch (e) {}
          }
        };

        ws.onclose = () => {
          if (!isDisposed) {
            reconnectTimeout = setTimeout(connectWs, 3000);
          }
        };
      } catch (err) {
        if (!isDisposed) {
          reconnectTimeout = setTimeout(connectWs, 3000);
        }
      }
    };

    connectWs();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        try {
          ws.close();
        } catch (e) {}
      }
    };
  }, []);

  // Compute open trades merged with live prices
  const openTrades = trades
    .filter((t) => t.status === 'open')
    .map((t) => {
      const livePrice = livePrices[t.symbol];
      return {
        ...t,
        currentPrice: livePrice || t.currentPrice || t.entryPrice,
      };
    });

  // Calculate total floating PnL
  let totalFloatingPnl = 0;
  openTrades.forEach((t) => {
    const currentPrice = t.currentPrice || t.entryPrice;
    if (t.entryPrice && t.entryPrice > 0) {
      const pnl = ((currentPrice - t.entryPrice) / t.entryPrice) * 100;
      totalFloatingPnl += pnl;
    }
  });

  return (
    <div className="antialiased min-h-screen flex flex-col bg-[#0b0f19] text-[#f3f4f6]">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        isConnected={isConnected}
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {activeTab === 'momentum' ? (
          <div className="flex flex-col gap-6">
            <MarketHealthCard
              healthData={marketHealth}
              autoKill={settings.auto_kill}
              onToggleAutoKill={handleToggleAutoKill}
            />

            <div className="bg-[#0f1423] border border-gray-800 rounded-lg p-3 flex items-center gap-3 shadow-inner">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-blue"></span>
              </span>
              <div className="text-[11px] font-mono text-gray-400 truncate">
                🚀 متصل بالسيرفر السحابي... الأسعار تنبض وتتحدث تلقائياً.
              </div>
            </div>

            <ScannerSettingsCard
              initialSettings={settings}
              onSave={handleSaveSettings}
            />

            <section className="bg-gray-900 rounded-xl border border-gray-800 p-5 shadow-lg">
              <PerformanceStats
                trades={trades}
                timeFilter={timeFilter}
                onTimeFilterChange={handleTimeFilterChange}
                openTradesCount={openTrades.length}
                totalFloatingPnl={totalFloatingPnl}
              />

              <ManualTradeForm
                openTrades={openTrades}
                onAddTrade={handleAddTrade}
              />

              <ActiveTradesGrid
                trades={openTrades}
                sortOption={openTradesSort}
                onSortChange={handleSortChange}
                onCancelTrade={handleCancelTrade}
              />

              <ClosedTradesList
                trades={trades}
                timeFilter={timeFilter}
                onClearHistory={handleClearHistory}
              />
            </section>
          </div>
        ) : (
          <ExplosionRadar onAddTrade={handleAddTrade} />
        )}
      </main>
    </div>
  );
};

export default App;
