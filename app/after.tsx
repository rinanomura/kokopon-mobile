import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 円環のサイズ（小さめに表示）
const WHEEL_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

// マーカーのサイズ
const BEFORE_MARKER_SIZE = 14;
const AFTER_MARKER_SIZE = 18;

/**
 * EmotionPoint 型
 * 感情円環上の座標を表す
 */
interface EmotionPoint {
  x: number;      // -1〜1
  y: number;      // -1〜1
  r: number;      // 0〜1
  theta: number;  // ラジアン
}

/**
 * AfterScreen - Before / After 可視化画面（⑥）
 *
 * この画面は「変化を評価する」ためのものではありません。
 * Before / After を並べて表示し、ただ眺める体験を提供します。
 *
 * 思想的制約：
 * - 良い・悪いを示さない
 * - 数値比較をしない
 * - 距離・角度・差分を計算しない
 * - 成果・改善・成功という言葉を使わない
 */
export default function AfterScreen() {
  // TODO: 将来的には Context や Zustand から取得
  // 現在は仮のデータを使用
  const beforePoint: EmotionPoint = {
    x: -0.3,
    y: -0.4,
    r: 0.5,
    theta: -2.2,
  };

  const afterPoint: EmotionPoint = {
    x: 0.2,
    y: -0.2,
    r: 0.28,
    theta: -0.78,
  };

  /**
   * 正規化座標（-1〜1）をピクセル座標に変換
   */
  const getMarkerPosition = (point: EmotionPoint, markerSize: number) => {
    const radius = WHEEL_SIZE / 2;
    const left = radius + point.x * radius - markerSize / 2;
    const top = radius + point.y * radius - markerSize / 2;
    return { left, top };
  };

  const beforePosition = getMarkerPosition(beforePoint, BEFORE_MARKER_SIZE);
  const afterPosition = getMarkerPosition(afterPoint, AFTER_MARKER_SIZE);

  /**
   * ホームへ戻る
   */
  const handleGoHome = () => {
    router.replace('/');
  };

  return (
    <LinearGradient
      colors={['#7AD7F0', '#CDECF6']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* タイトル */}
        <View style={styles.header}>
          <Text style={styles.title}>
            いまの状態を、少し眺めてみよう
          </Text>
        </View>

        {/* メインコンテンツ：感情円環 with Before/After マーカー */}
        <View style={styles.mainContent}>
          {/* 円環セクション（上部） */}
          <View style={styles.wheelSection}>
            <View style={[styles.wheelContainer, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
              {/* 円環ベース画像 */}
              <Image
                source={require('@/assets/images/emotion_wheel_base.png')}
                style={[styles.wheelImage, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}
                resizeMode="contain"
              />

              {/* Before マーカー（薄いグレー、小さめ） */}
              <View
                style={[
                  styles.beforeMarker,
                  {
                    left: beforePosition.left,
                    top: beforePosition.top,
                    width: BEFORE_MARKER_SIZE,
                    height: BEFORE_MARKER_SIZE,
                    borderRadius: BEFORE_MARKER_SIZE / 2,
                  },
                ]}
                pointerEvents="none"
              />

              {/* After マーカー（少し濃い色、大きめ） */}
              <View
                style={[
                  styles.afterMarker,
                  {
                    left: afterPosition.left,
                    top: afterPosition.top,
                    width: AFTER_MARKER_SIZE,
                    height: AFTER_MARKER_SIZE,
                    borderRadius: AFTER_MARKER_SIZE / 2,
                  },
                ]}
                pointerEvents="none"
              />
            </View>

            {/* 凡例（シンプルに） */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={styles.legendBeforeDot} />
                <Text style={styles.legendText}>はじめ</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.legendAfterDot} />
                <Text style={styles.legendText}>いま</Text>
              </View>
            </View>
          </View>

          {/* 吹き出し + りなわん */}
          <View style={styles.mascotSection}>
            {/* 吹き出し（ファンシーデザイン） */}
            <View style={styles.speechBubbleContainer}>
              <LinearGradient
                colors={['#FFF5F7', '#FFFFFF', '#FFF0F5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.speechBubble}
              >
                {/* 装飾キラキラ（左上） */}
                <View style={styles.sparkleTopLeft}>
                  <Text style={styles.sparkleText}>✧</Text>
                </View>
                {/* 装飾キラキラ（右下） */}
                <View style={styles.sparkleBottomRight}>
                  <Text style={styles.sparkleText}>✧</Text>
                </View>
                <Text style={styles.speechBubbleText}>
                  変わっていても、{'\n'}変わっていなくても、大丈夫。
                </Text>
              </LinearGradient>
              {/* 吹き出しの尻尾（下向き・グラデーション風） */}
              <View style={styles.speechBubbleTailOuter}>
                <View style={styles.speechBubbleTail} />
              </View>
            </View>

            {/* りなわん */}
            <View style={styles.mascotContainer}>
              <Image
                source={require('@/assets/images/rinawan_laying_down.gif')}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* フッター：ホームへ戻るボタン */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleGoHome}
            activeOpacity={0.8}
            style={styles.homeButtonWrapper}
          >
            <LinearGradient
              colors={['#FF85A2', '#FFB6C1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.homeButton}
            >
              <Text style={styles.homeButtonText}>
                今日の記録へ
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

  // ヘッダー
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 30,
  },

  // メインコンテンツ
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  wheelSection: {
    alignItems: 'center',
  },
  wheelContainer: {
    position: 'relative',
  },
  wheelImage: {
    position: 'absolute',
  },

  // 吹き出し + りなわんセクション
  mascotSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  speechBubbleContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  speechBubble: {
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 182, 193, 0.5)',
    // ピンク系のやさしい影
    shadowColor: '#FFB6C1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    position: 'relative',
    overflow: 'visible',
  },
  sparkleTopLeft: {
    position: 'absolute',
    top: -8,
    left: -4,
  },
  sparkleBottomRight: {
    position: 'absolute',
    bottom: -6,
    right: -2,
  },
  sparkleText: {
    fontSize: 16,
    color: '#FFB6C1',
  },
  speechBubbleText: {
    fontSize: 15,
    color: '#5A6B7C',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  speechBubbleTailOuter: {
    alignItems: 'center',
    marginTop: -2,
  },
  speechBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFF0F5',
  },

  // りなわん
  mascotContainer: {
    alignItems: 'center',
  },
  mascotImage: {
    width: SCREEN_WIDTH * 0.35,
    height: SCREEN_WIDTH * 0.35,
    maxWidth: 140,
    maxHeight: 140,
  },

  // Before マーカー（薄いグレー）
  beforeMarker: {
    position: 'absolute',
    backgroundColor: 'rgba(160, 174, 192, 0.9)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    // やさしい影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },

  // After マーカー（少し濃い色）
  afterMarker: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 133, 162, 0.95)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    // やさしい影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },

  // 凡例
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendBeforeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(160, 174, 192, 0.9)',
  },
  legendAfterDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 133, 162, 0.95)',
  },
  legendText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },

  // フッター
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  homeButtonWrapper: {
    borderRadius: 25,
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  homeButton: {
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
