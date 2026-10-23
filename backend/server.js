const http = require('http');
const https = require('https');
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
  console.log('ℹ️ Backend running in Standalone Mode (Set SERVICE_ACCOUNT_KEY or supply serviceAccountKey.json to sync with Firestore).');
} else {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

let db = null;
try {
  const apps = (admin && admin.apps) ? admin.apps : [];
  if (apps.length > 0) {
    db = admin.firestore();
  }
} catch (e) {
  db = null;
}

const tradesRef = db ? db.collection('momentum_trades_v1') : null;
const systemRef = db ? db.collection('momentum_system_logs').doc('market_health') : null;
const settingsRef = db ? db.collection('momentum_system_logs').doc('scanner_settings') : null;

process.on('uncaughtException', (err) => {
    console.error('⚠️ Unhandled Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Unhandled Rejection:', reason);
});

process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down cleanly...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down cleanly...');
    process.exit(0);
});

const BACKEND_PORT = process.env.BACKEND_PORT || 10000;

let latestMarketMatrixData = null;

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const pathname = req.url ? req.url.split('?')[0].replace(/\/+$/, '') : '';

    if (pathname === '/api/market-matrix' || pathname === '/market-matrix') {
        res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify(latestMarketMatrixData || {
            score: 55,
            status: 'neutral',
            alignment: 'partial',
            recommendation: 'جاري فحص ومزامنة مصفوفة الأطر الخمسة...',
            matrix: {}
        }));
        return;
    }

    if (pathname === '/api/clear-history' || pathname === '/clear-history') {
        try {
            if (tradesRef && db) {
                const snapshotWon = await tradesRef.where('status', '==', 'won').get();
                const snapshotLost = await tradesRef.where('status', '==', 'lost').get();
                const allDocs = [...snapshotWon.docs, ...snapshotLost.docs];
                
                if (allDocs.length > 0) {
                    const BATCH_SIZE = 400;
                    for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
                        const chunk = allDocs.slice(i, i + BATCH_SIZE);
                        const batch = db.batch();
                        chunk.forEach(docSnap => batch.delete(docSnap.ref));
                        await batch.commit();
                    }
                    console.log(`🗑️ [مسح السجل]: تم حذف ${allDocs.length} صفقة مغلقة بنجاح من قاعدة البيانات.`);
                }
                res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                res.end(JSON.stringify({ success: true, count: allDocs.length }));
                return;
            } else {
                res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                res.end(JSON.stringify({ success: true, count: 0, note: 'standalone_or_client_handled' }));
                return;
            }
        } catch (e) {
            console.error('Error clearing history on backend:', e.message);
            res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
            res.end(JSON.stringify({ success: false, error: e.message }));
            return;
        }
    }

    if (pathname === '/api/test-notification' || pathname === '/test-notification') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const token = (parsed.token || (SETTINGS.notifications && SETTINGS.notifications.telegramBotToken) || '').trim();
                const chatId = (parsed.chatId || (SETTINGS.notifications && SETTINGS.notifications.telegramChatId) || '').trim();
                if (!token || !chatId) {
                    res.writeHead(400, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(JSON.stringify({ success: false, error: 'Token and Chat ID required' }));
                    return;
                }
                const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const testMsg = `🔔 <b>[رسالة اختبار وتأكيد الاتصال]</b> 🚀\n━━━━━━━━━━━━━━━━━━\n✅ <b>مبروك! تم ربط نظام الرادار بحساب التلجرام بنجاح!</b>\n\n📱 ستصلك الآن التنبيهات الفورية عند فتح وإغلاق الصفقات وتحقيق الأهداف.\n\n⏱️ <b>الوقت:</b> <code>${nowStr}</code>\n━━━━━━━━━━━━━━━━━━\n🤖 <i>نظام أحمد الذكي</i>`;
                
                const postData = JSON.stringify({ chat_id: chatId, text: testMsg, parse_mode: 'HTML' });
                const tgReq = https.request({
                    hostname: 'api.telegram.org',
                    port: 443,
                    path: `/bot${token}/sendMessage`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
                }, (tgRes) => {
                    let tgBody = '';
                    tgRes.on('data', d => tgBody += d);
                    tgRes.on('end', () => {
                        try {
                            const tgData = JSON.parse(tgBody || '{}');
                            res.writeHead(tgRes.statusCode === 200 ? 200 : 400, {'Content-Type': 'application/json; charset=utf-8'});
                            res.end(JSON.stringify({ success: tgData.ok, error: tgData.description }));
                        } catch(parseErr) {
                            res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                            res.end(JSON.stringify({ success: tgRes.statusCode === 200 }));
                        }
                    });
                });
                tgReq.on('error', (e) => {
                    res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(JSON.stringify({ success: false, error: e.message }));
                });
                tgReq.write(postData);
                tgReq.end();
            } catch (err) {
                res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }



    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end('Momentum Scanner Backend is ALIVE and OPTIMIZED! 🚀\n');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`📡 Port ${BACKEND_PORT} already in use. Continuing in scanner mode.`);
    } else {
        console.error('Server HTTP error:', err.message);
    }
});

