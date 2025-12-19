import React, { useRef, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  GestureResponderEvent,
  Pressable,
} from 'react-native';

// タップ位置の正規化された座標を表す型
export interface EmotionPoint {
  x: number;      // -1〜1（円の中心が0、左が-1、右が1）
  y: number;      // -1〜1（円の中心が0、上が-1、下が1）
  r: number;      // 0〜1（中心が0、外周が1）
  theta: number;  // ラジアン（atan2(y, x)）
}

// ラベル表示モード
// 0: ベースのみ（デフォルト）
// 1: ベース + 基本ラベル
// 2: ベース + 基本ラベル + 詳細ラベル
export type LabelMode = 0 | 1 | 2;

// マーカーのサイズ（px）
const MARKER_SIZE = 20;

interface EmotionWheelProps {
  size: number;                             // 円環のサイズ（px）
  labelMode: LabelMode;                     // ラベル表示モード（0, 1, 2）
  onSelect: (point: EmotionPoint) => void;  // タップ時のコールバック
  selectedPoint?: EmotionPoint | null;      // 選択中の座標（マーカー表示用）
}

/**
 * EmotionWheel コンポーネント
 *
 * マインドフルネスのための感情円環。
 * 3つのレイヤー（ベース、基本ラベル、詳細ラベル）を重ねて表示し、
 * タップ位置を正規化された座標として親に通知します。
 *
 * 重要: この円環は感情を「評価」しません。
 * ユーザーは今の状態に気づくだけです。
 */
export default function EmotionWheel({
  size,
  labelMode,
  onSelect,
  selectedPoint,
}: EmotionWheelProps) {
  // 円環のコンテナへの参照（位置計算に使用）
  const containerRef = useRef<View>(null);

  // 円の半径（px）
  const radius = size / 2;

  /**
   * タップ位置を正規化された座標に変換
   */
  const handlePress = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;

    // コンテナの位置を取得して、タップ位置を円環内の相対座標に変換
    containerRef.current?.measure((fx, fy, width, height, px, py) => {
      // 円の中心を (0, 0) として計算
      const centerX = px + width / 2;
      const centerY = py + height / 2;
      const r = width / 2;

      // 正規化された座標（-1 〜 1）
      const x = (pageX - centerX) / r;
      const y = (pageY - centerY) / r;

      // 極座標への変換
      const rNorm = Math.sqrt(x * x + y * y);
      const theta = Math.atan2(y, x);

      // 円の外側をタップした場合は無視
      if (rNorm > 1) {
        console.log('円の外側がタップされました（無視）');
        return;
      }

      // 正規化された座標を親に通知
      onSelect({
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        r: Math.round(rNorm * 1000) / 1000,
        theta: Math.round(theta * 1000) / 1000,
      });
    });
  }, [onSelect]);

  /**
   * selectedPoint から画面上のマーカー位置を計算
   * 正規化座標（-1〜1）をピクセル座標に変換
   */
  const getMarkerPosition = () => {
    if (!selectedPoint) return null;

    // 正規化座標からピクセル座標へ変換
    // x: -1〜1 → 0〜size
    // y: -1〜1 → 0〜size（画面のy軸は下向きが正なのでそのまま）
    const left = radius + selectedPoint.x * radius - MARKER_SIZE / 2;
    const top = radius + selectedPoint.y * radius - MARKER_SIZE / 2;

    return { left, top };
  };

  const markerPosition = getMarkerPosition();

  return (
    <View
      ref={containerRef}
      style={[styles.container, { width: size, height: size }]}
    >
      {/* レイヤー1: 円環のベース（常時表示） */}
      <Image
        source={require('@/assets/images/emotion_wheel_base.png')}
        style={[styles.wheelImage, { width: size, height: size }]}
        resizeMode="contain"
      />

      {/* レイヤー2: 基本ラベル（labelMode >= 1 のとき表示） */}
      {labelMode >= 1 && (
        <Image
          source={require('@/assets/images/emotion_labels_basic.png')}
          style={[styles.labelOverlay, { width: size, height: size }]}
          resizeMode="contain"
        />
      )}

      {/* レイヤー3: 詳細ラベル（labelMode >= 2 のとき表示） */}
      {labelMode >= 2 && (
        <Image
          source={require('@/assets/images/emotion_labels_detailed.png')}
          style={[styles.labelOverlay, { width: size, height: size }]}
          resizeMode="contain"
        />
      )}

      {/* 選択マーカー（selectedPoint がある場合のみ表示） */}
      {markerPosition && (
        <View
          style={[
            styles.marker,
            {
              left: markerPosition.left,
              top: markerPosition.top,
              width: MARKER_SIZE,
              height: MARKER_SIZE,
              borderRadius: MARKER_SIZE / 2,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* タップ検出用の透明なオーバーレイ */}
      <Pressable
        style={[styles.touchOverlay, { width: size, height: size }]}
        onPress={handlePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelImage: {
    position: 'absolute',
  },
  labelOverlay: {
    position: 'absolute',
  },
  touchOverlay: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  marker: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 3,
    borderColor: '#FF85A2',  // やさしいピンク
    // やさしい影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
