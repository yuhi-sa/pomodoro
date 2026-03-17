'use client';

import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  validate?: (value: unknown) => boolean
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!validate || validate(parsed)) {
          setValue(parsed);
        }
      }
    } catch (e) {
      console.warn(`Failed to load ${key}:`, (e as Error).message);
    }
    setIsInitialized(true);
  }, [key, validate]);

  // Save to localStorage whenever value changes (after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Failed to save ${key}:`, (e as Error).message);
    }
  }, [key, value, isInitialized]);

  const setValueWrapped = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue(newValue);
    },
    []
  );

  return [value, setValueWrapped];
}

// Validation functions
export function validateSettings(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.sound !== 'boolean' || typeof obj.autoTransition !== 'boolean') return false;
  // notification is optional for backward compatibility
  if ('notification' in obj && typeof obj.notification !== 'boolean') return false;
  return true;
}

export function validateHistory(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.sessions);
}
