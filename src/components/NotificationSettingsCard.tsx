import React from 'react';
import { Bell, Send, Settings2, Smartphone, CheckCircle2, AlertCircle, Mail, Layers } from 'lucide-react';
import { NotificationSettings } from '../types';

interface NotificationSettingsCardProps {
  notifications?: NotificationSettings;
  onOpenModal: () => void;
  onTest: () => void;
  testing?: boolean;
}

export const NotificationSettingsCard: React.FC<NotificationSettingsCardProps> = ({
  notifications,
  onOpenModal,
  onTest,
  testing = false,
}) => {
  const channel = notifications?.channel || 'all';
  const hasTg = Boolean(notifications?.telegramBotToken && notifications?.telegramChatId);
  const hasEmail = Boolean(notifications?.emailAddress && notifications?.emailAddress.includes('@'));

  const isConfigured = Boolean(
    notifications?.enabled &&
      ((channel === 'telegram' && hasTg) ||
        (channel === 'email' && hasEmail) ||
        (channel === 'all' && (hasTg || hasEmail)))
  );

  const getChannelBadge = () => {
    if (!notifications?.enabled) {
      return (
        <span className="text-[10px] bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-full font-bold">
          معطلة حالياً
        </span>
      );
    }
    if (channel === 'telegram') {
      return (
        <span className="text-[10px] bg-blue-500/10 text-brand-blue border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
          <Smartphone className="w-3 h-3 text-brand-blue" />
          التلجرام فقط
        </span>
      );
    }
    if (channel === 'email') {
      return (
        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
          <Mail className="w-3 h-3 text-amber-400" />
          البريد الإلكتروني فقط
        </span>
      );
    }
    return (
      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
        <Layers className="w-3 h-3 text-emerald-400" />
        التلجرام + الإيميل معاً ⚡
      </span>
    );
  };

  return (
    <div className="bg-gradient-to-r from-[#0d1424] via-gray-900 to-[#0e172a] rounded-xl border border-gray-800 p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
            isConfigured
              ? 'bg-blue-500/10 text-brand-blue border border-blue-500/30'
              : 'bg-gray-800 text-gray-400 border border-gray-700'
          }`}
        >
          {channel === 'email' ? (
            <Mail className="w-5 h-5 text-amber-400" />
          ) : channel === 'all' ? (
            <Layers className="w-5 h-5 text-emerald-400" />
          ) : (
            <Smartphone className="w-5 h-5 text-brand-blue" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              تنبيهات الصفقات اللحظية
            </h3>
            {getChannelBadge()}
            {isConfigured ? (
              <span className="text-[10px] bg-emerald-500/10 text-brand-green border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-brand-green" />
                متصل وجاهز للإرسال
              </span>
            ) : (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                بانتظار إدخال بياناتك
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {isConfigured
              ? channel === 'email'
                ? `تصلك رسائل الصفقات والأرباح مباشرة إلى بريدك (${notifications?.emailAddress}).`
                : channel === 'telegram'
                ? 'تصلك رسائل الصفقات والأرباح فوراً إلى حساب التلجرام الخاص بك.'
                : `تصلك رسائل الصفقات والأرباح على التلجرام والبريد معاً.`
              : 'يمكنك الاعتماد على البريد فقط أو التلجرام فقط أو الاثنين معاً لاستلام التنبيهات فوراً.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isConfigured && (
          <button
            onClick={onTest}
            disabled={testing}
            className="text-[11px] font-bold px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="إرسال رسالة تجريبية"
          >
            <Send className={`w-3 h-3 ${testing ? 'animate-bounce text-brand-blue' : ''}`} />
            {testing ? 'جاري الإرسال...' : 'تجربة الإرسال'}
          </button>
        )}
        <button
          onClick={onOpenModal}
          className="text-[11px] font-bold px-4 py-2 rounded-lg bg-brand-blue hover:bg-blue-600 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <Settings2 className="w-3.5 h-3.5" />
          {isConfigured ? 'تعديل وسيلة التنبيه' : 'إعداد التنبيهات ⚡'}
        </button>
      </div>
    </div>
  );
};
