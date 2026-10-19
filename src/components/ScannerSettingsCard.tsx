import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { ScannerSettings } from '../types';

interface ScannerSettingsCardProps {
  initialSettings: ScannerSettings;
  onSave: (settings: ScannerSettings) => Promise<boolean>;
}

export const ScannerSettingsCard: React.FC<ScannerSettingsCardProps> = ({
  initialSettings,
  onSave,
}) => {
  const [formData, setFormData] = useState<ScannerSettings>(initialSettings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const [slInput, setSlInput] = useState(() => (initialSettings.sl_perc * 100).toString());
  const [minTpInput, setMinTpInput] = useState(() => (initialSettings.min_tp * 100).toString());
  const [trailDistInput, setTrailDistInput] = useState(() => (initialSettings.trail_dist * 100).toString());
  const [volMultInput, setVolMultInput] = useState(() => initialSettings.vol_mult.toString());
  const [cooldownInput, setCooldownInput] = useState(() => initialSettings.cooldown_mins.toString());

  useEffect(() => {
    setFormData(initialSettings);
    setSlInput((initialSettings.sl_perc * 100).toString());
    setMinTpInput((initialSettings.min_tp * 100).toString());
    setTrailDistInput((initialSettings.trail_dist * 100).toString());
    setVolMultInput(initialSettings.vol_mult.toString());
    setCooldownInput(initialSettings.cooldown_mins.toString());
  }, [initialSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveStatus === 'saving') return;

    setSaveStatus('saving');
    const toSave: ScannerSettings = {
      ...formData,
      sl_perc: (parseFloat(slInput) || 0) / 100,
      min_tp: (parseFloat(minTpInput) || 0) / 100,
      trail_dist: (parseFloat(trailDistInput) || 0) / 100,
      vol_mult: parseFloat(volMultInput) || 0,
      cooldown_mins: parseInt(cooldownInput, 10) || 0,
    };

    const success = await onSave(toSave);
    if (success) {
      setSaveStatus('success');
    } else {
      setSaveStatus('error');
    }

    setTimeout(() => {
      setSaveStatus('idle');
    }, 2500);
  };

  return (
    <section className="bg-gray-900 rounded-xl border border-gray-800 p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800 justify-between flex-wrap">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-brand-gold" />
          <h2 className="text-sm font-bold text-white">
            إعدادات الرادار و الاستراتيجيات (الهدف %10-%5+)
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4 pb-4 border-b border-gray-800">
          <div className="input-group flex items-center bg-gray-950 p-2 rounded-lg border border-gray-800">
            <label htmlFor="strat-momentum" className="!mb-0 cursor-pointer flex-1 text-white font-bold text-xs">
              الزخم (Momentum) 🔵
            </label>
            <input
              type="checkbox"
              id="strat-momentum"
              checked={formData.strats.momentum}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  strats: { ...formData.strats, momentum: e.target.checked },
                })
              }
              className="accent-brand-blue w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="input-group flex items-center bg-gray-950 p-2 rounded-lg border border-gray-800">
            <label htmlFor="strat-breakout" className="!mb-0 cursor-pointer flex-1 text-white font-bold text-xs">
              الاختراق (Breakout) 🟢
            </label>
            <input
              type="checkbox"
              id="strat-breakout"
              checked={formData.strats.breakout}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  strats: { ...formData.strats, breakout: e.target.checked },
                })
              }
              className="accent-brand-green w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="input-group flex items-center bg-gray-950 p-2 rounded-lg border border-gray-800">
            <label htmlFor="strat-sniper" className="!mb-0 cursor-pointer flex-1 text-white font-bold text-xs">
              القناص (Sniper) 🟣
            </label>
            <input
              type="checkbox"
              id="strat-sniper"
              checked={formData.strats.sniper}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  strats: { ...formData.strats, sniper: e.target.checked },
                })
              }
              className="accent-purple-500 w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="input-group flex items-center bg-gray-950 p-2 rounded-lg border border-gray-800">
            <label htmlFor="strat-bbrsi" className="!mb-0 cursor-pointer flex-1 text-white font-bold text-xs">
              سكالبينج BB & RSI 🟠
            </label>
            <input
              type="checkbox"
              id="strat-bbrsi"
              checked={!!formData.strats.bbrsi}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  strats: { ...formData.strats, bbrsi: e.target.checked },
                })
              }
              className="accent-orange-500 w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="input-group flex items-center bg-gray-950 p-2 rounded-lg border border-yellow-500/30">
            <label htmlFor="strat-turboscalp" className="!mb-0 cursor-pointer flex-1 text-white font-bold text-xs flex flex-col justify-center">
              <span className="flex items-center gap-1 text-brand-gold">
                السكالبينج الخاطف ⚡
              </span>
              <span className="text-[9px] text-gray-400">
                أهداف +4% (1m/5m/15m)
              </span>
            </label>
            <input
              type="checkbox"
              id="strat-turboscalp"
              checked={formData.strats.turboScalp !== false}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  strats: { ...formData.strats, turboScalp: e.target.checked },
                })
              }
              className="accent-yellow-500 w-4 h-4 cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="input-group">
            <label>الإطار الزمني الأساسي</label>
            <select
              value={formData.tf}
              onChange={(e) => setFormData({ ...formData, tf: e.target.value })}
            >
              <option value="1m">1 دقيقة (سكالبينج سريع)</option>
              <option value="5m">5 دقائق (خطف سريع)</option>
              <option value="15m">15 دقيقة (أساسي)</option>
              <option value="1h">1 ساعة (أهداف أبعد)</option>
              <option value="4h">4 ساعات (استثمار)</option>
            </select>
          </div>

          <div className="input-group">
            <label>وقف الخسارة الأولي (%)</label>
            <input
              type="number"
              step="0.1"
              value={slInput}
              onChange={(e) => setSlInput(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>هدف تفعيل الملاحقة (%)</label>
            <input
              type="number"
              step="0.1"
              value={minTpInput}
              onChange={(e) => setMinTpInput(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>مسافة الملاحقة (%)</label>
            <input
              type="number"
              step="0.1"
              value={trailDistInput}
              onChange={(e) => setTrailDistInput(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>مضاعف السيولة (Volume)</label>
            <input
              type="number"
              step="0.1"
              value={volMultInput}
              onChange={(e) => setVolMultInput(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>فترة التبريد (دقائق)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={cooldownInput}
              onChange={(e) => setCooldownInput(e.target.value)}
            />
          </div>

          <div className="col-span-full mt-2 flex justify-end">
            <button
              type="submit"
              disabled={saveStatus === 'saving'}
              className={`text-xs font-bold py-2 px-8 rounded-lg transition-colors shadow-md w-full sm:w-auto cursor-pointer ${
                saveStatus === 'saving'
                  ? 'bg-gray-600 text-white cursor-not-allowed'
                  : saveStatus === 'success'
                  ? 'bg-brand-green text-white'
                  : saveStatus === 'error'
                  ? 'bg-brand-red text-white'
                  : 'bg-brand-blue hover:bg-blue-600 text-white'
              }`}
            >
              {saveStatus === 'saving'
                ? 'جاري الحفظ الفعلي...'
                : saveStatus === 'success'
                ? 'تم الحفظ بنجاح 100% ✓'
                : saveStatus === 'error'
                ? 'خطأ في الحفظ'
                : 'حفظ الإعدادات وإرسالها للسيرفر'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
