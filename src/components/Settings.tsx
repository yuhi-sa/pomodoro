'use client';

import type { Settings as SettingsType, History } from '../lib/types';

interface SettingsProps {
  settings: SettingsType;
  setSettings: (value: SettingsType | ((prev: SettingsType) => SettingsType)) => void;
  setHistory: (value: History | ((prev: History) => History)) => void;
}

export default function Settings({ settings, setSettings, setHistory }: SettingsProps) {
  const handleResetHistory = () => {
    if (confirm('すべての作業履歴を削除しますか？')) {
      setHistory({ sessions: [] });
    }
  };

  return (
    <div className="flex flex-col flex-1 animate-fadeIn">
      <h2 className="text-xl font-semibold mb-5">設定</h2>

      <div className="bg-[#1a1a2e] rounded-xl py-1 mb-4">
        {/* Sound Toggle */}
        <div className="flex justify-between items-center px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium">通知音</span>
            <span className="text-xs text-[#9898a8]">アイドリング完了時に音を鳴らす</span>
          </div>
          <label className="relative w-12 h-7 shrink-0">
            <input
              type="checkbox"
              className="opacity-0 w-0 h-0 peer"
              checked={settings.sound}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, sound: e.target.checked }))
              }
            />
            <span className="absolute cursor-pointer inset-0 bg-[#444] rounded-[28px] transition-all duration-300 peer-checked:bg-[#6366f1] before:content-[''] before:absolute before:h-[22px] before:w-[22px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-all before:duration-300 peer-checked:before:translate-x-5" />
          </label>
        </div>

        {/* Auto Transition Toggle */}
        <div className="flex justify-between items-center px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium">自動移行</span>
            <span className="text-xs text-[#9898a8]">
              アイドリング後に自動で作業に移行する
            </span>
          </div>
          <label className="relative w-12 h-7 shrink-0">
            <input
              type="checkbox"
              className="opacity-0 w-0 h-0 peer"
              checked={settings.autoTransition}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  autoTransition: e.target.checked,
                }))
              }
            />
            <span className="absolute cursor-pointer inset-0 bg-[#444] rounded-[28px] transition-all duration-300 peer-checked:bg-[#6366f1] before:content-[''] before:absolute before:h-[22px] before:w-[22px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-all before:duration-300 peer-checked:before:translate-x-5" />
          </label>
        </div>
      </div>

      <div className="bg-[#1a1a2e] rounded-xl py-1 mb-4">
        <h3 className="text-sm font-semibold px-4 pt-3 pb-1 text-[#9898a8]">データ管理</h3>
        <div className="flex justify-between items-center px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium">作業履歴をリセット</span>
            <span className="text-xs text-[#9898a8]">すべての作業履歴を削除します</span>
          </div>
          <button
            className="px-4 py-2 text-[13px] bg-transparent text-[#dc2626] border border-[#dc2626] rounded-xl font-semibold cursor-pointer hover:bg-[rgba(220,38,38,0.1)] active:scale-[0.96] transition-all duration-200"
            onClick={handleResetHistory}
          >
            リセット
          </button>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-[13px] text-[#9898a8] leading-[1.8]">
          ポモドーロタイマー
          <br />
          「動き出し」をサポートする1分間のアイドリングで、
          <br />
          作業のハードルを下げます。
        </p>
      </div>
    </div>
  );
}
