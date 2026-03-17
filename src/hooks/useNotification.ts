'use client';

import { useCallback, useRef } from 'react';

/**
 * Hook for sending browser notifications when timer phases complete.
 */
export function useNotification(enabled: boolean) {
  const permissionRef = useRef<NotificationPermission>('default');

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted';
      return;
    }
    if (Notification.permission === 'denied') {
      permissionRef.current = 'denied';
      return;
    }
    const result = await Notification.requestPermission();
    permissionRef.current = result;
  }, []);

  const notify = useCallback(
    (title: string, body?: string) => {
      if (!enabled) return;
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      try {
        new Notification(title, {
          body,
          icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍅</text></svg>",
          tag: 'pomodoro-timer',
        });
      } catch (e) {
        console.warn('Notification failed:', (e as Error).message);
      }
    },
    [enabled]
  );

  return { requestPermission, notify };
}
