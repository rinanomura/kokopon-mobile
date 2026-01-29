import { useContext } from 'react';
import { PreferencesContext } from '@/components/PreferencesProvider';

// 型定義
export type TrainingMode = 'intuitive' | 'verbal';
export type VoiceType = 'rina' | 'rinawan';
export type GuideMode = 'timer' | 'ambient' | 'guided';
export type AmbientSound = 'birds' | 'river' | 'rain' | 'wave' | 'bonfire' | 'space';

// ストレージキー
export const STORAGE_KEYS = {
  TRAINING_MODE: 'pref_training_mode',
  VOICE: 'pref_voice',
  GUIDE_MODE: 'pref_guide_mode',
  AMBIENT_SOUND: 'pref_ambient_sound',
} as const;

// デフォルト値
export const DEFAULT_TRAINING_MODE: TrainingMode = 'intuitive';
export const DEFAULT_VOICE: VoiceType = 'rina';
export const DEFAULT_GUIDE_MODE: GuideMode = 'timer';
export const DEFAULT_AMBIENT_SOUND: AmbientSound = 'birds';

/**
 * 設定を参照・更新するフック
 * PreferencesProvider 配下で使用すること
 */
export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}
