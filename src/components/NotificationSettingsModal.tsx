import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { NotificationSettings } from '../types';
import { testTelegramConnection, defaultNotificationSettings } from '../utils/notificationService';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: NotificationSettings;
  onSave: (newSettings: NotificationSettings) => Promise<boolean>;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<NotificationSettings>(() => {
    return settings || defaultNotificationSettings;
  });

  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!formData.telegramBotToken || !formData.telegramChatId) {
      setTestResult({
        success: false,
        message: 'يرجى إدخال رمز البوت (Bot Token) ومعرف المحادثة (Chat ID) أولاً لإجراء الاختبار.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await testTelegramConnection(formData.telegramBotToken, formData.telegramChatId);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `حدث خطأ غير متوقع: ${e?.message || 'تعذر الاتصال'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const ok = await onSave(formData);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 1200);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111827] border border-gray-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative text-right">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#111827]/95 backdrop-blur-md px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-brand-blue">
              <Bell className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                مركز التنبيهات الفورية
                <span className="text-[10px] bg-brand-gold/10 text-brand-gold border border-brand-gold/30 px-2 py-0.5 rounded-full font-bold">
                  جديد ⚡
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">
                استلام إشعارات صيد وإغلاق الصفقات مباشرة على هاتفك
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Main Activation Switch */}
          <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  formData.enabled
                    ? 'bg-emerald-500/10 text-brand-green border border-emerald-500/30'
                    : 'bg-gray-900 text-gray-500 border border-gray-800'
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">تفعيل التنبيهات الخارجية</div>
                <div className="text-[10px] text-gray-400">
                  إرسال رسائل فورية لهاتفك عند فتح أو إغلاق الصفقات
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Telegram Settings Section (Recommended & Easiest) */}
          <div className="p-4 rounded-xl bg-[#0d1322] border border-blue-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse"></span>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  ربط التلجرام (Telegram)
                  <span className="text-[9px] bg-blue-500/20 text-brand-blue px-2 py-0.5 rounded font-mono font-bold">
                    الأسهل والأسرع ⚡
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-bold"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {showGuide ? 'إخفاء الشرح' : 'كيف أحصل على البيانات مجاناً؟'}
              </button>
            </div>

            {/* Step-by-step Guide Card */}
            {showGuide && (
              <div className="p-3.5 rounded-lg bg-gray-950 border border-blue-500/30 text-xs text-gray-300 space-y-2.5 animate-fadeIn">
                <div className="font-bold text-brand-blue flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-gold" />
                  خطوات الربط المجاني في دقيقة واحدة:
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-400 leading-relaxed pr-1">
                  <li>
                    افتح تطبيق التلجرام وابحث عن:{' '}
                    <strong className="text-white font-mono dir-ltr">@BotFather</strong> ثم أرسل له أمر{' '}
                    <code className="text-brand-gold bg-gray-900 px-1 py-0.5 rounded">/newbot</code>.
                  </li>
                  <li>
                    اختر اسماً للبوت، وسيعطيك مباشرة رمز التوكن:{' '}
                    <strong className="text-brand-blue font-mono dir-ltr">Bot Token</strong>. انسخه والصقه في الخانة أدناه.
                  </li>
                  <li>
                    افتح تلجرام وابحث عن:{' '}
                    <strong className="text-white font-mono dir-ltr">@userinfobot</strong> واضغط Start، سيعطيك رقم الـ{' '}
                    <strong className="text-brand-blue font-mono dir-ltr">Id</strong> الخاص بك.
                  </li>
                  <li>
                    افتح البوت الذي أنشأته واضغط{' '}
                    <strong className="text-brand-green font-mono dir-ltr">Start</strong> لتسمح له بمراسلتك.
                  </li>
                  <li>
                    الصق الرقمين واضغط على زر{' '}
                    <strong className="text-white">«إرسال رسالة تجريبية»</strong> للتأكد فوراً!
                  </li>
                </ol>
              </div>
            )}

            {/* Input 1: Bot Token */}
            <div>
              <label className="block text-[11px] font-bold text-gray-300 mb-1">
                رمز البوت (Telegram Bot Token):
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={formData.telegramBotToken}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, telegramBotToken: e.target.value }))
                  }
                  placeholder="مثال: 7891234567:AAFn_m4..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 dir-ltr text-left pl-9"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Input 2: Chat ID */}
            <div>
              <label className="block text-[11px] font-bold text-gray-300 mb-1">
                معرف المحادثة (Telegram Chat ID):
              </label>
              <input
                type="text"
                value={formData.telegramChatId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, telegramChatId: e.target.value }))
                }
                placeholder="مثال: 123456789 أو معرف القناة"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 dir-ltr text-left"
              />
            </div>

            {/* Test Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !formData.telegramBotToken || !formData.telegramChatId}
                className="w-full py-2 px-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-brand-blue border border-blue-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <Send className={`w-3.5 h-3.5 ${testing ? 'animate-bounce' : ''}`} />
                {testing ? 'جاري الإرسال والاختبار...' : '🧪 إرسال رسالة تجريبية لهاتفك الآن'}
              </button>
            </div>

            {/* Test Result Feedback */}
            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2.5 animate-fadeIn ${
                  testResult.success
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="leading-relaxed font-semibold">{testResult.message}</div>
              </div>
            )}
          </div>

          {/* Optional Email Section */}
          <div className="p-4 rounded-xl bg-gray-950/50 border border-gray-800 space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <label className="text-xs font-bold text-gray-300">
                البريد الإلكتروني للإشعارات (اختياري):
              </label>
            </div>
            <input
              type="email"
              value={formData.emailAddress || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, emailAddress: e.target.value }))
              }
              placeholder="user@gmail.com"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 dir-ltr text-left"
            />
            <p className="text-[10px] text-gray-500">
              يمكنك تركه فارغاً والاعتماد بالكامل على التلجرام، أو كتابة بريدك لتسجيله.
            </p>
          </div>

          {/* Trigger Checkboxes */}
          <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800 space-y-2.5">
            <div className="text-xs font-bold text-gray-300 mb-1">أنواع التنبيهات التي ترغب باستلامها:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-gray-900 border border-gray-800/80 cursor-pointer hover:bg-gray-800/60 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.notifyOnOpen}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notifyOnOpen: e.target.checked }))
                  }
                  className="rounded text-brand-blue focus:ring-0 cursor-pointer"
                />
                <span className="text-gray-200 text-[11px] font-bold">🟢 صيد/فتح صفقة جديدة</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-gray-900 border border-gray-800/80 cursor-pointer hover:bg-gray-800/60 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.notifyOnCloseWin}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notifyOnCloseWin: e.target.checked }))
                  }
                  className="rounded text-brand-green focus:ring-0 cursor-pointer"
                />
                <span className="text-gray-200 text-[11px] font-bold">🎯 إغلاق صفقة بربح (Target)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-gray-900 border border-gray-800/80 cursor-pointer hover:bg-gray-800/60 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.notifyOnCloseLoss}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notifyOnCloseLoss: e.target.checked }))
                  }
                  className="rounded text-brand-red focus:ring-0 cursor-pointer"
                />
                <span className="text-gray-200 text-[11px] font-bold">🛑 إغلاق صفقة بخسارة (Stop)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-gray-900 border border-gray-800/80 cursor-pointer hover:bg-gray-800/60 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.notifyOnEmergency}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notifyOnEmergency: e.target.checked }))
                  }
                  className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-gray-200 text-[11px] font-bold">🚨 تدخل طوارئ حماية السوق</span>
              </label>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-xs font-bold bg-brand-blue hover:bg-blue-600 text-white rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>جاري الحفظ...</>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  تم الحفظ بنجاح!
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  حفظ وتفعيل الإعدادات
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