server.listen(BACKEND_PORT, () => {
    console.log(`📡 Backend HTTP server running on port ${BACKEND_PORT}`);
});

let virtualTrades = []; // الصفقات ستحفظ هنا في الذاكرة لتوفير القراءة
let currentMarketScore = null;
let globalMarketStatus = 'neutral';
let isCheckingMarket = false;
let marketScoreLog = [];
let lastReportedMarketStatus = null;
let lastReportedMarketScore = null;
let lastMarketAlertTime = 0;
const MARKET_ALERT_COOLDOWN_MS = 3 * 60 * 1000; // 3 دقائق كحد أدنى بين تنبيهات السوق لتجنب التكرار
const exitCooldowns = {};
const BLACKLIST = ['USDCUSDT', 'USD1USDT', 'FDUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'EURUSDT', 'XAUTUSDT', 'PAXGUSDT', 'BUSDUSDT', 'AEURUSDT', 'USDSUSDT'];

let SETTINGS = { 
    tf: '15m', sl_perc: 0.03, min_tp: 0.05, trail_dist: 0.015, vol_mult: 2.0, cooldown_mins: 15, auto_kill: true, 
    strats: { momentum: true, breakout: true, sniper: true, bbrsi: true, turboScalp: true } 
};

// [تحسين 1]: استخدام onSnapshot بدلاً من جلب الإعدادات كل 5 ثوانٍ
let lastSettingsString = "";
if (settingsRef) {
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
}

// [تحسين 2]: استماع حي للصفقات المفتوحة فقط، بدلاً من جلبها كل 5 ثوانٍ
if (tradesRef) {
  tradesRef.where('status', '==', 'open').onSnapshot((snapshot) => {
    let activeTrades = [];
    snapshot.forEach(doc => { activeTrades.push({ docId: doc.id, ...doc.data() }); });
    virtualTrades = activeTrades; // تحديث الذاكرة فوراً عند أي تغيير
  }, err => console.error("Trades Sync Error:", err));
}

// تم إلغاء الحذف التلقائي نهائياً للحفاظ على كافة الصفقات المغلقة والأرباح التاريخية للمستخدم
const cleanOldTrades = async () => {
    // Permanent retention: never delete past trades
    return;
};

const sendTelegramNotification = (textHtml) => {
    try {
        const notif = SETTINGS && SETTINGS.notifications;
        if (!notif || !notif.enabled) return;
        const token = (notif.telegramBotToken || '').trim();
        const chatId = (notif.telegramChatId || '').trim();
        if (!token || !chatId) return;

        const postData = JSON.stringify({
            chat_id: chatId,
            text: textHtml,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });

        const req = https.request({
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => console.warn('Telegram response status:', res.statusCode, body));
            }
        });

        req.on('error', (e) => {
            console.error('Telegram notification error:', e.message);
        });

        req.write(postData);
        req.end();
    } catch (e) {
        console.error('Failed to send telegram notification:', e.message);
    }
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
    } else if (strategy === 'TurboScalp') {
        if (rsi >= 50 && rsi <= 68) b.rsi = 15; else if (rsi > 68 && rsi <= 75) b.rsi = 12; else if (rsi >= 45 && rsi < 50) b.rsi = 10; else b.rsi = 5;
    } else {
        if (rsi >= 55 && rsi <= 72) b.rsi = 15; else if (rsi > 72 && rsi <= 80) b.rsi = 12; else if (rsi >= 50 && rsi < 55) b.rsi = 10; else if (rsi > 80) b.rsi = 5; else b.rsi = 2; 
    }

    if (strategy === 'Breakout') { b.setup = price > bbUpper ? 15 : (price > bbUpper * 0.99 ? 10 : 5); } 
    else if (strategy === 'BB_RSI') { b.setup = 15; }
    else if (strategy === 'TurboScalp') { let pDist = Math.abs((price - ema9) / ema9) * 100; b.setup = pDist < 1.5 ? 15 : (pDist < 2.5 ? 12 : 8); }
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
    if (!tradesRef) return;
    if (exitCooldowns[symbol] && Date.now() < exitCooldowns[symbol]) return;
    if (SETTINGS.auto_kill && globalMarketStatus === 'bearish') return;
    if (virtualTrades.find(t => t.symbol === symbol && t.status === 'open')) return;

    // حماية المحفظة: لا نفتح صفقات أكثر من الحد الأقصى المتزامن
    const maxTrades = SETTINGS.max_open_trades || 10;
    const openCount = virtualTrades.filter(t => t.status === 'open').length;
    if (openCount >= maxTrades) {
        return;
    }

    const initialCap = SETTINGS.portfolio_capital || 1000;
    const perTradeAlloc = Number((initialCap / maxTrades).toFixed(2));

    // لصفقات السكالبينج الخاطف، وقف الخسارة محسوب بدقة (2% - 2.5% كحد أقصى) لحماية رأس المال
    const slRate = strategy === 'TurboScalp' ? Math.min(SETTINGS.sl_perc || 0.025, 0.025) : (SETTINGS.sl_perc || 0.03);

    const newTrade = {
        symbol: symbol, entryPrice: price, maxPrice: price, trailActive: false, 
        slLevel: price * (1 - slRate), status: 'open', openTime: Date.now(),
        strategy: strategy, entryScore: healthData.score, liveScore: healthData.score,
        entryBreakdown: healthData.breakdown,
        allocatedCapital: perTradeAlloc
    };

    try {
        const docRef = tradesRef.doc();
        await docRef.set(newTrade);
        // ستتم إضافتها لـ virtualTrades تلقائياً عبر onSnapshot
        console.log(`🟢 [دخول فرصة نارية] ${symbol} ($${perTradeAlloc}) | الاستراتيجية: ${strategy}`);

        // إرسال تنبيه فوري لهاتف المستخدم عبر التلجرام
        if (SETTINGS.notifications && SETTINGS.notifications.enabled && SETTINGS.notifications.notifyOnOpen !== false) {
            const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            const msg = `🎯 <b>[صيد صفقة جديدة]</b> 🟢\n━━━━━━━━━━━━━━━━━━\n🪙 <b>العملة:</b> #${symbol}\n📈 <b>الاستراتيجية:</b> <b>${strategy}</b>\n💵 <b>سعر الدخول:</b> <code>$${price}</code>\n🛡️ <b>وقف الخسارة:</b> <code>$${newTrade.slLevel.toFixed(4)}</code>\n⚡ <b>قوة الإشارة:</b> <code>${healthData.score}%</code>\n💰 <b>رأس المال:</b> <code>$${perTradeAlloc}</code>\n⏱️ <b>الوقت:</b> <code>${timeStr}</code>\n━━━━━━━━━━━━━━━━━━\n🤖 <i>رادار الصفقات اللحظي</i>`;
            sendTelegramNotification(msg);
        }
    } catch (e) { console.error("Error:", e.message); }
};

