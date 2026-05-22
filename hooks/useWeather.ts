import { useState, useEffect, useCallback } from 'react';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EnvironmentData, fetchEnvironmentData } from '@/lib/weather';

const CACHE_KEY = '@kokopon/environment_data';
const CACHE_TTL = 30 * 60 * 1000; // 30分キャッシュ

// ネイティブモジュールが利用可能かチェック
const isLocationAvailable = !!NativeModules.ExpoLocation;

interface CachedData {
  data: EnvironmentData;
  cachedAt: number;
}

interface UseWeatherResult {
  environment: EnvironmentData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// デフォルト座標（東京）
const DEFAULT_LAT = 35.6762;
const DEFAULT_LNG = 139.6503;

export function useWeather(): UseWeatherResult {
  const [environment, setEnvironment] = useState<EnvironmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    // キャッシュチェック
    if (!force) {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, cachedAt }: CachedData = JSON.parse(cached);
          if (Date.now() - cachedAt < CACHE_TTL) {
            setEnvironment(data);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    setLoading(true);
    setError(null);

    try {
      let latitude = DEFAULT_LAT;
      let longitude = DEFAULT_LNG;

      // expo-location が利用可能なら位置情報を取得
      if (isLocationAvailable) {
        try {
          const Location = require('expo-location');
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });
            latitude = location.coords.latitude;
            longitude = location.coords.longitude;
          }
        } catch (locErr) {
          console.log('Location unavailable, using default:', locErr);
        }
      }

      const data = await fetchEnvironmentData(latitude, longitude);
      setEnvironment(data);

      // キャッシュに保存
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        cachedAt: Date.now(),
      }));
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('環境データの取得に失敗しました');
      // フォールバック: 東京の気象データを試みる
      try {
        const data = await fetchEnvironmentData(DEFAULT_LAT, DEFAULT_LNG);
        setEnvironment(data);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { environment, loading, error, refresh };
}
