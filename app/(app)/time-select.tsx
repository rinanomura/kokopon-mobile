import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePreferences } from '@/hooks/usePreferences';

type TimeOption = {
  minutes: number;
  label: string;
  description: string;
};

const TIME_OPTIONS: TimeOption[] = [
  { minutes: 0.5, label: '30秒', description: 'さくっと一息' },
  { minutes: 5, label: '5分', description: 'ゆったり整える' },
  { minutes: 10, label: '10分', description: 'じっくり向き合う' },
];

/**
 * TimeSelectScreen - トレーニング時間選択画面
 *
 * ユーザーはトレーニング時間（1/5/10分）を選択し、
 * タイマー画面へ進みます。
 */
export default function TimeSelectScreen() {
  const params = useLocalSearchParams<{
    beforeBody: string;
    beforeMind: string;
    memo: string;
  }>();
  const { guideMode, ambientSound } = usePreferences();

  const handleSelectTime = useCallback((minutes: number) => {
    router.push({
      pathname: '/timer',
      params: {
        beforeBody: params.beforeBody,
        beforeMind: params.beforeMind,
        memo: params.memo ?? '',
        duration: minutes.toString(),
      },
    });
  }, [params]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  // ガイドモードに応じたアイコンとタイトル
  const getModeInfo = () => {
    switch (guideMode) {
      case 'ambient':
        return {
          icon: 'leaf-outline' as const,
          title: '環境音モード',
          subtitle: getAmbientSoundLabel(ambientSound),
        };
      case 'timer':
      default:
        return {
          icon: 'timer-outline' as const,
          title: 'タイマーモード',
          subtitle: 'シンプルに時間を測る',
        };
    }
  };

  const getAmbientSoundLabel = (sound: string): string => {
    switch (sound) {
      case 'forest': return '森の音とともに';
      case 'wave': return '波の音とともに';
      case 'rain': return '雨の音とともに';
      default: return '';
    }
  };

  const modeInfo = getModeInfo();

  return (
    <LinearGradient
      colors={['#7AD7F0', '#CDECF6']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#4A5568" />
          </TouchableOpacity>
        </View>

        {/* モード表示 */}
        <View style={styles.modeSection}>
          <View style={styles.modeIconContainer}>
            <Ionicons name={modeInfo.icon} size={32} color="#FF85A2" />
          </View>
          <Text style={styles.modeTitle}>{modeInfo.title}</Text>
          <Text style={styles.modeSubtitle}>{modeInfo.subtitle}</Text>
        </View>

        {/* タイトル */}
        <Text style={styles.title}>時間を選んでね！</Text>

        {/* 時間選択カード */}
        <View style={styles.cardsContainer}>
          {TIME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.minutes}
              style={styles.card}
              onPress={() => handleSelectTime(option.minutes)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FFFFFF', '#FFF5F7']}
                style={styles.cardGradient}
              >
                <Text style={styles.cardTime}>{option.label}</Text>
                <Text style={styles.cardDescription}>{option.description}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* りなわん */}
        <View style={styles.mascotSection}>
          <Image
            source={require('@/assets/images/rinawan_tilting_head.gif')}
            style={styles.mascotImage}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    height: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // モード表示
  modeSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  modeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 133, 162, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 4,
  },
  modeSubtitle: {
    fontSize: 14,
    color: '#718096',
  },

  // タイトル
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 24,
  },

  // カード
  cardsContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  card: {
    borderRadius: 20,
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  cardGradient: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 182, 193, 0.4)',
  },
  cardTime: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FF85A2',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#718096',
  },

  // りなわん
  mascotSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  mascotImage: {
    width: 100,
    height: 100,
  },
});