const evaluateTfData = (tfName, klines, label) => {
    if (!klines || klines.length === 0) return { tf: tfName, score: 50, status: 'neutral', rsi: 50, trend: 'flat', volRatio: 1, label };
    const closes = klines.map(k => parseFloat(k[4]));
    const volumes = klines.map(k => parseFloat(k[5]));
    const currentPrice = closes[closes.length - 1];
    const closedCloses = closes.slice(0, -1);
    const closedVolumes = volumes.slice(0, -1);

    const rsi = Math.round(calcRSI(closedCloses, 14) || 50);
    const volSma = calcSMA(closedVolumes, 20) || 1;
    const currentVol = closedVolumes[closedVolumes.length - 1] || 1;
    const volRatio = Number((currentVol / volSma).toFixed(2));

    let score = 30;
    let trend = 'flat';

    if (tfName === '4h') {
        const ema50 = calcEMA(closedCloses, 50);
        const ema200 = calcEMA(closedCloses, Math.min(200, closedCloses.length - 1));
        if (ema200 && currentPrice > ema200) { score += 25; trend = 'up'; }
        else if (ema200 && currentPrice < ema200 * 0.98) { score -= 20; trend = 'down'; }
        if (ema50 && ema200 && ema50 > ema200) { score += 20; trend = 'up'; }
        if (ema50 && currentPrice > ema50) score += 15;
        if (rsi >= 50 && rsi <= 66) score += 20;
        else if (rsi > 66 && rsi <= 76) score += 12;
        else if (rsi < 40) score -= 15;
        if (volRatio >= 1.2) score += 10;
    } else if (tfName === '1h') {
        const ema20 = calcEMA(closedCloses, 20) || currentPrice;
        const ema50 = calcEMA(closedCloses, Math.min(50, closedCloses.length - 1)) || currentPrice;
        if (currentPrice > ema50 && ema20 > ema50) { trend = 'up'; score += 40; }
        else if (currentPrice < ema50 && ema20 < ema50) { trend = 'down'; score -= 20; }
        else { trend = 'flat'; score += 10; }
        if (rsi >= 48 && rsi <= 68) score += 25;
        else if (rsi > 68 && rsi <= 78) score += 12;
        else if (rsi < 42) score -= 15;
        if (volRatio >= 1.3) score += 15;
        else if (volRatio >= 0.9) score += 8;
    } else {
        const ema9 = calcEMA(closedCloses, 9) || currentPrice;
        const ema21 = calcEMA(closedCloses, 21) || currentPrice;
        const ema50 = calcEMA(closedCloses, Math.min(50, closedCloses.length - 1)) || currentPrice;
        if (currentPrice > ema9 && ema9 > ema21) {
            trend = 'up'; score += 35;
            if (currentPrice > ema50) score += 10;
        } else if (currentPrice < ema9 && ema9 < ema21) {
            trend = 'down'; score -= 15;
        } else {
            trend = 'flat'; score += 10;
        }
        if (rsi >= 50 && rsi <= 68) score += 25;
        else if (rsi > 68 && rsi <= 78) score += 15;
        else if (rsi > 78) score -= 10;
        else if (rsi >= 40 && rsi < 50) score += 5;
        else score -= 15;
        if (volRatio >= 1.5) score += 15;
        else if (volRatio >= 1.0) score += 8;
    }

    score = Math.max(5, Math.min(100, Math.round(score)));
    let status = 'neutral';
    if (score >= 65) status = 'bullish';
    else if (score < 45) status = 'bearish';

    return { tf: tfName, score, status, rsi, trend, volRatio, label };
};

