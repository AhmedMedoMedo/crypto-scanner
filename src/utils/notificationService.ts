import { Trade, NotificationSettings } from '../types';

export const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  telegramBotToken: '',
  telegramChatId: '',
  webhookUrl: '',
  notifyOnOpen: true,
  notifyOnCloseWin: true,
  notifyOnCloseLoss: true,
  notifyOnEmergency: true,
  notifyOnMarketImprovement: true,
  notifyOnMarketDeterioration: true,
};

/**
 * Check if Telegram alerts are properly configured and active
 */
export function isTelegramConfigured(settings?: NotificationSettings): boolean {
  if (!settings) return false;
  const hasToken = Boolean(settings.telegramBotToken && settings.telegramBotToken.trim().length > 5);
  const hasChatId = Boolean(settings.telegramChatId && settings.telegramChatId.trim().length > 3);
  return hasToken && hasChatId && (settings.enabled !== false);
}

// Memory deduplication caches to prevent duplicate alerts during rapid re-renders
const sentOpenTradeAlerts = new Set<string>();
const sentCloseTradeAlerts = new Set<string>();

/**
 * Send raw Telegram message via Telegram Bot API
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  textHtml: string
): Promise<{ success: boolean; error?: string }> {
  if (!token || !chatId) {
    return { success: false, error: 'رمز البوت (Bot Token) أو معرف المحادثة (Chat ID) غير مدخلين.' };
  }

  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: textHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return { success: true };
    } else {
      console.warn('Telegram API Error response:', data);
      return {
        success: false,
        error: data.description || 'فشل إرسال رسالة التلجرام. يرجى التحقق من صحة التوكن والشات آي دي.',
      };
    }
  } catch (err: any) {
    console.error('Telegram network fetch error:', err);
    return {
      success: false,
      error: err?.message || 'خطأ في الاتصال بسيرفر التلجرام.',
    };
  }
}

/**
 * Send test connection message for Telegram
 */
export async function testTelegramConnection(
  token: string,
  chatId: string
): Promise<{ success: boolean; message: string }> {
  const nowStr = new Date().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const testText = `
🔔 <b>[رسالة اختبار وتأكيد الاتصال]</b> 🚀
━━━━━━━━━━━━━━━━━━
✅ <b>مبروك! تم ربط نظام الرادار بحساب التلجرام بنجاح!</b>

📱 ستصلك الآن التنبيهات الفورية تلقائياً عند:
  • 🟢 فتح وصيد أي فرصة جديدة
  • 🎯 تحقيق الهدف والربح (Take Profit)
  • 🛑 تفعيل وقف الخسارة (Stop Loss)
  • 🚀 انتعاش وتحسن وضع السوق (Bullish)
  • 🔴 تدهور وضع السوق ودخول مرحلة الخطر (Bearish)
  • 🚨 تفعيل بروتوكول حماية المحفظة

⏱️ <b>التوقيت:</b> <code>${nowStr}</code>
━━━━━━━━━━━━━━━━━━
🤖 <i>نظام أحمد الذكي لرصد العملات الرقمية</i>
`.trim();

  const res = await sendTelegramMessage(token, chatId, testText);
  if (res.success) {
    return {
      success: true,
      message: 'تم إرسال رسالة التلجرام التجريبية بنجاح! تفقد تطبيق التلجرام الآن ستجد الرسالة وصلت فوراً ✓',
    };
  } else {
    return {
      success: false,
      message: `فشل إرسال التلجرام: ${res.error}`,
    };
  }
}

/**
 * Send Trade Entry Notification via Telegram
 */
