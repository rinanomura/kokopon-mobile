import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TrainingMode,
  VoiceType,
  STORAGE_KEYS,
  DEFAULT_TRAINING_MODE,
  DEFAULT_VOICE,
} from '@/hooks/usePreferences';

// Context の型定義
type PreferencesContextType = {
  // トレーニングモード
  trainingMode: TrainingMode;
  setTrainingMode: (mode: TrainingMode) => Promise<void>;
  // 音声ガイドの話者
  voice: VoiceType;
  setVoice: (voice: VoiceType) => Promise<void>;
  // 読み込み完了フラグ
  isLoaded: boolean;
};

// Context 作成
export const PreferencesContext = createContext<PreferencesContextType | null>(null);

type Props = {
  children: ReactNode;
};

/**
 * 設定をアプリ全体に提供する Provider
 * AsyncStorage による永続化を行う
 */
export function PreferencesProvider({ children }: Props) {
  const [trainingMode, setTrainingModeState] = useState<TrainingMode>(DEFAULT_TRAINING_MODE);
  const [voice, setVoiceState] = useState<VoiceType>(DEFAULT_VOICE);
  const [isLoaded, setIsLoaded] = useState(false);

  // 初期化: AsyncStorage から読み込み
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [storedMode, storedVoice] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRAINING_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.VOICE),
        ]);

        if (storedMode === 'intuitive' || storedMode === 'verbal') {
          setTrainingModeState(storedMode);
        }
        if (storedVoice === 'rina' || storedVoice === 'rinawan') {
          setVoiceState(storedVoice);
        }
      } catch (error) {
        console.log('設定読み込みエラー:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadPreferences();
  }, []);

  // トレーニングモード変更
  const setTrainingMode = useCallback(async (newMode: TrainingMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TRAINING_MODE, newMode);
      setTrainingModeState(newMode);
    } catch (error) {
      console.log('トレーニングモード保存エラー:', error);
    }
  }, []);

  // 音声ガイド話者変更
  const setVoice = useCallback(async (newVoice: VoiceType) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VOICE, newVoice);
      setVoiceState(newVoice);
    } catch (error) {
      console.log('音声設定保存エラー:', error);
    }
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        trainingMode,
        setTrainingMode,
        voice,
        setVoice,
        isLoaded,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
