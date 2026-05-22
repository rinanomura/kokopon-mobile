import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import type { BodyForecast } from '@/lib/bodyForecast';
import type { EnvironmentData } from '@/lib/weather';
import { useThemeColors } from '@/hooks/useThemeColors';

// WMO天気コード → アイコン
function getWeatherEmoji(code: number): string {
  if (code === 0) return '\u2600\uFE0F';
  if (code <= 2) return '\u26C5';
  if (code === 3) return '\u2601\uFE0F';
  if (code <= 48) return '\uD83C\uDF2B\uFE0F';
  if (code <= 55) return '\uD83C\uDF26\uFE0F';
  if (code <= 65) return '\uD83C\uDF27\uFE0F';
  if (code <= 75) return '\u2744\uFE0F';
  if (code <= 82) return '\uD83C\uDF26\uFE0F';
  return '\u26C8\uFE0F';
}

interface Props {
  forecast: BodyForecast | null;
  environment: EnvironmentData | null;
  loading: boolean;
}

export default function BodyWeatherCard({ forecast, environment, loading }: Props) {
  const colors = useThemeColors();

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            {colors.showMascot
              ? 'りなわんがデータから今日の一言アドバイスを考え中...'
              : 'AIがデータから今日の一言アドバイスを考え中...'}
          </Text>
        </View>
      </View>
    );
  }

  if (!forecast || !environment) {
    return null;
  }

  // recommendationを箇条書きに分割
  const recItems = forecast.recommendation
    .replace(/がおすすめです[。]?$/, '')
    .split('、')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* 上段: 天気+月 並び + 環境数値 */}
      <View style={styles.envBar}>
        <View style={styles.iconPair}>
          <Text style={styles.skyEmoji}>
            {getWeatherEmoji(environment.weather.weatherCode)}
          </Text>
          <Text style={styles.moonEmoji}>
            {environment.moon.emoji}
          </Text>
        </View>
        <View style={styles.envNumbers}>
          <Text style={[styles.envText, { color: colors.textMuted }]}>
            {environment.weather.temperature}°C / {environment.weather.humidity}% / {environment.weather.pressure}hPa
          </Text>
        </View>
      </View>

      {/* サマリー（傾向分析） */}
      <Text style={[styles.summary, { color: colors.textSecondary }]}>
        {forecast.summary}
      </Text>

      {/* おすすめ（箇条書き） */}
      {recItems.length > 1 ? (
        <View style={styles.recList}>
          {recItems.map((item, i) => (
            <View key={i} style={styles.recItem}>
              <Text style={[styles.recBullet, { color: colors.accent }]}>{'\u2022'}</Text>
              <Text style={[styles.recText, { color: colors.textMuted }]}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.recSingle, { color: colors.textMuted }]}>
          {forecast.recommendation}
        </Text>
      )}

      {/* ラッキーアイテム */}
      {forecast.luckyItem && (
        <View style={[styles.luckyBar, { backgroundColor: colors.accentLight }]}>
          <Text style={styles.luckyEmoji}>{forecast.luckyItem.emoji}</Text>
          <View style={styles.luckyContent}>
            <Text style={[styles.luckyLabel, { color: colors.textMuted }]}>
              Today's item
            </Text>
            <Text style={[styles.luckyItem, { color: colors.textPrimary }]}>
              {forecast.luckyItem.item}
            </Text>
          </View>
          <Text style={[styles.luckyReason, { color: colors.textMuted }]}>
            {forecast.luckyItem.reason}
          </Text>
        </View>
      )}

      {/* 瞑想の意識ポイント */}
      {forecast.meditationTip && (
        <View style={[styles.meditationTipBar, { backgroundColor: colors.accentLight }]}>
          <Text style={styles.meditationTipEmoji}>{'\uD83E\uDDD8'}</Text>
          <View style={styles.meditationTipContent}>
            <Text style={[styles.meditationTipLabel, { color: colors.textMuted }]}>
              Today's focus
            </Text>
            <Text style={[styles.meditationTipText, { color: colors.textPrimary }]}>
              {forecast.meditationTip}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
  },
  // 上段
  envBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 10,
  },
  skyEmoji: {
    fontSize: 20,
  },
  moonEmoji: {
    fontSize: 10,
  },
  envNumbers: {
    flex: 1,
  },
  envText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // サマリー
  summary: {
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 10,
  },
  // おすすめ（箇条書き）
  recList: {
    gap: 4,
    marginBottom: 2,
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recBullet: {
    fontSize: 10,
    marginRight: 6,
    marginTop: 3,
  },
  recText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  recSingle: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  // ラッキーアイテム
  luckyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 8,
  },
  luckyEmoji: {
    fontSize: 22,
  },
  luckyContent: {
    flexShrink: 0,
  },
  luckyLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  luckyItem: {
    fontSize: 13,
    fontWeight: '700',
  },
  luckyReason: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  // 瞑想の意識ポイント
  meditationTipBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 8,
  },
  meditationTipEmoji: {
    fontSize: 20,
  },
  meditationTipContent: {
    flex: 1,
  },
  meditationTipLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meditationTipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