export async function notifyTradeOpen(
  settings: NotificationSettings | undefined,
  trade: Trade
): Promise<boolean> {
  if (!isTelegramConfigured(settings)) {
    console.log('[Telegram Alert Skipped] notifyTradeOpen: Telegram is not configured or disabled');
    return false;
  }
  if (settings?.notifyOnOpen === false) {
    return false;
  }

  const tradeKey = trade.docId || `${trade.symbol}-${trade.openTime}`;
  if (sentOpenTradeAlerts.has(tradeKey)) {
    return false;
  }
  sentOpenTradeAlerts.add(tradeKey);

  const symbolClean = trade.symbol.replace('USDT', '');
  const timeStr = new Date(trade.openTime || Date.now()).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const stopLossStr = trade.slLevel ? `$${trade.slLevel.toFixed(4)}` : 'تلقائي';
  const allocStr = trade.allocatedCapital ? `$${trade.allocatedCapital.toFixed(2)}` : '$100.00';
  const scoreStr = trade.entryScore ? `${trade.entryScore}%` : 'ممتاز';

  const tgText = `
🎯 <b>[صيد صفقة جديدة]</b> 🟢
━━━━━━━━━━━━━━━━━━
🪙 <b>العملة:</b> #${trade.symbol} (<code>${symbolClean}</code>)
📈 <b>الاستراتيجية:</b> <b>${trade.strategy || 'Momentum'}</b>
💵 <b>سعر الدخول:</b> <code>$${trade.entryPrice}</code>
🛡️ <b>وقف الخسارة:</b> <code>${stopLossStr}</code>
⚡ <b>قوة الإشارة:</b> <code>${scoreStr}</code>
💰 <b>رأس المال المخصص:</b> <code>${allocStr}</code>
⏱️ <b>الوقت:</b> <code>${timeStr}</code>
━━━━━━━━━━━━━━━━━━
🤖 <i>رادار الصفقات اللحظي - نظام أحمد</i>
`.trim();

  const res = await sendTelegramMessage(settings!.telegramBotToken, settings!.telegramChatId, tgText);
  if (!res.success) {
    console.error('[Telegram Alert Error] notifyTradeOpen:', res.error);
    return false;
  }
  console.log('[Telegram Alert Sent] notifyTradeOpen for', trade.symbol);
  return true;
}

/**
 * Send Trade Close Notification via Telegram
 */
export async function notifyTradeClose(
  settings: NotificationSettings | undefined,
  trade: Trade,
  status: 'won' | 'lost',
  pnl: number,
  dollarPnl?: number,
  reason?: string
): Promise<boolean> {
  if (!isTelegramConfigured(settings)) {
    console.log('[Telegram Alert Skipped] notifyTradeClose: Telegram is not configured or disabled');
    return false;
  }
  if (status === 'won' && settings?.notifyOnCloseWin === false) return false;
  if (status === 'lost' && settings?.notifyOnCloseLoss === false) return false;

  const tradeKey = `${trade.docId || trade.symbol}-${status}`;
  if (sentCloseTradeAlerts.has(tradeKey)) {
    return false;
  }
  sentCloseTradeAlerts.add(tradeKey);

  const isWin = status === 'won';
  const headerIcon = isWin ? '🏆' : '🛑';
  const title = isWin ? 'تم إغلاق صفقة بربح' : 'تم إغلاق صفقة';
  const pnlPrefix = pnl >= 0 ? '+' : '';
  const timeStr = new Date(trade.closeTime || Date.now()).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const durationStr =
    trade.openTime && trade.closeTime
      ? `${Math.max(1, Math.round((trade.closeTime - trade.openTime) / 60000))} دقيقة`
      : 'لحظي';

  const dollarStr =
    dollarPnl !== undefined
      ? `(${dollarPnl >= 0 ? '+' : ''}$${dollarPnl.toFixed(2)})`
      : '';

  const tgText = `
${headerIcon} <b>[${title}]</b> ${isWin ? '🎯' : '⚠️'}
━━━━━━━━━━━━━━━━━━
🪙 <b>العملة:</b> #${trade.symbol}
📊 <b>النتيجة:</b> <b>${pnlPrefix}${pnl.toFixed(2)}% ${dollarStr}</b>
📈 <b>الاستراتيجية:</b> ${trade.strategy || 'Auto'}
💵 <b>سعر الدخول:</b> <code>$${trade.entryPrice}</code>
🏁 <b>سعر الإغلاق:</b> <code>$${trade.currentPrice || trade.closePrice || trade.entryPrice}</code>
⏱️ <b>المدة:</b> ${durationStr} | <b>الوقت:</b> <code>${timeStr}</code>
${reason ? `📝 <b>السبب:</b> ${reason}\n` : ''}━━━━━━━━━━━━━━━━━━
${isWin ? '✨ <i>تم حجز الربح وإضافته للرصيد بنجاح!</i>' : '🛡️ <i>تم حماية باقي الرصيد بوقف الخسارة</i>'}
`.trim();

  const res = await sendTelegramMessage(settings!.telegramBotToken, settings!.telegramChatId, tgText);
  if (!res.success) {
    console.error('[Telegram Alert Error] notifyTradeClose:', res.error);
    return false;
  }
  console.log('[Telegram Alert Sent] notifyTradeClose for', trade.symbol, status);
  return true;
}

/**
 * Send Emergency Defense Action Notification via Telegram
 */
