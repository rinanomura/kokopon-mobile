import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreferences } from '@/hooks/usePreferences';
import {
  MenuId,
  Quadrant,
  TrainingContent,
  getTrainingContent,
  getQuadrant,
  getMenuIdsByQuadrant,
} from '@/constants/trainingContents';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// =============================================================================
// ローテーションカウンタ（AsyncStorage）
// =============================================================================

/** ローテーションカウンタのストレージキーを生成 */
function getRotationStorageKey(quadrant: Quadrant): string {
  return `rec_rot_${quadrant}`;
}

/**
 * 象限ごとのローテーションカウンタを取得し、インクリメントして保存
 * @returns 現在のカウンタ値（0, 1, 2 のいずれか）
 */
async function getAndIncrementRotationCounter(quadrant: Quadrant, candidateCount: number): Promise<number> {
  const key = getRotationStorageKey(quadrant);

  try {
    const stored = await AsyncStorage.getItem(key);
    const currentCounter = stored ? parseInt(stored, 10) : 0;

    // 現在のインデックス（候補数で割った余り）
    const index = currentCounter % candidateCount;

    // 次回用にインクリメントして保存
    const nextCounter = currentCounter + 1;
    await AsyncStorage.setItem(key, nextCounter.toString());

    return index;
  } catch (error) {
    console.log('ローテーションカウンタ取得エラー:', error);
    return 0;
  }
}

// =============================================================================
// メニュー選択ロジック（12本対応・ローテーション）
// =============================================================================

/**
 * 座標から象限を判定
 * 中央付近（r < 0.25）は low_pleasant として扱う
 */
function determineQuadrant(x: number, y: number, r: number): Quadrant {
  if (r < 0.25) {
    return 'low_pleasant';
  }
  return getQuadrant(x, y);
}

/**
 * 座標から象限を判定し、その象限の候補メニューID（3本）を返す
 */
function getCandidateMenuIds(quadrant: Quadrant): MenuId[] {
  return getMenuIdsByQuadrant(quadrant);
}

/**
 * ローテーションベースで候補から1つを選択（非同期）
 * AsyncStorage で象限ごとにカウンタを永続化
 */
async function pickMenuIdWithRotation(quadrant: Quadrant, candidates: MenuId[]): Promise<MenuId> {
  if (candidates.length === 0) {
    return 'calm_stay';
  }

  const index = await getAndIncrementRotationCounter(quadrant, candidates.length);
  return candidates[index];
}

// =============================================================================
// RecommendationScreen
// =============================================================================

/**
 * RecommendationScreen - マインドフルネスおすすめ画面（④）
 *
 * この画面の役割：
 * - 感情を分析・診断・評価しない
 * - 「あなたは◯◯タイプ」のような分類はしない
 * - 今の状態をやさしく言葉にして、次の行動につなぐ
 * - マインドフルネス的に安心できるトーンを保つ
 */
