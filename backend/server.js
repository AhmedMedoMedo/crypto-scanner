const http = require('http');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount = null;
if (process.env.SERVICE_ACCOUNT_KEY) {
  try {
    serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
  } catch (e) {
    console.error('⚠️ Could not parse SERVICE_ACCOUNT_KEY env var:', e.message);
  }
}

if (!serviceAccount) {
  const possiblePaths = [
    path.join(__dirname, 'serviceAccountKey.json'),
    path.join(__dirname, '../serviceAccountKey.json'),
    '/etc/secrets/serviceAccountKey.json',
    './serviceAccountKey.json',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      } catch (err) {}
    }
  }
}

if (!serviceAccount) {
  console.error('❌ Error: No service account credentials found! Set SERVICE_ACCOUNT_KEY or supply serviceAccountKey.json.');
} else {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const tradesRef = db.collection('momentum_trades_v1');
const systemRef = db.collection('momentum_system_logs').doc('market_health');
const settingsRef = db.collection('momentum_system_logs').doc('scanner_settings');

process.on('uncaughtException', (err) => {
    console.error('⚠️ Unhandled Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Unhandled Rejection:', reason);
});

const BACKEND_PORT = process.env.BACKEND_PORT || 10000;

http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end('Momentum Scanner Backend is ALIVE and OPTIMIZED! 🚀\n');
}).listen(BACKEND_PORT, () => {
    console.log(`📡 Backend HTTP server running on port ${BACKEND_PORT}`);
});

