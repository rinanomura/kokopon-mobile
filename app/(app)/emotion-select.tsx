import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EmotionWheel, { EmotionPoint, LabelMode } from '@/components/EmotionWheel';
import { usePreferences } from '@/hooks/usePreferences';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 円環のサイズ（画面幅の85%、上限340px）
const WHEEL_SIZE = Math.min(SCREEN_WIDTH * 0.85, 340);

/**
 * EmotionSelectScreen - 感情選択画面（③瞑想ガイドモード用）
 *
 * ユーザーは円環をタップして「今の感情」を選択し、
 * 象限に応じたレコメンド画面へ進みます。
 */
export default function EmotionSelectScreen() {
  const params = useLocalSearchParams<{
    beforeBody: string;
    beforeMind: string;
    memo: string;
  }>();
  const { trainingMode } = usePreferences();

  // ラベル表示モード（0: ベースのみ, 1: +基本ラベル, 2: +詳細ラベル）
  const [labelMode, setLabelMode] = useState<LabelMode>(
    trainingMode === 'verbal' ? 2 : 0
  );

  useEffect(() => {
    setLabelMode(trainingMode === 'verbal' ? 2 : 0);
  }, [trainingMode]);

  // 選択された感情の座標
  const [selectedPoint, setSelectedPoint] = useState<EmotionPoint | null>(null);

  // 吹き出しアニメーション
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const sparkle1Anim = useRef(new Animated.Value(0)).current;
  const sparkle2Anim = useRef(new Animated.Value(0)).current;
  const sparkle3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bubbleAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bubbleAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    const startSparkleAnim = (anim: Animated.Value, delay: number) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
      }, delay);
    };

    startSparkleAnim(sparkle1Anim, 0);
    startSparkleAnim(sparkle2Anim, 500);
    startSparkleAnim(sparkle3Anim, 800);
  }, []);

  const handleEmotionSelect = useCallback((point: EmotionPoint) => {
    console.log('=== 感情が選択されました ===');
    console.log(`座標: (x: ${point.x}, y: ${point.y})`);
    setSelectedPoint(point);
  }, []);

  const cycleLabelMode = useCallback(() => {
    setLabelMode(prev => ((prev + 1) % 3) as LabelMode);
  }, []);

  const handleProceed = useCallback(() => {
    if (!selectedPoint) return;

    // レコメンド画面へ遷移（beforeBody/beforeMind も引き継ぐ）
    router.push({
      pathname: '/recommendation',
      params: {
        beforeX: selectedPoint.x.toString(),
        beforeY: selectedPoint.y.toString(),
        beforeR: selectedPoint.r.toString(),
        beforeTheta: selectedPoint.theta.toString(),
        // スライダー値も引き継ぐ（SessionLog作成時に使用）
        beforeBody: params.beforeBody,
        beforeMind: params.beforeMind,
        memo: params.memo ?? '',
      },
    });
  }, [selectedPoint, params]);

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
          <TouchableOpacity
            style={styles.labelToggle}
            onPress={cycleLabelMode}
            activeOpacity={0.7}
          >
            <Ionicons
              name={labelMode === 0 ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#718096"
            />
            <Text style={styles.labelToggleText}>
              {labelMode === 0 ? 'ラベル非表示' : labelMode === 1 ? '基本ラベル' : '詳細ラベル'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* メインコンテンツ：感情円環 */}
        <View style={styles.wheelContainer}>
          {/* ガイド文 */}
          <View style={styles.guideContainer}>
            <View style={styles.mascotWrapper}>
              <Image
                source={require('@/assets/images/rinawan_tilting_head.gif')}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>
            <Animated.View
              style={[
                styles.speechBubbleContainer,
                {
                  transform: [{
                    translateY: bubbleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -4],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.speechBubbleTail} />
              <LinearGradient
                colors={['#FFF5F7', '#FFFFFF', '#FFF0F5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.speechBubble}
              >
                <Animated.Text style={[styles.sparkle, styles.sparkleTopRight, { opacity: sparkle1Anim }]}>
                  ✧
                </Animated.Text>
                <Animated.Text style={[styles.sparkle, styles.sparkleTopLeft, { opacity: sparkle2Anim }]}>
                  ✦
                </Animated.Text>
                <Animated.Text style={[styles.sparkle, styles.sparkleBottomRight, { opacity: sparkle3Anim }]}>
                  ⋆
                </Animated.Text>
                <Text style={styles.speechBubbleText}>
                  円の中をタップして、{'\n'}今の気持ちを選んでね
                </Text>
              </LinearGradient>
            </Animated.View>
          </View>

          {/* 感情円環 */}
          <EmotionWheel
            size={WHEEL_SIZE}
            onSelect={handleEmotionSelect}
            labelMode={labelMode}
            selectedPoint={selectedPoint}
          />
        </View>

        {/* フッター */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleProceed}
            activeOpacity={0.8}
            disabled={!selectedPoint}
            style={[
              styles.proceedButtonWrapper,
              !selectedPoint && styles.proceedButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={selectedPoint ? ['#FF85A2', '#FFB6C1'] : ['#CBD5E0', '#E2E8F0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proceedButton}
            >
              <Text style={[
                styles.proceedButtonText,
                !selectedPoint && styles.proceedButtonTextDisabled,
              ]}>
                おすすめを見る
              </Text>
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
    justifyContent: 'space-between',
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
  labelToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  labelToggleText: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
  wheelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  guideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  mascotWrapper: {
    alignItems: 'center',
  },
  mascotImage: {
    width: 70,
    height: 70,
  },
  speechBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
  },
  speechBubbleTail: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFF5F7',
    marginRight: -1,
  },
  speechBubble: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 182, 193, 0.5)',
    shadowColor: '#FFB6C1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
  },
  sparkle: {
    position: 'absolute',
    fontSize: 10,
    color: '#FF69B4',
    textShadowColor: '#FF69B4',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  sparkleTopRight: {
    top: -6,
    right: -4,
  },
  sparkleTopLeft: {
    top: 2,
    left: -8,
  },
  sparkleBottomRight: {
    bottom: -4,
    right: 0,
  },
  speechBubbleText: {
    fontSize: 12,
    color: '#5A6B7C',
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: 'center',
  },
  proceedButtonWrapper: {
    borderRadius: 25,
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  proceedButtonDisabled: {
    shadowOpacity: 0,
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
  proceedButtonTextDisabled: {
    color: '#A0AEC0',
  },
});
