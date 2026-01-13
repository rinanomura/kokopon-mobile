import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// トレーニングモードの型定義
export type TrainingMode = 'intuitive' | 'verbal';

const STORAGE_KEY = 'training_mode';
const DEFAULT_MODE: TrainingMode = 'intuitive';

/**
 * トレーニングモードを管理するフック
 * AsyncStorageに永続化し、アプリ全体で共有
 */
export function useTrainingMode() {
  const [mode, setModeState] = useState<TrainingMode>(DEFAULT_MODE);
  const [isLoading, setIsLoading] = useState(true);

  // 初期化: AsyncStorageから読み込み
  useEffect(() => {
    const loadMode = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'intuitive' || stored === 'verbal') {
          setModeState(stored);
        }
      } catch (error) {
        console.log('トレーニングモード読み込みエラー:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadMode();
  }, []);

  // モード変更: AsyncStorageに保存
  const setMode = useCallback(async (newMode: TrainingMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newMode);
      setModeState(newMode);
    } catch (error) {
      console.log('トレーニングモード保存エラー:', error);
    }
  }, []);

  return { mode, setMode, isLoading };
}
