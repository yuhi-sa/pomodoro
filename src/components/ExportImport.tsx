'use client';

import { useRef } from 'react';
import type { Session, History } from '../lib/types';
import { getDateString } from '../lib/analytics';

interface ExportImportProps {
  history: History;
  setHistory: (value: History | ((prev: History) => History)) => void;
}

export default function ExportImport({ history, setHistory }: ExportImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportHistory = () => {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pomodoro-history-${getDateString(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importHistory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (!imported || !Array.isArray(imported.sessions)) {
          alert('無効なデータ形式です。');
          return;
        }

        const existingTimestamps = new Set(
          history.sessions.map((s) => s.timestamp)
        );

        let addedCount = 0;
        let skippedCount = 0;
        const newSessions: Session[] = [];

        for (const session of imported.sessions) {
          if (!session.timestamp || !session.duration || !session.date) {
            skippedCount++;
            continue;
          }
          if (!existingTimestamps.has(session.timestamp)) {
            newSessions.push(session);
            existingTimestamps.add(session.timestamp);
            addedCount++;
          }
        }

        if (newSessions.length > 0) {
          setHistory((prev: History) => ({
            sessions: [...prev.sessions, ...newSessions],
          }));
        }

        const msg =
          `${addedCount}件のセッションをインポートしました。` +
          (skippedCount > 0
            ? `\n${skippedCount}件は不正なデータのためスキップしました。`
            : '');
        alert(msg);
      } catch (err) {
        alert('JSONの解析に失敗しました: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
  };

  return (
    <div className="flex gap-3 justify-center mt-5">
      <button
        className="px-4 py-2 text-[13px] bg-[#1a1a2e] text-[#e8e8ec] border border-white/10 rounded-xl font-semibold cursor-pointer hover:bg-[#222240] active:scale-[0.96] transition-all duration-200"
        onClick={exportHistory}
        aria-label="セッション履歴をJSONでエクスポート"
      >
        エクスポート
      </button>
      <button
        className="px-4 py-2 text-[13px] bg-[#1a1a2e] text-[#e8e8ec] border border-white/10 rounded-xl font-semibold cursor-pointer hover:bg-[#222240] active:scale-[0.96] transition-all duration-200"
        onClick={() => fileInputRef.current?.click()}
        aria-label="セッション履歴をJSONからインポート"
      >
        インポート
      </button>
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        className="sr-only"
        onChange={importHistory}
      />
    </div>
  );
}