const analyzeMarketHealth = async () => {
    if (isCheckingMarket) return;
    isCheckingMarket = true;
    try {
        const [res1m, res5m, res15m, res1h, res4h] = await Promise.all([
            fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100'),
            fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=100'),
            fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=100'),
            fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100'),
            fetch('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=100')
        ]);
        if(!res1m.ok || !res5m.ok || !res15m.ok) return;

        const [klines1m, klines5m, klines15m, klines1h, klines4h] = await Promise.all([
            res1m.json(), res5m.json(), res15m.json(), res1h.ok ? res1h.json() : [], res4h.ok ? res4h.json() : []
        ]);

        const tf1m = evaluateTfData('1m', klines1m, 'نبض الزخم اللحظي (1m)');
        const tf5m = evaluateTfData('5m', klines5m, 'تأكيد مسار الحركة (5m)');
        const tf15m = evaluateTfData('15m', klines15m, 'قاعدة الهدف 4%+ (15m)');
        const tf1h = evaluateTfData('1h', klines1h, 'المسار اليومي والزخم (1h)');
        const tf4h = evaluateTfData('4h', klines4h, 'الاتجاه الماكرو المؤسسي (4h)');

        const macroScore = Math.round((tf4h.score * 0.55) + (tf1h.score * 0.45));
        const microScore = Math.round((tf15m.score * 0.40) + (tf5m.score * 0.35) + (tf1m.score * 0.25));

        let macroStatus = 'neutral';
        if (macroScore >= 65) macroStatus = 'bullish';
        else if (macroScore < 48) macroStatus = 'bearish';

        let microStatus = 'neutral';
        if (microScore >= 65) microStatus = 'bullish';
        else if (microScore < 48) microStatus = 'bearish';

        let compositeScore = Math.round((macroScore * 0.4) + (microScore * 0.6));
        compositeScore = Math.max(5, Math.min(100, compositeScore));

        const all5Bullish = tf4h.status === 'bullish' && tf1h.status === 'bullish' && tf15m.status === 'bullish' && tf5m.status === 'bullish' && tf1m.status === 'bullish';
        const all5Bearish = tf4h.status === 'bearish' && tf1h.status === 'bearish' && tf15m.status === 'bearish' && tf5m.status === 'bearish' && tf1m.status === 'bearish';

        let macroMicroSynergy = 'MIXED_DIVERGENCE';
        let synergyLabel = 'تباين بين الماكرو والمايكرو: تذبذب مع ارتدادات محدودة';

        if (all5Bullish || (macroStatus === 'bullish' && microStatus === 'bullish' && compositeScore >= 75)) {
            macroMicroSynergy = 'PERFECT_5_TF';
            synergyLabel = '🔥🔥 توافق خماسي مثالي (4h + 1h + 15m + 5m + 1m): أقصى درجات أمان وانفجار صفقات +4%';
        } else if (macroStatus === 'bullish' && microStatus !== 'bearish') {
            macroMicroSynergy = 'STRONG_TREND';
            synergyLabel = '🚀 الاتجاه العام صاعد (4h/1h): السكالبينج اللحظي مدعوم بقوة مؤسسية';
        } else if (macroStatus === 'bearish' && microStatus === 'bullish') {
            macroMicroSynergy = 'MIXED_DIVERGENCE';
            synergyLabel = '⚠️ تحذير فخ صعودي (Bull Trap): الماكرو (4h) هابط بينما المايكرو صاعد، التزم بوقف الخسارة بدقة';
        } else if (macroStatus === 'bearish' && microStatus === 'bearish') {
            macroMicroSynergy = 'BEARISH_DANGER';
            synergyLabel = '🔴 خطر شامل (سلبية الماكرو والمايكرو): الحماية الآلية نشطة لمنع الخسائر';
        }

        let alignment = 'partial';
        if (all5Bullish) alignment = 'full';
        else if (all5Bearish || macroMicroSynergy === 'MIXED_DIVERGENCE') alignment = 'divergent';

        const scalpOpportunity = (macroStatus === 'bullish' && microScore >= 60) || (microStatus === 'bullish' && compositeScore >= 65);

        let status = 'neutral';
        if (compositeScore >= 70 && macroStatus !== 'bearish') status = 'bullish';
        else if (compositeScore < 48 || macroStatus === 'bearish') status = 'bearish';

        globalMarketStatus = status;

        let recommendation = synergyLabel;
        if (macroMicroSynergy === 'PERFECT_5_TF') {
            recommendation = '🔥🔥 بيئة تداول أسطورية: صعود الحيتان (4h & 1h) يتطابق مع زخم السكالبينج (15m & 5m & 1m)! اقتنص صفقات +4% بثقة.';
        } else if (macroMicroSynergy === 'STRONG_TREND') {
            recommendation = '⚡ اتجاه ماكرو قوي: استغل موجات 1m و 5m السريعة للدخول مع اتجاه اليوم وساعة الصفر، الأهداف تمتد لـ 4% فأكثر.';
        } else if (macroMicroSynergy === 'MIXED_DIVERGENCE') {
            recommendation = '⚠️ تباين الأطر الزمنية: ارتداد لحظي عكس اتجاه 4h، اكتفِ بأهداف سريعة وحرك وقف الخسارة فوراً لحجز الأرباح.';
        }

        const matrixPayload = {
            '1m': tf1m,
            '5m': tf5m,
            '15m': tf15m,
            '1h': tf1h,
            '4h': tf4h
        };

        if (currentMarketScore !== compositeScore) {
            marketScoreLog.unshift({ score: compositeScore, time: Date.now() });
            if (marketScoreLog.length > 6) marketScoreLog = marketScoreLog.slice(0, 6);
            currentMarketScore = compositeScore;
        }

        latestMarketMatrixData = {
            score: compositeScore,
            status: globalMarketStatus,
            log: marketScoreLog,
            matrix: matrixPayload,
            macroScore,
            microScore,
            macroStatus,
            microStatus,
            macroMicroSynergy,
            synergyLabel,
            alignment,
            scalpOpportunity,
            recommendation,
            targetProjection: macroMicroSynergy === 'PERFECT_5_TF' ? '+5.0% - +9.0%' : (scalpOpportunity ? '+4.0% - +6.5%' : '+2.5% - +4.0%'),
            lastUpdate: Date.now()
        };

        if (systemRef) {
            await systemRef.set({
                score: compositeScore,
                status: globalMarketStatus,
                log: marketScoreLog,
                matrix: matrixPayload,
                macroScore,
                microScore,
                macroStatus,
                microStatus,
                macroMicroSynergy,
                synergyLabel,
                alignment,
                scalpOpportunity,
                recommendation,
                targetProjection: macroMicroSynergy === 'PERFECT_5_TF' ? '+5.0% - +9.0%' : (scalpOpportunity ? '+4.0% - +6.5%' : '+2.5% - +4.0%'),
                lastUpdate: Date.now()
            });
        }

        // [نظام تنبيهات تغير وضع السوق الفوري]:
        // تنبيه عند تحسن وضع السوق (Bullish / انتعاش)
        // تنبيه عند تدهور أو سوء وضع السوق (Bearish / خطر)
        const notif = SETTINGS && SETTINGS.notifications;
        if (notif && notif.enabled) {
            const channel = notif.channel || 'all';
            const now = Date.now();
            const timePassed = now - lastMarketAlertTime;

            if (lastReportedMarketStatus !== null && timePassed >= MARKET_ALERT_COOLDOWN_MS) {
                const isImproved = (
                    (lastReportedMarketStatus === 'bearish' && (globalMarketStatus === 'neutral' || globalMarketStatus === 'bullish')) ||
                    (lastReportedMarketStatus === 'neutral' && globalMarketStatus === 'bullish') ||
                    (lastReportedMarketScore !== null && lastReportedMarketScore < 50 && compositeScore >= 66)
                );

                const isDeteriorated = (
                    (lastReportedMarketStatus === 'bullish' && (globalMarketStatus === 'neutral' || globalMarketStatus === 'bearish')) ||
                    (lastReportedMarketStatus === 'neutral' && globalMarketStatus === 'bearish') ||
                    (lastReportedMarketScore !== null && lastReportedMarketScore >= 60 && compositeScore < 48)
                );

                const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                if (isImproved && notif.notifyOnMarketImprovement !== false) {
                    lastReportedMarketStatus = globalMarketStatus;
                    lastReportedMarketScore = compositeScore;
                    lastMarketAlertTime = now;

                    const tgMsg = `🟢 <b>[انتعاش وتحسن وضع السوق]</b> 🚀\n━━━━━━━━━━━━━━━━━━\n📊 <b>حالة السوق الجديدة:</b> <b>صاعد وإيجابي (${globalMarketStatus.toUpperCase()})</b>\n⚡ <b>مؤشر أمان السوق:</b> <code>${compositeScore}%</code>\n🎯 <b>توافق الأطر:</b> ${synergyLabel}\n💡 <b>التوصية الفنية:</b>\n<i>${recommendation}</i>\n⏱️ <b>الوقت:</b> <code>${timeStr}</code>\n━━━━━━━━━━━━━━━━━━\n✨ <i>بيئة مواتية لصيد فرص السكالبينج والانفجارات السعرية</i>`;
                    sendTelegramNotification(tgMsg);
                } else if (isDeteriorated && notif.notifyOnMarketDeterioration !== false) {
                    lastReportedMarketStatus = globalMarketStatus;
                    lastReportedMarketScore = compositeScore;
                    lastMarketAlertTime = now;

                    const tgMsg = `🔴 <b>[تحذير: تدهور وضع السوق ودخول مرحلة الخطر]</b> ⚠️\n━━━━━━━━━━━━━━━━━━\n📊 <b>حالة السوق الحالية:</b> <b>هابط / مرحلة خطر (${globalMarketStatus.toUpperCase()})</b>\n⚡ <b>مؤشر أمان السوق:</b> <code>${compositeScore}%</code>\n⚠️ <b>توافق الأطر:</b> ${synergyLabel}\n🛡️ <b>الإجراء التلقائي:</b>\n<i>تم تفعيل أنظمة الدفاع وتجميد الصفقات الجديدة تلقائياً لحماية المحفظة.</i>\n⏱️ <b>الوقت:</b> <code>${timeStr}</code>\n━━━━━━━━━━━━━━━━━━\n🛑 <i>نظام الحماية الآلي نشط لحفظ رأس المال</i>`;
                    sendTelegramNotification(tgMsg);
                }
            } else if (lastReportedMarketStatus === null) {
                lastReportedMarketStatus = globalMarketStatus;
                lastReportedMarketScore = compositeScore;
            }
        }
    } catch (e) {
        console.error("Error analyzing market health:", e.message);
    } finally {
        isCheckingMarket = false;
    }
};

