import { useState, useEffect } from 'react';
import type { ExtensionStorage } from '../types';

type StorageKey = keyof ExtensionStorage;

export const useStorage = <T extends StorageKey>(
  key: T,
  initialValue: ExtensionStorage[T]
): [ExtensionStorage[T], (value: ExtensionStorage[T]) => void, boolean] => {
  const [storedValue, setStoredValue] = useState<ExtensionStorage[T]>(initialValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(key, (result) => {
      const value = result[key];
      if (value !== undefined) {
        setStoredValue(value);
      }
      setLoading(false);
    });
  }, [key]);

  const setValue = (value: ExtensionStorage[T]) => {
    setStoredValue(value);
    chrome.storage.local.set({ [key]: value });
  };

  return [storedValue, setValue, loading];
};