let virtualTrades = []; // الصفقات ستحفظ هنا في الذاكرة لتوفير القراءة
let currentMarketScore = null;
let globalMarketStatus = 'neutral';
let isCheckingMarket = false;
let marketScoreLog = [];
const exitCooldowns = {};
const BLACKLIST = ['USDCUSDT', 'USD1USDT', 'FDUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'EURUSDT', 'XAUTUSDT', 'PAXGUSDT', 'BUSDUSDT', 'AEURUSDT', 'USDSUSDT'];

let SETTINGS = { 
    tf: '15m', sl_perc: 0.03, min_tp: 0.05, trail_dist: 0.015, vol_mult: 2.0, cooldown_mins: 15, auto_kill: true, 
    strats: { momentum: true, breakout: true, sniper: true, bbrsi: true } 
};

// [تحسين 1]: استخدام onSnapshot بدلاً من جلب الإعدادات كل 5 ثوانٍ
let lastSettingsString = "";
settingsRef.onSnapshot((docSnap) => {
    if (docSnap.exists) {
        SETTINGS = { ...SETTINGS, ...docSnap.data() };
        const currentSettingsString = `${SETTINGS.tf}-${SETTINGS.vol_mult}-${SETTINGS.sl_perc}-${SETTINGS.auto_kill}`;
        if(currentSettingsString !== lastSettingsString) {
            console.log(`⚙️ [تحديث الرادار فوري]: الفريم: [${SETTINGS.tf}] | الحماية: ${SETTINGS.auto_kill ? 'مفعلة' : 'مغلقة'}`);
            lastSettingsString = currentSettingsString;
        }
    }
}, err => console.error("Settings Sync Error:", err));

// [تحسين 2]: استماع حي للصفقات المفتوحة فقط، بدلاً من جلبها كل 5 ثوانٍ
tradesRef.where('status', '==', 'open').onSnapshot((snapshot) => {
    let activeTrades = [];
    snapshot.forEach(doc => { activeTrades.push({ docId: doc.id, ...doc.data() }); });
    virtualTrades = activeTrades; // تحديث الذاكرة فوراً عند أي تغيير
}, err => console.error("Trades Sync Error:", err));

const cleanOldTrades = async () => {
    try {
        const timeLimit = Date.now() - (24 * 60 * 60 * 1000);
        const snapshot = await tradesRef.where('status', 'in', ['won', 'lost']).get();
        const batch = db.batch();
        let deleted = 0;
        snapshot.forEach(doc => { if (doc.data().closeTime < timeLimit) { batch.delete(doc.ref); deleted++; } });
        if (deleted > 0) await batch.commit();
    } catch (err) {}
};

const calcEMA = (data, period) => { if(data.length < period) return null; let k = 2 / (period + 1); let ema = data[0]; for(let i = 1; i < data.length; i++) ema = (data[i] - ema) * k + ema; return ema; };
const calcSMA = (data, period) => { if(data.length < period) return null; let sum = 0; for(let i = data.length - period; i < data.length; i++) sum += data[i]; return sum / period; };
const calcRSI = (data, period = 14) => { if(data.length <= period) return null; let gains = 0, losses = 0; for (let i = 1; i <= period; i++) { let diff = data[i] - data[i - 1]; if (diff >= 0) gains += diff; else losses -= diff; } let avgGain = gains / period; let avgLoss = losses / period; for (let i = period + 1; i < data.length; i++) { let diff = data[i] - data[i - 1]; avgGain = ((avgGain * (period - 1)) + (diff >= 0 ? diff : 0)) / period; avgLoss = ((avgLoss * (period - 1)) + (diff < 0 ? -diff : 0)) / period; } if (avgLoss === 0) return 100; return 100 - (100 / (1 + (avgGain / avgLoss))); };
const calcBollingerBands = (data, period = 20, multiplier = 2.0) => { if(data.length < period) return null; const sma = calcSMA(data, period); let sum = 0; for(let i = data.length - period; i < data.length; i++) { sum += Math.pow(data[i] - sma, 2); } const stdDev = Math.sqrt(sum / period); return { upper: sma + (stdDev * multiplier), lower: sma - (stdDev * multiplier), sma: sma }; };

const calculateTradeStrength = (isLive, strategy, price, open, high, low, vol, volAvg, rsi, ema9, ema21, bbUpper, btcScore, entryPrice = null) => {
    let b = { trend: 0, volume: 0, rsi: 0, setup: 0, btc: 0, candle: 0, confirm: 0 };
    if (ema9 > ema21) { let trendStrength = ((ema9 - ema21) / ema21) * 100; b.trend = price > ema9 ? 15 + Math.min(5, trendStrength * 5) : 10; } else { b.trend = 0; }
    let volRatio = volAvg > 0 ? (vol / volAvg) : 1; b.volume = Math.min(20, volRatio * 10); 
    
    if (strategy === 'BB_RSI') {
        if (rsi < 25) b.rsi = 15; else if (rsi < 30) b.rsi = 12; else if (rsi < 35) b.rsi = 10; else b.rsi = 5;
    } else {
        if (rsi >= 55 && rsi <= 72) b.rsi = 15; else if (rsi > 72 && rsi <= 80) b.rsi = 12; else if (rsi >= 50 && rsi < 55) b.rsi = 10; else if (rsi > 80) b.rsi = 5; else b.rsi = 2; 
    }

    if (strategy === 'Breakout') { b.setup = price > bbUpper ? 15 : (price > bbUpper * 0.99 ? 10 : 5); } 
    else if (strategy === 'BB_RSI') { b.setup = 15; }
    else { let pDist = Math.abs((price - ema9) / ema9) * 100; b.setup = pDist < 1 ? 15 : (pDist < 2 ? 10 : 5); }
    
    b.btc = Math.min(15, (btcScore / 100) * 15);
    let body = Math.abs(price - open); let range = high - low; let bodyRatio = range > 0 ? body / range : 0; b.candle = price >= open ? Math.min(10, bodyRatio * 15) : 2; 
    if (isLive && entryPrice) { let pnl = ((price - entryPrice) / entryPrice) * 100; b.confirm = pnl > 0.5 ? 5 : (pnl > 0 ? 3 : 0); } else { let upperWick = high - Math.max(price, open); let wickRatio = range > 0 ? upperWick / range : 0; b.confirm = wickRatio < 0.2 ? 5 : (wickRatio < 0.4 ? 3 : 1); }
    
    for(let k in b) b[k] = Math.max(0, Math.round(b[k]));
    b.trend = Math.min(20, b.trend); b.volume = Math.min(20, b.volume); b.rsi = Math.min(15, b.rsi); b.setup = Math.min(15, b.setup); b.btc = Math.min(15, b.btc); b.candle = Math.min(10, b.candle); b.confirm = Math.min(5, b.confirm);
    let score = b.trend + b.volume + b.rsi + b.setup + b.btc + b.candle + b.confirm;
    return { score, breakdown: b };
};

const enterNewTrade = async (symbol, price, strategy, healthData) => {
    if (exitCooldowns[symbol] && Date.now() < exitCooldowns[symbol]) return;
    if (SETTINGS.auto_kill && globalMarketStatus === 'bearish') return;
    if (virtualTrades.find(t => t.symbol === symbol && t.status === 'open')) return;

    const newTrade = {
        symbol: symbol, entryPrice: price, maxPrice: price, trailActive: false, 
        slLevel: price * (1 - SETTINGS.sl_perc), status: 'open', openTime: Date.now(),
        strategy: strategy, entryScore: healthData.score, liveScore: healthData.score,
        entryBreakdown: healthData.breakdown
    };

    try {
        const docRef = tradesRef.doc();
        await docRef.set(newTrade);
        // ستتم إضافتها لـ virtualTrades تلقائياً عبر onSnapshot
        console.log(`🟢 [دخول فرصة نارية] ${symbol} | الاستراتيجية: ${strategy}`);
    } catch (e) { console.error("Error:", e.message); }
};

const analyzeMarketHealth = async () => {
    if (isCheckingMarket) return;
    isCheckingMarket = true;
    try {
        const [res15m, res4h] = await Promise.all([
            fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=250'),
            fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=250')
        ]);
        if(!res15m.ok || !res4h.ok) return;
        const klines15m = await res15m.json(); const klines4h = await res4h.json();
        const closes15m = klines15m.map(k => parseFloat(k[4])); const volumes15m = klines15m.map(k => parseFloat(k[5])); const opens15m = klines15m.map(k => parseFloat(k[1]));
        const closes4h = klines4h.map(k => parseFloat(k[4]));
        const btcCurrentPrice = closes15m[closes15m.length - 1];
        
        const ema50_4h = calcEMA(closes4h, 50); const ema200_4h = calcEMA(closes4h, 200);
        const ema20_15m = calcEMA(closes15m, 20); const ema50_15m = calcEMA(closes15m, 50); const rsi_15m = calcRSI(closes15m, 14); const volSMA_15m = calcSMA(volumes15m, 20);
        const currentVol = volumes15m[volumes15m.length - 1]; const prevVol = volumes15m[volumes15m.length - 2];
        
        let score = 0;
        if (ema200_4h && ema50_15m) {
            let macroScore = 0; if (btcCurrentPrice > ema200_4h) macroScore += 15; else if (btcCurrentPrice > ema200_4h * 0.98) macroScore += 5; if (ema50_4h > ema200_4h) macroScore += 10; score += macroScore;
            let momentumScore = 0; let priceDist20 = (btcCurrentPrice - ema20_15m) / ema20_15m * 100; if (priceDist20 > 0.5) momentumScore += 15; else if (priceDist20 > 0) momentumScore += 10; else if (priceDist20 > -0.5) momentumScore += 5; if (btcCurrentPrice > ema50_15m) momentumScore += 10; if (ema20_15m > ema50_15m) momentumScore += 10; score += momentumScore;
            let rsiScore = 0; if (rsi_15m >= 50 && rsi_15m <= 65) rsiScore = 25; else if (rsi_15m > 65 && rsi_15m <= 75) rsiScore = 15; else if (rsi_15m > 75) rsiScore = 5; else if (rsi_15m >= 40 && rsi_15m < 50) rsiScore = 10; else rsiScore = 0; score += rsiScore;
            if (volSMA_15m) { let volRatio = Math.max(currentVol, prevVol) / volSMA_15m; if (volRatio > 1.5) score += 15; else if (volRatio > 1.0) score += 10; else if (volRatio > 0.7) score += 5; }
            let flashDumpPenalty = 0; for(let i = 1; i <= 3; i++) { if (opens15m.length - i >= 0) { let kOpen = opens15m[opens15m.length - i]; let kClose = closes15m[closes15m.length - i]; let dropPercent = ((kOpen - kClose) / kOpen) * 100; if (dropPercent > 1.0) { flashDumpPenalty = 40; break; } } }
            score -= flashDumpPenalty; if (score < 0) score = 0; if (score > 100) score = 100;
        } else { score = 50; }

        if (score >= 75) globalMarketStatus = 'bullish'; else if (score >= 55) globalMarketStatus = 'neutral'; else globalMarketStatus = 'bearish';

        if (currentMarketScore !== score) {
            marketScoreLog.unshift({ score: score, time: Date.now() });
            if (marketScoreLog.length > 6) marketScoreLog = marketScoreLog.slice(0, 6);
            currentMarketScore = score;
            await systemRef.set({ score: score, status: globalMarketStatus, log: marketScoreLog, lastUpdate: Date.now() });
        }
    } catch (e) { } finally { isCheckingMarket = false; }
};

// [تحسين 3]: الذاكرة المحلية لمعالجة الملاحقة دون إرهاق قاعدة البيانات
let memoryTrades = {}; 

const manageOpenTrades = async () => {
    if (virtualTrades.length === 0) return;
    
    try {
        const tickRes = await fetch('https://data-api.binance.vision/api/v3/ticker/price');
        if (!tickRes.ok) return;
        const tickers = await tickRes.json();
        const prices = {};
        tickers.forEach(t => prices[t.symbol] = parseFloat(t.price));

        const batch = db.batch();
        let hasUpdates = false;

        for (let trade of virtualTrades) {
            const currentPrice = prices[trade.symbol];
            if (!currentPrice) continue;

            // جلب البيانات من الذاكرة العشوائية لتوفير الكتابة
            if (!memoryTrades[trade.docId]) {
                memoryTrades[trade.docId] = { maxPrice: trade.maxPrice || trade.entryPrice, slLevel: trade.slLevel, trailActive: trade.trailActive };
            }
            let mem = memoryTrades[trade.docId];
            
            let pnl = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
            
            if (currentPrice > mem.maxPrice) mem.maxPrice = currentPrice;

            if (!mem.trailActive && pnl >= (SETTINGS.min_tp * 100)) {
                mem.trailActive = true; 
                console.log(`✨ [تفعيل الملاحقة في الذاكرة] ${trade.symbol}`);
                // نكتب في DB فقط عند تفعيل الملاحقة لأول مرة
                batch.update(tradesRef.doc(trade.docId), { trailActive: true }); 
                hasUpdates = true;
            }

            if (mem.trailActive) {
                const trailDistValue = mem.maxPrice * SETTINGS.trail_dist;
                const potentialSl = mem.maxPrice - trailDistValue;
                if (potentialSl > mem.slLevel) mem.slLevel = potentialSl;
            }

            // الإغلاق الفعلي: هنا فقط نكتب النتائج في قاعدة البيانات
            if (currentPrice <= mem.slLevel) {
                const status = (mem.slLevel >= trade.entryPrice) ? 'won' : 'lost';
                batch.update(tradesRef.doc(trade.docId), {
                    status: status, closeTime: Date.now(), closePrice: currentPrice, pnl: pnl,
                    maxPrice: mem.maxPrice, slLevel: mem.slLevel // تحديث الأرقام النهائية فقط
                });
                hasUpdates = true;
                
                delete memoryTrades[trade.docId]; // مسح من الذاكرة
                if (SETTINGS.cooldown_mins > 0) exitCooldowns[trade.symbol] = Date.now() + (SETTINGS.cooldown_mins * 60 * 1000);
                console.log(`🔴 [إغلاق صفقة وحفظ DB] ${trade.symbol} | ${status} | ${pnl.toFixed(2)}%`);
            }
        }

        if (hasUpdates) await batch.commit();
    } catch (e) {}
};

const scanMarket = async () => {
    try {
        await analyzeMarketHealth();
        const tickRes = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr');
        if(!tickRes.ok) return;
        const tickers = await tickRes.json();
        const topCoins = tickers.filter(t => t.symbol.endsWith('USDT') && parseFloat(t.lastPrice) > 0.001 && !BLACKLIST.includes(t.symbol)).sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)).slice(0, 40); 
        
        for (let coin of topCoins) {
            try {
                const klineRes = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${coin.symbol}&interval=${SETTINGS.tf}&limit=100`);
                if(!klineRes.ok) continue;
                const klines = await klineRes.json();
                
                const closes = klines.map(k => parseFloat(k[4])); const opens = klines.map(k => parseFloat(k[1])); const highs = klines.map(k => parseFloat(k[2])); const lows = klines.map(k => parseFloat(k[3])); const volumes = klines.map(k => parseFloat(k[5])); 
                const currentPrice = closes[closes.length - 1]; const currentOpen = opens[opens.length - 1]; const currentHigh = highs[highs.length - 1]; const currentLow = lows[lows.length - 1]; const currentVol = volumes[volumes.length - 1];
                const closedCloses = closes.slice(0, -1); const closedOpens = opens.slice(0, -1); const closedHighs = highs.slice(0, -1); const closedLows = lows.slice(0, -1); const closedVolumes = volumes.slice(0, -1);
                const closedPrice = closedCloses[closedCloses.length - 1]; const closedOpen = closedOpens[closedOpens.length - 1]; const closedVol = closedVolumes[closedVolumes.length - 1]; const prevClosedHigh = closedHighs[closedHighs.length - 2];

                const ema9 = calcEMA(closedCloses, 9); const ema21 = calcEMA(closedCloses, 21); const ema50 = calcEMA(closedCloses, 50); const volAvg20 = calcSMA(closedVolumes, 20); const rsi = calcRSI(closedCloses, 14); const bb = calcBollingerBands(closedCloses, 20, 2.0);
                if(!ema9 || !ema21 || !ema50 || !volAvg20 || !rsi || !bb) continue;

                const isVolumeSpike = closedVol > (volAvg20 * SETTINGS.vol_mult);
                const isGreenCandle = closedPrice > closedOpen;
                const closePosition = (closedHighs[closedHighs.length - 1] - closedLows[closedLows.length - 1]) > 0 ? (closedPrice - closedLows[closedLows.length - 1]) / (closedHighs[closedHighs.length - 1] - closedLows[closedLows.length - 1]) : 0;
                const isStrongClose = closePosition > 0.75;

                if (SETTINGS.strats.bbrsi) {
                    let touchedLowerBB = false;
                    for(let i = 1; i <= 3; i++) {
                        let pastLow = closedLows[closedLows.length - i];
                        let pastCloses = closedCloses.slice(0, closedCloses.length - i + 1);
                        let pastBB = calcBollingerBands(pastCloses, 20, 2.0);
                        if (pastBB && pastLow <= pastBB.lower) { touchedLowerBB = true; break; }
                    }
                    const rsiCrossOversold = rsi > 35 && calcRSI(closedCloses.slice(0, -1), 14) <= 35;
                    if (touchedLowerBB && rsiCrossOversold && isVolumeSpike) {
                        await enterNewTrade(coin.symbol, currentPrice, 'BB_RSI', calculateTradeStrength(false, 'BB_RSI', currentPrice, currentOpen, currentHigh, currentLow, currentVol, volAvg20, rsi, ema9, ema21, bb.upper, currentMarketScore || 50));
                        continue; 
                    }
                }
                if (SETTINGS.strats.sniper && isVolumeSpike && isGreenCandle && closedPrice > ema50 && closedPrice > ema9 && ema9 > ema21 && rsi > 52 && rsi < 68 && isStrongClose) {
                    await enterNewTrade(coin.symbol, currentPrice, 'Sniper', calculateTradeStrength(false, 'Sniper', currentPrice, currentOpen, currentHigh, currentLow, currentVol, volAvg20, rsi, ema9, ema21, bb.upper, currentMarketScore || 50));
                }
                else if (SETTINGS.strats.momentum && isVolumeSpike && isGreenCandle && closedPrice > ema9 && ema9 > ema21 && rsi > 55 && rsi < 75) {
                    await enterNewTrade(coin.symbol, currentPrice, 'Momentum', calculateTradeStrength(false, 'Momentum', currentPrice, currentOpen, currentHigh, currentLow, currentVol, volAvg20, rsi, ema9, ema21, bb.upper, currentMarketScore || 50));
                }
                else if (SETTINGS.strats.breakout && isVolumeSpike && isGreenCandle && closedPrice > prevClosedHigh && closedPrice > bb.upper && rsi > 60) {
                    await enterNewTrade(coin.symbol, currentPrice, 'Breakout', calculateTradeStrength(false, 'Breakout', currentPrice, currentOpen, currentHigh, currentLow, currentVol, volAvg20, rsi, ema9, ema21, bb.upper, currentMarketScore || 50));
                }
            } catch(e) {}
        }
    } catch (err) {}
};

console.log("🚀 Server Engine Running in OPTIMIZED Mode (Low DB Cost)...");

// scanMarket: checks every 15s
setInterval(scanMarket, 15000);        
// manageOpenTrades: checks trailing stop every 3s
setInterval(manageOpenTrades, 3000);   
// cleanOldTrades: cleanup once an hour
setInterval(cleanOldTrades, 60 * 60 * 1000);

// Run initial scan on startup
scanMarket();
