'use client';

import { useState } from 'react';
import type { Settings as SettingsType, History } from '../lib/types';
import { useLocalStorage, validateSettings, validateHistory } from '../hooks/useLocalStorage';
import Timer from '../components/Timer';
import Dashboard from '../components/Dashboard';
import SettingsPanel from '../components/Settings';
import ExportImport from '../components/ExportImport';

type ViewName = 'timer' | 'dashboard' | 'settings';

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewName>('timer');
  const [settings, setSettings] = useLocalStorage<SettingsType>(
    'pomodoro-settings',
    { sound: true, autoTransition: true, notification: false },
    validateSettings
  );
  const [history, setHistory] = useLocalStorage<History>(
    'pomodoro-history',
    { sessions: [] },
    validateHistory
  );

  return (
    <>
      <div className="max-w-[480px] mx-auto px-4 pb-8 min-h-screen flex flex-col">
        <h1 className="sr-only">ポモドーロタイマー - 無料の集中タイマー</h1>

        {/* Navigation */}
        <nav className="flex gap-1 py-3 border-b border-white/[0.06] mb-6 sticky top-0 bg-[#0f0f1a] z-10">
          {[
            { view: 'timer' as const, label: 'タイマー' },
            { view: 'dashboard' as const, label: 'ダッシュボード' },
            { view: 'settings' as const, label: '設定' },
          ].map(({ view, label }) => (
            <button
              key={view}
              className={`flex-1 py-2.5 px-3 border-none text-sm font-medium rounded-lg cursor-pointer transition-all duration-300 ${
                currentView === view
                  ? 'bg-[#1a1a2e] text-[#e8e8ec]'
                  : 'bg-transparent text-[#9898a8] hover:bg-white/5 hover:text-[#e8e8ec]'
              }`}
              onClick={() => setCurrentView(view)}
              aria-label={`${label}画面`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Views */}
        {currentView === 'timer' && (
          <Timer settings={settings} history={history} setHistory={setHistory} />
        )}
        {currentView === 'dashboard' && (
          <>
            <Dashboard sessions={history.sessions} />
            <ExportImport history={history} setHistory={setHistory} />
          </>
        )}
        {currentView === 'settings' && (
          <SettingsPanel
            settings={settings}
            setSettings={setSettings}
            setHistory={setHistory}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-5 mt-10 border-t border-[#e0e0e0] text-[#666] text-sm">
        <p>
          <a href="https://yuhi-sa.github.io/" className="hover:underline">Blog</a>
          {' | '}
          <a href="https://yuhi-sa.github.io/devtoolbox/" className="hover:underline">DevToolBox</a>
          {' | '}
          <a href="https://yuhi-sa.github.io/calcbox/" className="hover:underline">CalcBox</a>
          {' | '}
          <a href="https://yuhi-sa.github.io/pomodoro/" className="hover:underline">Pomodoro</a>
          {' | '}
          <a href="https://github.com/yuhi-sa" className="hover:underline">GitHub</a>
        </p>
      </footer>
    </>
  );
}
