import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TrainingMode,
  VoiceType,
  GuideMode,
  AmbientSound,
  STORAGE_KEYS,
  DEFAULT_TRAINING_MODE,
  DEFAULT_VOICE,
  DEFAULT_GUIDE_MODE,
  DEFAULT_AMBIENT_SOUND,
} from '@/hooks/usePreferences';

// Context の型定義
type PreferencesContextType = {
  // トレーニングモード（直感/言語化）
  trainingMode: TrainingMode;
  setTrainingMode: (mode: TrainingMode) => Promise<void>;
  // 音声ガイドの話者
  voice: VoiceType;
  setVoice: (voice: VoiceType) => Promise<void>;
  // ガイドモード（タイマー/環境音/瞑想ガイド）
  guideMode: GuideMode;
  setGuideMode: (mode: GuideMode) => Promise<void>;
  // 環境音の種類
  ambientSound: AmbientSound;
  setAmbientSound: (sound: AmbientSound) => Promise<void>;
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
  const [guideMode, setGuideModeState] = useState<GuideMode>(DEFAULT_GUIDE_MODE);
  const [ambientSound, setAmbientSoundState] = useState<AmbientSound>(DEFAULT_AMBIENT_SOUND);
  const [isLoaded, setIsLoaded] = useState(false);

  // 初期化: AsyncStorage から読み込み
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [storedMode, storedVoice, storedGuideMode, storedAmbientSound] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRAINING_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.VOICE),
          AsyncStorage.getItem(STORAGE_KEYS.GUIDE_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.AMBIENT_SOUND),
        ]);

        if (storedMode === 'intuitive' || storedMode === 'verbal') {
          setTrainingModeState(storedMode);
        }
        if (storedVoice === 'rina' || storedVoice === 'rinawan') {
          setVoiceState(storedVoice);
        }
        if (storedGuideMode === 'timer' || storedGuideMode === 'ambient' || storedGuideMode === 'guided') {
          setGuideModeState(storedGuideMode);
        }
        if (storedAmbientSound === 'birds' || storedAmbientSound === 'river' || storedAmbientSound === 'rain' || storedAmbientSound === 'wave' || storedAmbientSound === 'bonfire' || storedAmbientSound === 'space') {
          setAmbientSoundState(storedAmbientSound);
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

  // ガイドモード変更
  const setGuideMode = useCallback(async (newMode: GuideMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GUIDE_MODE, newMode);
      setGuideModeState(newMode);
    } catch (error) {
      console.log('ガイドモード保存エラー:', error);
    }
  }, []);

  // 環境音変更
  const setAmbientSound = useCallback(async (newSound: AmbientSound) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AMBIENT_SOUND, newSound);
      setAmbientSoundState(newSound);
    } catch (error) {
      console.log('環境音設定保存エラー:', error);
    }
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        trainingMode,
        setTrainingMode,
        voice,
        setVoice,
        guideMode,
        setGuideMode,
        ambientSound,
        setAmbientSound,
        isLoaded,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
