import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_TOTAL = '@footprints_total';
const STORAGE_KEY_STARTED = '@footprints_started_at';
const STORAGE_KEY_MONTH_COUNTS = '@footprints_month_counts';

type MonthCounts = Record<string, number>; // "2025-01": 5, "2025-02": 3, ...

function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function useFootprints() {
  const [totalCount, setTotalCount] = useState<number>(0);
  const [startedAtISO, setStartedAtISO] = useState<string | undefined>(undefined);
  const [monthCount, setMonthCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 初期読み込み
  useEffect(() => {
    (async () => {
      try {
        const [totalStr, startedStr, monthCountsStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_TOTAL),
          AsyncStorage.getItem(STORAGE_KEY_STARTED),
          AsyncStorage.getItem(STORAGE_KEY_MONTH_COUNTS),
        ]);

        const total = totalStr ? parseInt(totalStr, 10) : 0;
        setTotalCount(isNaN(total) ? 0 : total);

        if (startedStr) {
          setStartedAtISO(startedStr);
        }

        if (monthCountsStr) {
          const monthCounts: MonthCounts = JSON.parse(monthCountsStr);
          const currentKey = getCurrentMonthKey();
          setMonthCount(monthCounts[currentKey] ?? 0);
        }
      } catch (e) {
        console.error('useFootprints: failed to load', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 足あとを1つ追加
  const addFootprint = useCallback(async () => {
    try {
      // 1) totalCount を +1
      const newTotal = totalCount + 1;
      await AsyncStorage.setItem(STORAGE_KEY_TOTAL, String(newTotal));
      setTotalCount(newTotal);

      // 2) 初回なら startedAt を記録
      if (!startedAtISO) {
        const now = new Date().toISOString();
        await AsyncStorage.setItem(STORAGE_KEY_STARTED, now);
        setStartedAtISO(now);
      }

      // 3) 今月のカウントを +1
      const currentKey = getCurrentMonthKey();
      const monthCountsStr = await AsyncStorage.getItem(STORAGE_KEY_MONTH_COUNTS);
      const monthCounts: MonthCounts = monthCountsStr ? JSON.parse(monthCountsStr) : {};
      const newMonthCount = (monthCounts[currentKey] ?? 0) + 1;
      monthCounts[currentKey] = newMonthCount;
      await AsyncStorage.setItem(STORAGE_KEY_MONTH_COUNTS, JSON.stringify(monthCounts));
      setMonthCount(newMonthCount);
    } catch (e) {
      console.error('useFootprints: failed to add', e);
    }
  }, [totalCount, startedAtISO]);

  return {
    totalCount,
    startedAtISO,
    monthCount,
    addFootprint,
    isLoading,
  };
}