// [تحسين 3]: الذاكرة المحلية لمعالجة الملاحقة دون إرهاق قاعدة البيانات
let memoryTrades = {}; 
let isManagingTrades = false;

const manageOpenTrades = async () => {
    if (isManagingTrades) return;
    if (!db || !tradesRef || virtualTrades.length === 0) return;
    isManagingTrades = true;
    
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
                memoryTrades[trade.docId] = { 
                    maxPrice: trade.maxPrice || trade.entryPrice, 
                    slLevel: trade.slLevel || (trade.entryPrice * (1 - (SETTINGS.sl_perc || 0.03))), 
                    trailActive: !!trade.trailActive 
                };
            }
            let mem = memoryTrades[trade.docId];
            
            let pnl = trade.entryPrice > 0 ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100 : 0;
            
            if (currentPrice > mem.maxPrice) mem.maxPrice = currentPrice;

            // تفعيل الملاحقة: لصفقات TurboScalp تبدأ الملاحقة عند تحقيق الهدف 4% أو min_tp
            const targetMinTp = trade.strategy === 'TurboScalp' ? Math.min(SETTINGS.min_tp || 0.04, 0.04) : (SETTINGS.min_tp || 0.05);
            if (!mem.trailActive && pnl >= (targetMinTp * 100)) {
                mem.trailActive = true; 
                console.log(`✨ [تفعيل الملاحقة في الذاكرة] ${trade.symbol} (${trade.strategy || 'Auto'})`);
                // نكتب في DB فقط عند تفعيل الملاحقة لأول مرة
                batch.update(tradesRef.doc(trade.docId), { trailActive: true }); 
                hasUpdates = true;
            }

            if (mem.trailActive) {
                const trailDistValue = mem.maxPrice * (SETTINGS.trail_dist || 0.015);
                const potentialSl = mem.maxPrice - trailDistValue;
                if (potentialSl > mem.slLevel) mem.slLevel = potentialSl;
            }

            // [بروتوكول حماية الصفقات وقت خطر السوق]:
            const isMarketDanger = globalMarketStatus === 'bearish' || (currentMarketScore !== null && currentMarketScore < 48);
            const defenseMode = SETTINGS.emergency_defense_mode || 'tighten_breakeven';

            if (isMarketDanger && defenseMode !== 'alert_only') {
                if (defenseMode === 'liquidate_all') {
                    // تسييل فوري لجميع الصفقات لحماية رأس المال
                    const status = pnl >= 0 ? 'won' : 'lost';
                    batch.update(tradesRef.doc(trade.docId), {
                        status: status, closeTime: Date.now(), closePrice: currentPrice, pnl: pnl,
                        maxPrice: mem.maxPrice, slLevel: currentPrice
                    });
                    hasUpdates = true;
                    delete memoryTrades[trade.docId];
                    console.log(`🚨 [تسييل طارئ للسوق] إغلاق ${trade.symbol} | ${status} | ${pnl.toFixed(2)}%`);
                    continue;
                } else if (defenseMode === 'close_losing' && pnl < -0.3) {
                    // إغلاق فوري للصفقات الخاسرة لمنع تفاقم الخسائر
                    batch.update(tradesRef.doc(trade.docId), {
                        status: 'lost', closeTime: Date.now(), closePrice: currentPrice, pnl: pnl,
                        maxPrice: mem.maxPrice, slLevel: currentPrice
                    });
                    hasUpdates = true;
                    delete memoryTrades[trade.docId];
                    console.log(`🛑 [إغلاق دفاعي طارئ لخاسرة] ${trade.symbol} لمنع الغرق | ${pnl.toFixed(2)}%`);
                    continue;
                } else if (pnl > 0) {
                    // تأمين الصفقات الرابحة برفع الوقف فوراً لنقطة الدخول Breakeven
                    const beStop = trade.entryPrice * 1.002;
                    if (mem.slLevel < beStop) {
                        mem.slLevel = beStop;
                        console.log(`🛡️ [تأمين بريك إيفن وقت الخطر] ${trade.symbol} رفع الوقف لنقطة الدخول لحجز الربح`);
                    }
                }
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

                // إرسال تنبيه فوري بنتيجة الصفقة (تلجرام أو إيميل أو الاثنين معاً)
                if (SETTINGS.notifications && SETTINGS.notifications.enabled) {
                    const isWin = status === 'won';
                    const shouldSend = (isWin && SETTINGS.notifications.notifyOnCloseWin !== false) || (!isWin && SETTINGS.notifications.notifyOnCloseLoss !== false);
                    if (shouldSend) {
                        const channel = SETTINGS.notifications.channel || 'all';
                        const headerIcon = isWin ? '🏆' : '🛑';
                        const title = isWin ? 'تم إغلاق صفقة بربح' : 'تم إغلاق صفقة';
                        const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                        const alloc = trade.allocatedCapital || (SETTINGS.portfolio_capital ? SETTINGS.portfolio_capital / (SETTINGS.max_open_trades || 10) : 100);
                        const dollarVal = (alloc * pnl) / 100;
                        const dollarStr = `(${pnl >= 0 ? '+' : ''}$${dollarVal.toFixed(2)})`;

                        // تلجرام
                        if (channel === 'telegram' || channel === 'all') {
                            const msg = `${headerIcon} <b>[${title}]</b> ${isWin ? '🎯' : '⚠️'}\n━━━━━━━━━━━━━━━━━━\n🪙 <b>العملة:</b> #${trade.symbol}\n📊 <b>النتيجة:</b> <b>${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}% ${dollarStr}</b>\n📈 <b>الاستراتيجية:</b> ${trade.strategy || 'Auto'}\n💵 <b>سعر الدخول:</b> <code>$${trade.entryPrice}</code>\n🏁 <b>سعر الإغلاق:</b> <code>$${currentPrice}</code>\n⏱️ <b>الوقت:</b> <code>${timeStr}</code>\n━━━━━━━━━━━━━━━━━━\n${isWin ? '✨ <i>تم حجز الأرباح بنجاح</i>' : '🛡️ <i>تم حماية الرصيد بوقف الخسارة</i>'}`;
                            sendTelegramNotification(msg);
                        }
                    }
                }
            }
        }

        if (hasUpdates) await batch.commit();
    } catch (e) {
    } finally {
        isManagingTrades = false;
    }
};