export async function notifyEmergencyAction(
  settings: NotificationSettings | undefined,
  action: string,
  affectedCount: number
): Promise<boolean> {
  if (!isTelegramConfigured(settings) || settings?.notifyOnEmergency === false) return false;

  const timeStr = new Date().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const actionName =
    action === 'liquidate_all'
      ? 'تسييل فوري شامل لجميع الصفقات لحماية رأس المال'
      : action === 'close_losing'
      ? 'إغلاق فوري للصفقات الخاسرة وتأمين الرابحة بريك إيفن'
      : 'تشديد الوقف ورفع البريك إيفن';

  const tgText = `
🚨 <b>[تنبيه تدخل طوارئ السوق]</b> 🛡️
━━━━━━━━━━━━━━━━━━
⚠️ <b>حالة السوق:</b> انخفاض مؤشر الأمان أو مرحلة خطر
⚙️ <b>الإجراء المنفذ:</b> ${actionName}
🔢 <b>عدد الصفقات المتأثرة:</b> ${affectedCount} صفقة
⏱️ <b>التوقيت:</b> <code>${timeStr}</code>
━━━━━━━━━━━━━━━━━━
🛡️ <i>نظام حماية المحفظة التلقائي</i>
`.trim();

  const res = await sendTelegramMessage(settings!.telegramBotToken, settings!.telegramChatId, tgText);
  if (!res.success) {
    console.error('[Telegram Alert Error] notifyEmergencyAction:', res.error);
    return false;
  }
  return true;
}

/**
 * Send Market Condition Change Notification via Telegram (Improvement or Deterioration)
 */
export async function notifyMarketStatusChange(
  settings: NotificationSettings | undefined,
  type: 'improvement' | 'deterioration',
  data: {
    status: 'bullish' | 'neutral' | 'bearish' | string;
    score: number;
    synergyLabel?: string;
    recommendation?: string;
  }
): Promise<boolean> {
  if (!isTelegramConfigured(settings)) return false;
  if (type === 'improvement' && settings?.notifyOnMarketImprovement === false) return false;
  if (type === 'deterioration' && settings?.notifyOnMarketDeterioration === false) return false;

  const isImprovement = type === 'improvement';
  const headerIcon = isImprovement ? '🟢' : '🔴';
  const title = isImprovement
    ? 'انتعاش وتحسن وضع السوق'
    : 'تحذير: تدهور وضع السوق ودخول مرحلة الخطر';

  const timeStr = new Date().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const synergy = data.synergyLabel || (isImprovement ? 'توافق إيجابي للأطر الزمنية' : 'سلبية أو تباين في الأطر');
  const recommendation = data.recommendation || (isImprovement ? 'بيئة مواتية لصيد فرص السكالبينج' : 'الحماية الآلية نشطة لحماية المحفظة');

  const tgText = isImprovement
    ? `
${headerIcon} <b>[${title}]</b> 🚀
━━━━━━━━━━━━━━━━━━
📊 <b>حالة السوق:</b> <b>صاعد وإيجابي (${data.status.toUpperCase()})</b>
⚡ <b>مؤشر أمان السوق:</b> <code>${data.score}%</code>
🎯 <b>توافق الأطر:</b> ${synergy}
💡 <b>التوصية:</b>
<i>${recommendation}</i>
⏱️ <b>الوقت:</b> <code>${timeStr}</code>
━━━━━━━━━━━━━━━━━━
✨ <i>بيئة مواتية لصيد صفقات السكالبينج والانفجارات السعرية</i>
`.trim()
    : `
${headerIcon} <b>[${title}]</b> ⚠️
━━━━━━━━━━━━━━━━━━
📊 <b>حالة السوق:</b> <b>هابط / مرحلة خطر (${data.status.toUpperCase()})</b>
⚡ <b>مؤشر أمان السوق:</b> <code>${data.score}%</code>
⚠️ <b>توافق الأطر:</b> ${synergy}
🛡️ <b>الإجراء التلقائي:</b>
<i>تم تفعيل بروتوكول حماية المحفظة وتجميد الصفقات الجديدة تلقائياً.</i>
⏱️ <b>الوقت:</b> <code>${timeStr}</code>
━━━━━━━━━━━━━━━━━━
🛑 <i>نظام الحماية الآلي نشط لحفظ رأس المال</i>
`.trim();

  const res = await sendTelegramMessage(settings!.telegramBotToken, settings!.telegramChatId, tgText);
  if (!res.success) {
    console.error('[Telegram Alert Error] notifyMarketStatusChange:', res.error);
    return false;
  }
  console.log('[Telegram Alert Sent] notifyMarketStatusChange:', type);
  return true;
}
