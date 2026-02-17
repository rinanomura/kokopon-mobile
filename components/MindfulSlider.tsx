import React, { useRef, useCallback } from 'react';
import { View, Text, Image, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';

interface MindfulSliderProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;          // -1 ~ +1
  onValueChange: (value: number) => void;
}

const THUMB_SIZE = 40;
const TRACK_HEIGHT = 8;

/**
 * MindfulSlider - マインドフルネス的配慮のカスタムスライダー
 *
 * - PanResponder によるドラッグ操作
 * - 値の範囲: -1 ~ +1（中央 = 0）
 * - サム（つまみ）はりなわんGIF
 * - 数値やメモリは表示しない
 * - 中央からの填充表示
 */
export default function MindfulSlider({
  label,
  leftLabel,
  rightLabel,
  value,
  onValueChange,
}: MindfulSliderProps) {
  const trackWidth = useRef(0);
  const currentValue = useRef(value);
  currentValue.current = value;
  const gestureStartValue = useRef(0);
  const hasMoved = useRef(false);
  const tapLocationX = useRef(0);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  }, []);

  const clampValue = (v: number): number => Math.max(-1, Math.min(1, v));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        gestureStartValue.current = currentValue.current;
        hasMoved.current = false;
        tapLocationX.current = evt.nativeEvent.locationX;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (trackWidth.current === 0) return;
        if (Math.abs(gestureState.dx) > 3) {
          hasMoved.current = true;
        }
        const sensitivity = 0.5;
        const deltaValue = (gestureState.dx / trackWidth.current) * 2 * sensitivity;
        const newValue = clampValue(gestureStartValue.current + deltaValue);
        onValueChange(Math.round(newValue * 100) / 100);
      },
      onPanResponderRelease: () => {
        if (!hasMoved.current && trackWidth.current > 0) {
          const ratio = tapLocationX.current / trackWidth.current;
          const newValue = clampValue(ratio * 2 - 1);
          onValueChange(Math.round(newValue * 100) / 100);
        }
      },
    })
  ).current;

  // Thumb position as percentage (0% to 100%)
  const thumbPercent = ((value + 1) / 2) * 100;

  // Fill from center (50%) to thumb position
  const fillLeft = Math.min(thumbPercent, 50);
  const fillWidth = Math.abs(thumbPercent - 50);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.trackContainer} onLayout={onTrackLayout} {...panResponder.panHandlers}>
        {/* Track background */}
        <View style={styles.track} />
        {/* Fill from center */}
        <View
          style={[
            styles.fill,
            {
              left: `${fillLeft}%`,
              width: `${fillWidth}%`,
            },
          ]}
        />
        {/* Thumb: りなわん GIF */}
        <View
          style={[
            styles.thumb,
            {
              left: `${thumbPercent}%`,
              marginLeft: -THUMB_SIZE / 2,
            },
          ]}
        >
          <Image
            source={require('@/assets/images/rinawan_tilting_head.gif')}
            style={styles.thumbImage}
            resizeMode="cover"
          />
        </View>
      </View>
      <View style={styles.edgeLabelRow}>
        <Text style={styles.edgeLabel}>{leftLabel}</Text>
        <Text style={styles.edgeLabel}>{rightLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 12,
    textAlign: 'center',
  },
  trackContainer: {
    height: THUMB_SIZE + 16,
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: THUMB_SIZE / 2,
  },
  edgeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  edgeLabel: {
    fontSize: 11,
    color: '#718096',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(255, 182, 193, 0.3)',
  },
  fill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(255, 133, 162, 0.5)',
    top: '50%',
    marginTop: -TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF85A2',
    top: '50%',
    marginTop: -THUMB_SIZE / 2,
    overflow: 'hidden',
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  thumbImage: {
    width: THUMB_SIZE - 4,
    height: THUMB_SIZE - 4,
    borderRadius: (THUMB_SIZE - 4) / 2,
  },
});