let isScanningMarket = false;
const scanMarket = async () => {
    if (isScanningMarket) return;
    isScanningMarket = true;
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

                // استراتيجية السكالبينج الخاطف 4%+ (مخصصة لفريمات 1m و 5m و 15m فقط)
                const isScalpTf = ['1m', '5m', '15m'].includes(SETTINGS.tf);
                if (SETTINGS.strats.turboScalp !== false && isScalpTf) {
                    const isTrendAligned = closedPrice > ema50 && ema9 > ema21 && closedPrice >= ema9;
                    const isRsiRunway = rsi >= 50 && rsi <= 68;
                    const isScalpVol = closedVol >= (volAvg20 * Math.max(1.7, SETTINGS.vol_mult * 0.85));
                    const isImpulse = isGreenCandle && closePosition >= 0.68;
                    const bbDist = ((bb.upper - closedPrice) / closedPrice) * 100;
                    const hasExpansionRoom = bbDist >= 2.0 || closedPrice > bb.upper;

                    if (isTrendAligned && isRsiRunway && isScalpVol && isImpulse && hasExpansionRoom) {
                        await enterNewTrade(coin.symbol, currentPrice, 'TurboScalp', calculateTradeStrength(false, 'TurboScalp', currentPrice, currentOpen, currentHigh, currentLow, currentVol, volAvg20, rsi, ema9, ema21, bb.upper, currentMarketScore || 50));
                        continue;
                    }
                }

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
            } catch (e) {}
        }
    } catch (err) {
    } finally {
        isScanningMarket = false;
    }
};

console.log("🚀 Server Engine Running in OPTIMIZED Mode (Low DB Cost)...");
console.log("🛡️ [PERMANENT TRADES RETENTION ACTIVE] - Automatic deletion of closed trades is PERMANENTLY DISABLED.");

// scanMarket: checks every 15s
setInterval(scanMarket, 15000);        
// manageOpenTrades: checks trailing stop every 3s
setInterval(manageOpenTrades, 3000);   

// Run initial scan on startup
scanMarket();
