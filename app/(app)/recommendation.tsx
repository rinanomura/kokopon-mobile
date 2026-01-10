import React, { useMemo, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// メニュー定義
type MenuId = 'release_breath' | 'sense_energy' | 'ground_body' | 'calm_stay';

// メニューごとのカラー定義
const MENU_COLORS: Record<MenuId, {
  backgroundGradient: [string, string];
  cardGradient: [string, string];
  shadowColor: string;
}> = {
  release_breath: {
    backgroundGradient: ['#D4A5E8', '#E8D0F0'],  // ピンク寄りの淡い紫
    cardGradient: ['#B07CC8', '#C9A0D8'],        // 背景より濃いめの紫
    shadowColor: '#B07CC8',
  },
  sense_energy: {
    backgroundGradient: ['#FFB6C1', '#FFDCE4'],  // 現行ピンク（淡め）
    cardGradient: ['#FF85A2', '#FFB6C1'],        // 現行ピンク（濃いめ）
    shadowColor: '#FF85A2',
  },
  ground_body: {
    backgroundGradient: ['#A5B8E8', '#D0DEF0'],  // ブルー寄りの淡い紫
    cardGradient: ['#7A8FC8', '#A0B8D8'],        // 背景より濃いめの青紫
    shadowColor: '#7A8FC8',
  },
  calm_stay: {
    backgroundGradient: ['#7AD7C8', '#CDEEF0'],  // グリーン寄りの淡いブルー
    cardGradient: ['#5ABFB0', '#8AD7C8'],        // 背景より濃いめの青緑
    shadowColor: '#5ABFB0',
  },
};

const MENU_DATA: Record<MenuId, {
  title: string;
  description: string;
  bubbleText: string;
}> = {
  release_breath: {
    title: '呼吸の出口を感じてみる 30秒',
    description: '今の状態を変えようとせず、吐く息が自然に出ていく感覚だけを感じてみます。',
    bubbleText: '少しエネルギーが高まっているみたい。\n吐く息に意識を向けてみようね。',
  },
  sense_energy: {
    title: '今のエネルギーを感じてみる 30秒',
    description: 'この元気さや高まりが、体のどこにあるかをそのまま感じてみます。',
    bubbleText: '元気なエネルギーがあるみたい。\nその感覚をそのまま感じてみようね。',
  },
  ground_body: {
    title: '体の重さをあずけてみる 30秒',
    description: '呼吸にこだわらず、体の重さがどこにあずけられているかを感じてみます。',
    bubbleText: '少し重さを感じているのかな。\n体をあずける感覚を味わってみようね。',
  },
  calm_stay: {
    title: '呼吸を感じてみる 30秒',
    description: '今の呼吸の出入りを、そのまま静かに感じてみましょう。',
    bubbleText: '穏やかな状態みたいだね。\nそのまま呼吸を感じてみようね。',
  },
};

/**
 * EmotionPoint から menuId を決定する
 * - r < 0.25 の場合は calm_stay（中央優先）
 * - y < 0: 高覚醒（画面座標では上がマイナス）, y >= 0: 低覚醒
 * - x >= 0: 快, x < 0: 不快
 */
function getMenuId(x: number, y: number, r: number): MenuId {
  // 中央付近は calm_stay
  if (r < 0.25) {
    return 'calm_stay';
  }

  const isHighArousal = y < 0;  // 画面座標では上がマイナス
  const isPleasant = x >= 0;

  if (isHighArousal && !isPleasant) return 'release_breath';  // 左上：高覚醒×不快
  if (isHighArousal && isPleasant) return 'sense_energy';     // 右上：高覚醒×快
  if (!isHighArousal && !isPleasant) return 'ground_body';    // 左下：低覚醒×不快
  return 'calm_stay';                                          // 右下：低覚醒×快
}

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

  // EmotionPoint から適切なメニューを選択
  const { menu, menuId, colors } = useMemo(() => {
    const x = parseFloat(params.beforeX || '0');
    const y = parseFloat(params.beforeY || '0');
    const r = parseFloat(params.beforeR || '0');
    const id = getMenuId(x, y, r);
    return { menu: MENU_DATA[id], menuId: id, colors: MENU_COLORS[id] };
  }, [params.beforeX, params.beforeY, params.beforeR]);

  // アニメーション用の値
  const mascotOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  // 入場アニメーション
  useEffect(() => {
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
        // カード表示後、パルスアニメーション開始
        startPulseAnimation();
      });
    }, 800);

    return () => clearTimeout(cardTimer);
  }, []);

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
   * ⑤瞑想実行画面へ遷移（beforePoint を引き継ぐ）
   */
  const handleStart = () => {
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

  return (
    <LinearGradient
      colors={colors.backgroundGradient}
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

          {/* りなわん＆吹き出し（フェードイン） */}
          <Animated.View style={{ opacity: mascotOpacity }}>
            {/* 吹き出し（りなわんのセリフ） */}
            <View style={styles.speechBubbleContainer}>
              <View style={styles.speechBubble}>
                <Text style={styles.speechBubbleText}>
                  {menu.bubbleText}
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
              style={[styles.trainingCardWrapper, { shadowColor: colors.shadowColor }]}
            >
              <LinearGradient
                colors={colors.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.trainingCard}
              >
                <Text style={styles.trainingTitle}>
                  {menu.title}
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

  // 上部タイトル
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 20,
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
    // やさしい影
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
    // やさしい影（shadowColorは動的に適用）
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
