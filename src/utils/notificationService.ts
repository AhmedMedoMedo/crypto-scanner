import { Trade, NotificationSettings } from '../types';

export const defaultNotificationSettings: NotificationSettings = {
  enabled: false,
  channel: 'telegram',
  telegramBotToken: '',
  telegramChatId: '',
  emailAddress: '',
  webhookUrl: '',
  notifyOnOpen: true,
  notifyOnCloseWin: true,
  notifyOnCloseLoss: true,
  notifyOnEmergency: true,
};

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
      return {
        success: false,
        error: data.description || 'فشل إرسال رسالة التلجرام. يرجى التحقق من صحة التوكن والشات آي دي.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'خطأ في الاتصال بسيرفر التلجرام. تأكد من اتصال الإنترنت.',
    };
  }
}

/**
 * Send test connection message
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

📱 ستصلك الآن التنبيهات الفورية عند:
  • 🟢 فتح وصيد أي فرصة جديدة
  • 🎯 تحقيق الهدف والربح (Take Profit)
  • 🛑 تفعيل وقف الخسارة (Stop Loss)
  • 🚨 تفعيل بروتوكول حماية السوق

⏱️ <b>التوقيت:</b> <code>${nowStr}</code>
━━━━━━━━━━━━━━━━━━
🤖 <i>نظام أحمد الذكي لرصد العملات الرقمية</i>
`.trim();

  const res = await sendTelegramMessage(token, chatId, testText);
  if (res.success) {
    return {
      success: true,
      message: 'تم إرسال الرسالة التجريبية بنجاح! تفقد تطبيق التلجرام الآن ستجد الرسالة وصلت فوراً ✓',
    };
  } else {
    return {
      success: false,
      message: `فشل الإرسال: ${res.error}`,
    };
  }
}

/**
 * Send Trade Entry Notification
 */
export async function notifyTradeOpen(
  settings: NotificationSettings | undefined,
  trade: Trade
): Promise<void> {
  if (!settings || !settings.enabled || !settings.notifyOnOpen) return;
  if (!settings.telegramBotToken || !settings.telegramChatId) return;

  const symbolClean = trade.symbol.replace('USDT', '');
  const timeStr = new Date(trade.openTime || Date.now()).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const stopLossStr = trade.slLevel ? `$${trade.slLevel.toFixed(4)}` : 'تلقائي';
  const allocStr = trade.allocatedCapital ? `$${trade.allocatedCapital.toFixed(2)}` : '$100.00';
  const scoreStr = trade.entryScore ? `${trade.entryScore}%` : 'ممتاز';

  const text = `
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

  await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, text);
}

/**
 * Send Trade Close Notification
 */
export async function notifyTradeClose(
  settings: NotificationSettings | undefined,
  trade: Trade,
  status: 'won' | 'lost',
  pnl: number,
  dollarPnl?: number,
  reason?: string
): Promise<void> {
  if (!settings || !settings.enabled) return;
  if (status === 'won' && !settings.notifyOnCloseWin) return;
  if (status === 'lost' && !settings.notifyOnCloseLoss) return;
  if (!settings.telegramBotToken || !settings.telegramChatId) return;

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
      ? `${Math.round((trade.closeTime - trade.openTime) / 60000)} دقيقة`
      : 'لحظي';

  const dollarStr =
    dollarPnl !== undefined
      ? `(${dollarPnl >= 0 ? '+' : ''}$${dollarPnl.toFixed(2)})`
      : '';

  const text = `
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

  await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, text);
}

/**
 * Send Emergency Defense Action Notification
 */
export async function notifyEmergencyAction(
  settings: NotificationSettings | undefined,
  action: string,
  affectedCount: number
): Promise<void> {
  if (!settings || !settings.enabled || !settings.notifyOnEmergency) return;
  if (!settings.telegramBotToken || !settings.telegramChatId) return;

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

  const text = `
🚨 <b>[تنبيه تدخل طوارئ السوق]</b> 🛡️
━━━━━━━━━━━━━━━━━━
⚠️ <b>حالة السوق:</b> انخفاض مؤشر الأمان أو مرحلة خطر
⚙️ <b>الإجراء المنفذ:</b> ${actionName}
🔢 <b>عدد الصفقات المتأثرة:</b> ${affectedCount} صفقة
⏱️ <b>التوقيت:</b> <code>${timeStr}</code>
━━━━━━━━━━━━━━━━━━
🛡️ <i>نظام حماية المحفظة التلقائي</i>
`.trim();

  await sendTelegramMessage(settings.telegramBotToken, settings.telegramChatId, text);
}