export default function RecommendationScreen() {
  // beforePoint を受け取る
  const params = useLocalSearchParams<{
    beforeX: string;
    beforeY: string;
    beforeR: string;
    beforeTheta: string;
  }>();

  // 設定を取得
  const { trainingMode, voice, isLoaded } = usePreferences();

  // メニュー選択状態（非同期で決定）
  const [menuId, setMenuId] = useState<MenuId | null>(null);
  const [content, setContent] = useState<TrainingContent | null>(null);
  const menuSelectedRef = useRef(false);

  // メニュー選択（画面マウント時に1回だけ実行）
  useEffect(() => {
    if (menuSelectedRef.current) return;
    menuSelectedRef.current = true;

    const selectMenu = async () => {
      const x = parseFloat(params.beforeX || '0');
      const y = parseFloat(params.beforeY || '0');
      const r = parseFloat(params.beforeR || '0');

      // 象限を判定
      const quadrant = determineQuadrant(x, y, r);

      // 候補を取得
      const candidates = getCandidateMenuIds(quadrant);

      // ローテーションで選択
      const selectedId = await pickMenuIdWithRotation(quadrant, candidates);

      setMenuId(selectedId);
      setContent(getTrainingContent(selectedId));
    };

    selectMenu();
  }, [params.beforeX, params.beforeY, params.beforeR]);

  // アニメーション用の値
  const mascotOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  // 入場アニメーション（isLoaded と content が揃ったら開始）
  useEffect(() => {
    if (!isLoaded || !content) return;

    // りなわん＆吹き出しをフェードイン
    Animated.timing(mascotOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // 少し遅れてカードを表示
    const cardTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start(() => {
        startPulseAnimation();
      });
    }, 800);

    return () => clearTimeout(cardTimer);
  }, [isLoaded, content]);

  // パルスアニメーション（タップを促す）
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cardScale, {
          toValue: 1.02,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  /**
   * トレーニングカードをタップしたときのハンドラ
   */
  const handleStart = () => {
    if (!menuId) return;

    console.log('=== トレーニング開始 ===');
    console.log('menuId:', menuId);
    router.push({
      pathname: '/meditation',
      params: {
        beforeX: params.beforeX,
        beforeY: params.beforeY,
        beforeR: params.beforeR,
        beforeTheta: params.beforeTheta,
        menuId: menuId,
      },
    });
  };

  // ローディング中の表示（設定読み込み中 or メニュー未選択）
  if (!isLoaded || !content) {
    // フォールバック用のデフォルト色
    const defaultColors = {
      backgroundGradient: ['#E8E8E8', '#F5F5F5'] as [string, string],
    };

    return (
      <LinearGradient
        colors={content?.colors.backgroundGradient || defaultColors.backgroundGradient}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5A6B7C" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={content.colors.backgroundGradient}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 上部タイトル */}
          <Text style={styles.title}>
            今のあなたにおすすめのトレーニング
          </Text>

          {/* 開発用: 現在の設定表示（本番では削除） */}
          <Text style={styles.devSettings}>
            mode={trainingMode} / voice={voice} / menu={menuId}
          </Text>

          {/* りなわん＆吹き出し（フェードイン） */}
          <Animated.View style={{ opacity: mascotOpacity }}>
            {/* 吹き出し（りなわんのセリフ） */}
            <View style={styles.speechBubbleContainer}>
              <View style={styles.speechBubble}>
                <Text style={styles.speechBubbleText}>
                  {content.bubbleText[trainingMode]}
                </Text>
              </View>
              {/* 吹き出しの尻尾（下向き三角） */}
              <View style={styles.speechBubbleTail} />
            </View>

            {/* りなわん（マスコット） */}
            <View style={styles.mascotContainer}>
              <Image
                source={require('@/assets/images/rinawan_talking.gif')}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* トレーニングカード（遅延表示＆パルスアニメーション） */}
          <Animated.View
            style={{
              opacity: cardOpacity,
              transform: [
                { translateY: cardTranslateY },
                { scale: cardScale },
              ],
            }}
          >
            <TouchableOpacity
              onPress={handleStart}
              activeOpacity={0.8}
              style={[styles.trainingCardWrapper, { shadowColor: content.colors.shadowColor }]}
            >
              <LinearGradient
                colors={content.colors.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.trainingCard}
              >
                <Text style={styles.trainingTitle}>
                  {content.title[trainingMode]}
                </Text>
                <View style={styles.tapHintContainer}>
                  <Ionicons
                    name="sparkles"
                    size={14}
                    color="rgba(255, 255, 255, 0.8)"
                  />
                  <Text style={styles.tapHint}>
                    タップして開始
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // ローディング
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 上部タイトル
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 20,
  },
  // 開発用設定表示（本番では削除）
  devSettings: {
    fontSize: 10,
    color: '#A0AEC0',
    textAlign: 'center',
    marginBottom: 8,
  },

  // 吹き出し
  speechBubbleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  speechBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  speechBubbleText: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  speechBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255, 255, 255, 0.9)',
    marginTop: -1,
  },

  // りなわん
  mascotContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mascotImage: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
    maxWidth: 160,
    maxHeight: 160,
  },

  // トレーニングカード（ボタン）
  trainingCardWrapper: {
    width: '100%',
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  trainingCard: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  trainingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  trainingDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  tapHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  tapHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});
