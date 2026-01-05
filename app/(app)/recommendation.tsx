import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// メニュー定義
type MenuId = 'release_breath' | 'sense_energy' | 'ground_body' | 'calm_stay';

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
  const { menu, menuId } = useMemo(() => {
    const x = parseFloat(params.beforeX || '0');
    const y = parseFloat(params.beforeY || '0');
    const r = parseFloat(params.beforeR || '0');
    const id = getMenuId(x, y, r);
    return { menu: MENU_DATA[id], menuId: id };
  }, [params.beforeX, params.beforeY, params.beforeR]);

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
      colors={['#7AD7F0', '#CDECF6']}
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

          {/* トレーニングカード（ボタン化） */}
          <TouchableOpacity
            onPress={handleStart}
            activeOpacity={0.8}
            style={styles.trainingCardWrapper}
          >
            <LinearGradient
              colors={['#FF85A2', '#FFB6C1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.trainingCard}
            >
              <Text style={styles.trainingTitle}>
                {menu.title}
              </Text>
              <Text style={styles.trainingDescription}>
                {menu.description}
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
    // やさしい影
    shadowColor: '#FF85A2',
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
