import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type TimeOption = {
  minutes: number;
  label: string;
};

type ModeOption = {
  id: 'timer' | 'ambient' | 'guided';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

const TIME_OPTIONS: TimeOption[] = [
  { minutes: 1, label: '1分' },
  { minutes: 5, label: '5分' },
  { minutes: 10, label: '10分' },
];

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'timer',
    label: 'タイマーのみ',
    icon: 'timer-outline',
    description: 'シンプルに',
  },
  {
    id: 'ambient',
    label: '環境音',
    icon: 'leaf-outline',
    description: '心地よい音と',
  },
  {
    id: 'guided',
    label: '瞑想ガイド',
    icon: 'headset-outline',
    description: '音声に沿って',
  },
];

/**
 * TimeSelectScreen - トレーニング時間・モード選択画面
 *
 * ユーザーはトレーニング時間（1/5/10分）とモード（タイマー/環境音/瞑想ガイド）を選択し、
 * タイマー画面へ進みます。
 */
export default function TimeSelectScreen() {
  const params = useLocalSearchParams<{
    bodyValue: string;
    mindValue: string;
    reactivityValue: string;
  }>();

  const [selectedTime, setSelectedTime] = useState<number>(5);
  const [selectedMode, setSelectedMode] = useState<'timer' | 'ambient' | 'guided'>('timer');

  const handleStart = useCallback(() => {
    router.push({
      pathname: '/timer',
      params: {
        bodyValue: params.bodyValue,
        mindValue: params.mindValue,
        reactivityValue: params.reactivityValue,
        duration: selectedTime.toString(),
        mode: selectedMode,
      },
    });
  }, [params, selectedTime, selectedMode]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 時間選択 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>時間を選んでね</Text>
            <View style={styles.timeSelector}>
              {TIME_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.minutes}
                  style={[
                    styles.timeButton,
                    selectedTime === option.minutes && styles.timeButtonSelected,
                  ]}
                  onPress={() => setSelectedTime(option.minutes)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.timeButtonText,
                    selectedTime === option.minutes && styles.timeButtonTextSelected,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* モード選択 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>モードを選んでね</Text>
            <View style={styles.modeSelector}>
              {MODE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.modeButton,
                    selectedMode === option.id && styles.modeButtonSelected,
                  ]}
                  onPress={() => setSelectedMode(option.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={option.icon}
                    size={28}
                    color={selectedMode === option.id ? '#FF85A2' : '#718096'}
                  />
                  <Text style={[
                    styles.modeButtonTitle,
                    selectedMode === option.id && styles.modeButtonTitleSelected,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.modeButtonDesc}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* りなわん */}
          <View style={styles.mascotSection}>
            <Image
              source={require('@/assets/images/rinawan_tilting_head.gif')}
              style={styles.mascotImage}
              resizeMode="contain"
            />
          </View>
        </ScrollView>

        {/* スタートボタン */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleStart}
            activeOpacity={0.8}
            style={styles.startButtonWrapper}
          >
            <LinearGradient
              colors={['#FF85A2', '#FFB6C1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.startButton}
            >
              <Text style={styles.startButtonText}>スタート</Text>
            </LinearGradient>
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },

  // セクション
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 16,
  },

  // 時間選択
  timeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  timeButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  timeButtonSelected: {
    backgroundColor: 'rgba(255, 133, 162, 0.15)',
    borderColor: '#FF85A2',
  },
  timeButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#718096',
  },
  timeButtonTextSelected: {
    color: '#FF85A2',
  },

  // モード選択
  modeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  modeButtonSelected: {
    backgroundColor: 'rgba(255, 133, 162, 0.15)',
    borderColor: '#FF85A2',
  },
  modeButtonTitle: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  modeButtonTitleSelected: {
    color: '#FF85A2',
  },
  modeButtonDesc: {
    fontSize: 11,
    color: '#A0AEC0',
    textAlign: 'center',
  },

  // りなわん
  mascotSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  mascotImage: {
    width: 100,
    height: 100,
  },

  // フッター
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: 'center',
  },
  startButtonWrapper: {
    borderRadius: 25,
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  startButton: {
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
