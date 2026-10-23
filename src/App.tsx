import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Trade, ScannerSettings, MarketHealthData, NotificationSettings } from './types';
import { playSound } from './utils/sound';
import { Header } from './components/Header';
import { MarketHealthCard } from './components/MarketHealthCard';
import { SmartPortfolioCard } from './components/SmartPortfolioCard';
import { ScannerSettingsCard } from './components/ScannerSettingsCard';
import { PerformanceStats } from './components/PerformanceStats';
import { ManualTradeForm } from './components/ManualTradeForm';
import { ActiveTradesGrid } from './components/ActiveTradesGrid';
import { ClosedTradesList } from './components/ClosedTradesList';
import { ExplosionRadar } from './components/ExplosionRadar';
import { NotificationSettingsCard } from './components/NotificationSettingsCard';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { fetchLiveMarketMatrix } from './utils/marketMatrixCalculator';
import {
  defaultNotificationSettings,
  notifyTradeOpen,
  notifyEmergencyAction,
  testTelegramConnection,
} from './utils/notificationService';

const defaultSettings: ScannerSettings = {
  tf: '15m',
  sl_perc: 0.03,
  min_tp: 0.05,
  trail_dist: 0.02,
  vol_mult: 2.0,
  cooldown_mins: 15,
  auto_kill: false,
  emergency_defense_mode: 'tighten_breakeven',
  portfolio_capital: 1000,
  max_open_trades: 10,
  strats: {
    momentum: true,
    breakout: true,
    sniper: true,
    bbrsi: true,
    turboScalp: true,
  },
  notifications: (() => {
    try {
      const saved = localStorage.getItem('momentum_notification_settings_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultNotificationSettings;
  })(),
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
    // Default to 'all' (all-time cumulative) so past trades and profits are never hidden
    const saved = localStorage.getItem('momentumStatsTimeFilter_v36');
    if (!saved || saved === '24') {
      localStorage.setItem('momentumStatsTimeFilter_v36', 'all');
      return 'all';
    }
    return saved;
  });

  const [openTradesSort, setOpenTradesSort] = useState(() => {
    return localStorage.getItem('momentumOpenTradesSort_v35') || 'time_desc';
  });

  const prevOpenCountRef = useRef<number | null>(null);
  const isClearingHistoryRef = useRef<boolean>(false);

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
    localStorage.setItem('momentumStatsTimeFilter_v36', filter);
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

  // Notification Modal & Testing State
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);

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

  // Save Notifications
  const handleSaveNotifications = async (newNotifs: NotificationSettings): Promise<boolean> => {
    try {
      const updatedSettings = { ...settings, notifications: newNotifs };
      await setDoc(
        doc(db, 'momentum_system_logs', 'scanner_settings'),
        { notifications: newNotifs },
        { merge: true }
      );
      localStorage.setItem('momentum_notification_settings_v1', JSON.stringify(newNotifs));
      setSettings(updatedSettings);
      return true;
    } catch (e) {
      console.error('Failed to save notification settings:', e);
      localStorage.setItem('momentum_notification_settings_v1', JSON.stringify(newNotifs));
      setSettings((prev) => ({ ...prev, notifications: newNotifs }));
      return true;
    }
  };

  // Quick Test Notification from Card
  const handleQuickTestNotification = async () => {
    const notif = settings.notifications;
    const hasTg = Boolean(notif?.telegramBotToken && notif?.telegramChatId);

    if (!hasTg) {
      setIsNotifModalOpen(true);
      return;
    }

    setTestingNotif(true);
    try {
      await testTelegramConnection(notif!.telegramBotToken, notif!.telegramChatId);
      setIsNotifModalOpen(true);
    } catch (e: any) {
      setIsNotifModalOpen(true);
    } finally {
      setTestingNotif(false);
    }
  };

  // Add Manual Trade
  // Capital Allocation & Auto-Compounding Calculation
  const initialCap = settings.portfolio_capital && settings.portfolio_capital > 0
    ? settings.portfolio_capital
    : Number(localStorage.getItem('smart_portfolio_capital') || 1000);

  const maxTrades = settings.max_open_trades && settings.max_open_trades > 0
    ? settings.max_open_trades
    : Number(localStorage.getItem('smart_portfolio_max_trades') || 10);

  const closedList = trades.filter((t) => t.status === 'won' || t.status === 'lost');
  const baseAlloc = Math.max(10, initialCap / maxTrades);
  let closedPnlUsd = 0;
  closedList.forEach((t) => {
    const alloc = t.allocatedCapital || baseAlloc;
    closedPnlUsd += (alloc * (t.pnl || 0)) / 100;
  });
  const currentRealizedCap = Math.max(0, initialCap + closedPnlUsd);
  const currentPerTradeAlloc = Number((currentRealizedCap / maxTrades).toFixed(2));

  // Add Manual Trade
  const handleAddTrade = async (newTrade: Omit<Trade, 'docId'>) => {
    const newDocRef = doc(collection(db, 'momentum_trades_v1'));
    const finalTrade = {
      ...newTrade,
      allocatedCapital: newTrade.allocatedCapital || currentPerTradeAlloc,
    };
    await setDoc(newDocRef, finalTrade);

    // Send Telegram alert
    notifyTradeOpen(settings.notifications, {
      ...finalTrade,
      docId: newDocRef.id,
    }).catch(() => {});
  };

  // Emergency Market Defense Action
  const handleEmergencyAction = async (action: 'tighten_breakeven' | 'close_losing' | 'liquidate_all') => {
    const currentOpen = trades.filter((t) => t.status === 'open');
    if (currentOpen.length === 0) return;

    // Send Telegram emergency alert
    notifyEmergencyAction(settings.notifications, action, currentOpen.length).catch(() => {});

    for (const trade of currentOpen) {
      const currentPrice = livePrices[trade.symbol] || trade.currentPrice || trade.entryPrice;
      const pnl = trade.entryPrice > 0 ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100 : 0;

      if (action === 'liquidate_all') {
        const status = pnl >= 0 ? 'won' : 'lost';
        await setDoc(doc(db, 'momentum_trades_v1', trade.docId), {
          status: status,
          closeTime: Date.now(),
          closePrice: currentPrice,
          pnl: pnl,
        }, { merge: true });
      } else if (action === 'close_losing') {
        if (pnl < 0) {
          await setDoc(doc(db, 'momentum_trades_v1', trade.docId), {
            status: 'lost',
            closeTime: Date.now(),
            closePrice: currentPrice,
            pnl: pnl,
          }, { merge: true });
        } else {
          // Breakeven +0.2% on winners
          await setDoc(doc(db, 'momentum_trades_v1', trade.docId), {
            slLevel: trade.entryPrice * 1.002,
          }, { merge: true });
        }
      } else if (action === 'tighten_breakeven') {
        if (pnl >= 0) {
          await setDoc(doc(db, 'momentum_trades_v1', trade.docId), {
            slLevel: trade.entryPrice * 1.002,
          }, { merge: true });
        } else {
          // Tighten loss to -1.5% max
          await setDoc(doc(db, 'momentum_trades_v1', trade.docId), {
            slLevel: Math.max(trade.slLevel || 0, trade.entryPrice * 0.985),
          }, { merge: true });
        }
      }
    }
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
    isClearingHistoryRef.current = true;
    const now = Date.now();
    localStorage.setItem('momentum_trades_cleared_at', String(now));
    localStorage.removeItem('momentum_trades_vault_v1');
    localStorage.removeItem('momentum_trades_backup_cleared');

    const closed = trades.filter((t) => t.status === 'won' || t.status === 'lost');

    // Optimistic UI update: immediately drop closed trades so UI is instantly cleared
    setTrades((prev) => prev.filter((t) => t.status === 'open'));

    if (closed.length === 0) {
      isClearingHistoryRef.current = false;
      return;
    }

    try {
      // 1. Client-side fast batch delete (chunks of 400 docs per batch)
      const BATCH_SIZE = 400;
      for (let i = 0; i < closed.length; i += BATCH_SIZE) {
        const chunk = closed.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((t) => {
          batch.delete(doc(db, 'momentum_trades_v1', t.docId));
        });
        await batch.commit();
      }

      // 2. Also notify backend endpoint for server-level purge
      try {
        await fetch('/api/clear-history', { method: 'POST' });
      } catch (err) {
        // Backend ping is auxiliary
      }
    } catch (batchErr) {
      console.warn('Batch delete error, falling back to parallel deleteDoc:', batchErr);
      await Promise.allSettled(
        closed.map((t) => deleteDoc(doc(db, 'momentum_trades_v1', t.docId)))
      );
    } finally {
      // Allow snapshot listener again after 2.5s cooldown so Firestore deletions settle
      setTimeout(() => {
        isClearingHistoryRef.current = false;
      }, 2500);
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
            emergency_defense_mode: s.emergency_defense_mode !== undefined ? s.emergency_defense_mode : prev.emergency_defense_mode,
            portfolio_capital: s.portfolio_capital !== undefined ? s.portfolio_capital : prev.portfolio_capital,
            max_open_trades: s.max_open_trades !== undefined ? s.max_open_trades : prev.max_open_trades,
            strats: {
              momentum: s.strats?.momentum ?? prev.strats.momentum,
              breakout: s.strats?.breakout ?? prev.strats.breakout,
              sniper: s.strats?.sniper ?? prev.strats.sniper,
              bbrsi: s.strats?.bbrsi ?? prev.strats.bbrsi,
              turboScalp: s.strats?.turboScalp ?? prev.strats.turboScalp,
            },
            notifications: s.notifications !== undefined ? s.notifications : prev.notifications,
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
      limit(2500)
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

        // Persistent Local Vault: prevents past trades from disappearing unintentionally,
        // but strictly respects manual "مسح السجل" (Clear History) actions.
        let mergedTrades = fetchedTrades;
        const clearedAt = Number(localStorage.getItem('momentum_trades_cleared_at') || 0);

        if (!isClearingHistoryRef.current) {
          try {
            const VAULT_KEY = 'momentum_trades_vault_v1';
            const savedVaultStr = localStorage.getItem(VAULT_KEY);
            const savedVault: Record<string, Trade> = savedVaultStr ? JSON.parse(savedVaultStr) : {};

            // Store incoming closed trades in permanent vault ONLY if they were closed after the last clear timestamp
            fetchedTrades.forEach((t) => {
              if (t.status === 'won' || t.status === 'lost') {
                const tradeTime = t.closeTime || t.openTime || 0;
                if (tradeTime > clearedAt) {
                  savedVault[t.docId] = t;
                }
              }
            });

            // Check if any historical closed trades from vault are missing from fetchedTrades
            const fetchedIds = new Set(fetchedTrades.map((t) => t.docId));
            const restoredFromVault: Trade[] = [];
            Object.values(savedVault).forEach((vt) => {
              const tradeTime = vt.closeTime || vt.openTime || 0;
              if (tradeTime > clearedAt && !fetchedIds.has(vt.docId)) {
                restoredFromVault.push(vt);
                // Auto-restore back to Firestore so data remains in database even if an external old server script runs
                setDoc(doc(db, 'momentum_trades_v1', vt.docId), vt, { merge: true }).catch(() => {});
              }
            });

            if (restoredFromVault.length > 0) {
              mergedTrades = [...fetchedTrades, ...restoredFromVault].sort(
                (a, b) => (b.openTime || 0) - (a.openTime || 0)
              );
            }

            localStorage.setItem(VAULT_KEY, JSON.stringify(savedVault));
          } catch (vaultErr) {
            console.warn('Vault sync notice:', vaultErr);
          }
        }

        // Filter out any closed trade that was cleared before clearedAt (handles offline cache latency)
        if (clearedAt > 0) {
          mergedTrades = mergedTrades.filter((t) => {
            if (t.status === 'won' || t.status === 'lost') {
              const tradeTime = t.closeTime || t.openTime || 0;
              return tradeTime > clearedAt;
            }
            return true;
          });
        }

        const newOpenCount = mergedTrades.filter((t) => t.status === 'open').length;

        if (prevOpenCountRef.current !== null) {
          if (newOpenCount > prevOpenCountRef.current) {
            playSound('open', soundEnabled);
          } else if (prevOpenCountRef.current > newOpenCount) {
            playSound('win', soundEnabled);
          }
        }
        prevOpenCountRef.current = newOpenCount;

        setTrades(mergedTrades);
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
        onOpenNotifications={() => setIsNotifModalOpen(true)}
        notificationsEnabled={Boolean(
          settings.notifications?.enabled &&
            settings.notifications?.telegramBotToken &&
            settings.notifications?.telegramChatId
        )}
      />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {activeTab === 'momentum' ? (
          <div className="flex flex-col gap-6">
            <MarketHealthCard
              healthData={marketHealth}
              autoKill={settings.auto_kill}
              onToggleAutoKill={handleToggleAutoKill}
            />

            <SmartPortfolioCard
              trades={trades}
              marketHealth={marketHealth}
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onEmergencyAction={handleEmergencyAction}
            />

            <NotificationSettingsCard
              notifications={settings.notifications}
              onOpenModal={() => setIsNotifModalOpen(true)}
              onTest={handleQuickTestNotification}
              testing={testingNotif}
            />

            <div className="bg-[#0f1423] border border-gray-800 rounded-lg p-3 flex items-center gap-3 shadow-inner">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-blue"></span>
              </span>
              <div className="text-[11px] font-mono text-gray-400 truncate">
                🚀 متصل بالسيرفر السحابي... حجم الدخول المحسوب حالياً: <strong className="text-brand-gold font-mono">${currentPerTradeAlloc} USDT</strong> لكل صفقة.
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
                perTradeAllocation={currentPerTradeAlloc}
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
                perTradeAllocation={currentPerTradeAlloc}
              />

              <ClosedTradesList
                trades={trades}
                timeFilter={timeFilter}
                onClearHistory={handleClearHistory}
                perTradeAllocation={currentPerTradeAlloc}
              />
            </section>
          </div>
        ) : (
          <ExplosionRadar onAddTrade={handleAddTrade} />
        )}
      </main>

      <NotificationSettingsModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        settings={settings.notifications}
        onSave={handleSaveNotifications}
      />
    </div>
  );
};

export default App;
