import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFootprints } from '@/hooks/useFootprints';
import { useThemeColors } from '@/hooks/useThemeColors';
import { usePreferences } from '@/hooks/usePreferences';

export default function HomeScreen() {
  const { addFootprint } = useFootprints();
  const colors = useThemeColors();
  const { breathTiming } = usePreferences();

  // 呼吸ドットアニメーション（シンプルモード用）
  const breathAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (colors.showMascot) return;

    breathAnim.setValue(0.1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: breathTiming.expandSec * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(breathTiming.holdTopSec * 1000),
        Animated.timing(breathAnim, {
          toValue: 0.1,
          duration: breathTiming.shrinkSec * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(breathTiming.holdBottomSec * 1000),
      ])
    ).start();

  }, [colors.showMascot, breathAnim, breathTiming]);

  const dotScale = breathAnim.interpolate({
    inputRange: [0.1, 1],
    outputRange: [0.1, 1],
    extrapolate: 'clamp',
  });
  const dotOpacity = 1;

  const handleProceed = useCallback(async () => {
    await addFootprint();
    router.push({ pathname: '/time-select' });
  }, [addFootprint]);

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.gradient}
    >
      <StatusBar barStyle={colors.statusBarStyle} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* 中央エリア */}
        <View style={styles.mascotArea}>
          {colors.showMascot ? (
            <Image
              source={require('@/assets/images/rinawan_sitting.gif')}
              style={styles.mascotImage}
              resizeMode="contain"
            />
          ) : (
            <Animated.View
              style={[
                styles.breathDot,
                {
                  transform: [{ scale: dotScale }],
                  opacity: dotOpacity,
                },
              ]}
            />
          )}
        </View>

        {/* トレーニングに進むボタン */}
        <View style={styles.buttonArea}>
          <TouchableOpacity
            onPress={handleProceed}
            activeOpacity={0.8}
            style={[styles.proceedButtonWrapper, { shadowColor: colors.buttonShadow }]}
          >
            <LinearGradient
              colors={[colors.buttonGradientStart, colors.buttonGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proceedButton}
            >
              <Text style={styles.proceedButtonText}>
                トレーニング（瞑想）に進む
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ユーザーアイコン（右下固定） */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/(tabs)/settings')}
          activeOpacity={0.7}
          style={[styles.userIconButton, { backgroundColor: colors.card }]}
        >
          <Ionicons name="person-circle-outline" size={28} color={colors.textSecondary} />
        </TouchableOpacity>
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
  mascotArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotImage: {
    width: 200,
    height: 200,
  },
  breathDot: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#C8A96E',
  },
  buttonArea: {
    paddingHorizontal: 24,
    paddingBottom: 80,
    alignItems: 'center',
  },
  userIconButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonWrapper: {
    borderRadius: 25,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  proceedButton: {
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
