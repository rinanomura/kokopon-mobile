/**
 * 身体の気象予報 - 個人化された環境医学
 *
 * 身体データ × 環境データ から「今日の身体天気」を生成する
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EnvironmentData, assessEnvironmentRisk, EnvironmentRisk } from './weather';
import { generateBodyForecastAI } from './openRouter';
import type { DailyHealthData } from '@/hooks/useHealthKit';
import type { SessionLog, MealLog, DailyHealthLog, EventClassification } from './api';

// ========================================
// 型定義
// ========================================

/** 身体予報のアイコン（天気メタファー） */
export type BodyWeatherIcon = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy';

export interface LuckyItem {
  item: string;
  reason: string;
  emoji: string;
}

export interface BodyForecast {
  icon: BodyWeatherIcon;
  label: string;
  summary: string;
  factors: string[];
  recommendation: string;
  luckyItem?: LuckyItem;
  meditationTip?: string;
  environmentRisk: EnvironmentRisk;
}

/** 個人の環境感受性プロファイル */
export interface PersonalProfile {
  pressureSensitivity: number;  // -1(鈍感)〜1(敏感)
  humiditySensitivity: number;
  sleepPressureCorrelation: number; // 気圧低下時の睡眠影響度
  dataPoints: number;           // プロファイル計算に使ったデータ数
  updatedAt: string;
}

/** AI予報に渡す直近データ */
export interface RecentUserData {
  recentSessions?: SessionLog[];     // 直近のセッション履歴
  recentMeals?: MealLog[];           // 直近の食事ログ
  healthLogs?: DailyHealthLog[];     // 直近のヘルスログ（DynamoDB保存済み）
  todayHealthKit?: DailyHealthData;  // 今日のHealthKitデータ
  recentEvents?: EventClassification[]; // 直近のカレンダーイベント（ストレススコア付き）
}

const PROFILE_KEY = '@kokopon/personal_env_profile';
const HISTORY_KEY = '@kokopon/env_health_history';

// ========================================
// 環境×身体 履歴保存（相関計算用）
// ========================================

export interface EnvHealthRecord {
  date: string;
  pressure: number;
  pressureChange: number;
  humidity: number;
  temperature: number;
  moonIllumination: number;
  // 身体データ（あれば）
  sleepHours?: number;
  avgHRV?: number;
  avgHeartRate?: number;
  steps?: number;
  // 主観データ（あれば）
  bodyScore?: number;  // 1=軽い, 3=重い
  mindScore?: number;
}

/**
 * 環境×身体データを記録する（日次で呼び出す）
 */
export async function recordEnvHealthData(
  env: EnvironmentData,
  health?: DailyHealthData,
  subjective?: { body?: number; mind?: number }
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const record: EnvHealthRecord = {
    date: today,
    pressure: env.weather.pressure,
    pressureChange: env.weather.pressureChange,
    humidity: env.weather.humidity,
    temperature: env.weather.temperature,
    moonIllumination: env.moon.illumination,
    sleepHours: health?.sleepHours,
    avgHRV: health?.avgHRV,
    avgHeartRate: health?.avgHeartRate,
    steps: health?.steps,
    bodyScore: subjective?.body,
    mindScore: subjective?.mind,
  };

  try {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    const history: EnvHealthRecord[] = stored ? JSON.parse(stored) : [];

    // 同日のデータがあれば更新、なければ追加
    const idx = history.findIndex(r => r.date === today);
    if (idx >= 0) {
      history[idx] = { ...history[idx], ...record };
    } else {
      history.push(record);
    }

    // 最大90日分保持
    const trimmed = history.slice(-90);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to record env-health data:', err);
  }
}

/**
 * 環境×身体データの履歴を取得（分析画面用）
 */
export async function getEnvHealthHistory(): Promise<EnvHealthRecord[]> {
  try {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// ========================================
// 個人プロファイル計算
// ========================================

/**
 * 蓄積データから個人の環境感受性プロファイルを計算
 */
export async function updatePersonalProfile(): Promise<PersonalProfile | null> {
  try {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    if (!stored) return null;

    const history: EnvHealthRecord[] = JSON.parse(stored);
    if (history.length < 7) return null; // 最低7日分のデータが必要

    // 気圧感受性: 気圧変化と主観bodyスコアの相関
    const pressureBodyPairs = history
      .filter(r => r.bodyScore !== undefined && r.pressureChange !== undefined)
      .map(r => ({ x: r.pressureChange, y: r.bodyScore! }));

    const pressureSensitivity = pressureBodyPairs.length >= 5
      ? -correlate(pressureBodyPairs) // 気圧低下(負)→体重い(高)なら正の感受性
      : 0;

    // 湿度感受性: 湿度と主観bodyスコアの相関
    const humidityBodyPairs = history
      .filter(r => r.bodyScore !== undefined && r.humidity !== undefined)
      .map(r => ({ x: r.humidity, y: r.bodyScore! }));

    const humiditySensitivity = humidityBodyPairs.length >= 5
      ? correlate(humidityBodyPairs)
      : 0;

    // 気圧と睡眠の相関
    const pressureSleepPairs = history
      .filter(r => r.sleepHours !== undefined && r.pressureChange !== undefined)
      .map(r => ({ x: r.pressureChange, y: r.sleepHours! }));

    const sleepPressureCorrelation = pressureSleepPairs.length >= 5
      ? correlate(pressureSleepPairs)
      : 0;

    const profile: PersonalProfile = {
      pressureSensitivity: clamp(pressureSensitivity, -1, 1),
      humiditySensitivity: clamp(humiditySensitivity, -1, 1),
      sleepPressureCorrelation: clamp(sleepPressureCorrelation, -1, 1),
      dataPoints: history.length,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  } catch (err) {
    console.error('Failed to update personal profile:', err);
    return null;
  }
}

/**
 * 保存済みプロファイルを取得
 */
export async function getPersonalProfile(): Promise<PersonalProfile | null> {
  try {
    const stored = await AsyncStorage.getItem(PROFILE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// ========================================
// 身体予報生成
// ========================================

/**
 * 環境データ + 身体データ + 直近ユーザーデータ + 個人プロファイルから「今日の身体天気」を生成
 */
export async function generateBodyForecast(
  env: EnvironmentData,
  recent?: RecentUserData,
): Promise<BodyForecast> {
  const profile = await getPersonalProfile();
  const risk = assessEnvironmentRisk(env);
  const factors: string[] = [...risk.factors];
  const todayHealth = recent?.todayHealthKit;

  let riskScore = risk.level === 'high' ? 3 : risk.level === 'moderate' ? 2 : 0;

  // 個人プロファイルに基づく追加リスク判定
  if (profile) {
    if (profile.pressureSensitivity > 0.3 && env.weather.pressureChange < -2) {
      factors.push('あなたは気圧低下に敏感');
      riskScore += 1;
    }
    if (profile.humiditySensitivity > 0.3 && env.weather.humidity > 70) {
      factors.push('あなたは高湿度に敏感');
      riskScore += 1;
    }
  }

  // HealthKitデータからのリスク
  if (todayHealth) {
    if (todayHealth.sleepHours !== undefined && todayHealth.sleepHours < 6) {
      factors.push(`睡眠${todayHealth.sleepHours}時間（不足）`);
      riskScore += 2;
    }
    if (todayHealth.avgHRV !== undefined && todayHealth.avgHRV < 30) {
      factors.push('HRV低下（ストレス反応性↑）');
      riskScore += 1;
    }
  }

  // DynamoDB保存済みヘルスログからのリスク（HealthKitがない場合のフォールバック）
  if (!todayHealth && recent?.healthLogs && recent.healthLogs.length > 0) {
    const latest = recent.healthLogs[0]; // 直近1日
    if (latest.sleepHours != null && latest.sleepHours < 6) {
      factors.push(`昨日の睡眠${latest.sleepHours}時間（不足）`);
      riskScore += 1;
    }
  }

  // 直近セッションからの傾向
  if (recent?.recentSessions && recent.recentSessions.length > 0) {
    const lastSession = recent.recentSessions[0];
    if (lastSession.body === '3') {
      factors.push('前回: からだが重い');
      riskScore += 1;
    }
    if (lastSession.breath === '1') {
      factors.push('前回: 呼吸が浅い');
      riskScore += 1;
    }
  }

  // アイコン決定
  const icon: BodyWeatherIcon =
    riskScore >= 4 ? 'rainy' :
    riskScore >= 3 ? 'cloudy' :
    riskScore >= 1 ? 'partly_cloudy' :
    'sunny';

  // ラベル
  const label =
    icon === 'sunny' ? '身体の快晴' :
    icon === 'partly_cloudy' ? '身体のくもり時々晴れ' :
    icon === 'cloudy' ? '身体のくもり' :
    '炎症の低気圧';

  // AI生成を試みる（環境 + 身体 + 直近データすべてを渡す）
  const context = buildForecastContext(env, recent, factors, profile);
  const aiResult = await generateBodyForecastAI(context);

  const summary = aiResult?.summary || buildSummary(env, todayHealth, factors, icon);
  const recommendation = aiResult?.recommendation || buildRecommendation(env, todayHealth, icon);
  const luckyItem = aiResult?.luckyItem;
  const meditationTip = aiResult?.meditationTip;

  return {
    icon,
    label,
    summary,
    factors,
    recommendation,
    luckyItem,
    meditationTip,
    environmentRisk: risk,
  };
}

// ========================================
// メッセージ生成（ルールベース）
// ========================================

function buildSummary(
  env: EnvironmentData,
  health: DailyHealthData | undefined,
  factors: string[],
  icon: BodyWeatherIcon,
): string {
  if (icon === 'sunny') {
    return `${env.weather.weatherLabel}。気圧安定、身体にとっても穏やかな日です`;
  }

  const parts: string[] = [];

  if (env.weather.pressureChange <= -3) {
    parts.push('低気圧が接近中');
  }

  if (health?.sleepHours !== undefined && health.sleepHours < 6) {
    parts.push('睡眠が足りていません');
  }

  if (health?.avgHRV !== undefined && health.avgHRV < 30) {
    parts.push('自律神経が少し乱れ気味');
  }

  if (env.weather.humidity > 80) {
    parts.push('湿度が高め');
  }

  if (parts.length === 0) {
    parts.push(factors.length > 0 ? factors[0] : '少し注意が必要な日');
  }

  return parts.join('。') + '。無理しない日にしましょう';
}

function buildRecommendation(
  env: EnvironmentData,
  health: DailyHealthData | undefined,
  icon: BodyWeatherIcon,
): string {
  if (icon === 'sunny') {
    return 'トレーニングに最適な日です';
  }

  const recs: string[] = [];

  if (env.weather.pressureChange <= -3) {
    recs.push('軽いストレッチ');
  }

  if (health?.sleepHours !== undefined && health.sleepHours < 6) {
    recs.push('早めの就寝');
  }

  if (env.weather.humidity > 80 || env.weather.temperature > 30) {
    recs.push('こまめな水分補給');
  }

  if (health?.avgHRV !== undefined && health.avgHRV < 30) {
    recs.push('呼吸法やゆっくりした瞑想');
  }

  if (recs.length === 0) {
    recs.push('ゆったり過ごすこと');
  }

  return recs.join('と') + 'がおすすめです';
}

// ========================================
// AI用コンテキスト生成
// ========================================

/**
 * 身体予報AI用: 環境+身体+直近データすべてを含むリッチコンテキスト
 */
function buildForecastContext(
  env: EnvironmentData,
  recent?: RecentUserData,
  factors?: string[],
  profile?: PersonalProfile | null,
): string {
  const lines: string[] = [];

  // --- 現在時刻 ---
  const now = new Date();
  const hour = now.getHours();
  const timeLabel = hour < 6 ? '深夜' : hour < 10 ? '朝' : hour < 12 ? '午前' : hour < 14 ? '昼' : hour < 17 ? '午後' : hour < 20 ? '夕方' : '夜';
  lines.push(`【現在時刻】${hour}時（${timeLabel}）`);
  lines.push('');

  // --- 環境 ---
  lines.push('【今日の環境】');
  lines.push(`天気: ${env.weather.weatherLabel}、気温${env.weather.temperature}°C、湿度${env.weather.humidity}%`);
  const pressureDesc = env.weather.pressureChange <= -3 ? '急低下中'
    : env.weather.pressureChange <= -1 ? 'やや低下'
    : env.weather.pressureChange >= 3 ? '上昇中' : '安定';
  lines.push(`気圧: ${env.weather.pressure}hPa（前日比${env.weather.pressureChange > 0 ? '+' : ''}${env.weather.pressureChange}hPa、${pressureDesc}）`);
  lines.push(`月齢: ${env.moon.phase}（満月まで${env.moon.daysUntilFull}日）`);
  lines.push(`季節: ${env.season}`);

  // --- HealthKit / ヘルスログ ---
  if (recent?.todayHealthKit) {
    const h = recent.todayHealthKit;
    lines.push('');
    lines.push('【今日の身体データ（HealthKit）】');
    if (h.sleepHours != null) lines.push(`睡眠: ${h.sleepHours}時間`);
    if (h.avgHRV != null) lines.push(`HRV: ${h.avgHRV}ms${h.avgHRV < 30 ? '（低い＝ストレス反応性が高い）' : h.avgHRV > 50 ? '（良好）' : ''}`);
    if (h.avgHeartRate != null) lines.push(`平均心拍: ${h.avgHeartRate}bpm`);
    if (h.steps != null) lines.push(`歩数: ${h.steps.toLocaleString()}歩`);
    if (h.activeCalories != null) lines.push(`消費カロリー: ${h.activeCalories}kcal`);
    if (h.exerciseMinutes != null) lines.push(`運動時間: ${h.exerciseMinutes}分`);
  } else if (recent?.healthLogs && recent.healthLogs.length > 0) {
    lines.push('');
    lines.push('【直近のヘルスデータ】');
    recent.healthLogs.slice(0, 3).forEach(log => {
      const parts = [`${log.date}:`];
      if (log.sleepHours != null) parts.push(`睡眠${log.sleepHours}h`);
      if (log.steps != null) parts.push(`${log.steps.toLocaleString()}歩`);
      if (log.exerciseMinutes != null) parts.push(`運動${log.exerciseMinutes}分`);
      if (parts.length > 1) lines.push(parts.join(' '));
    });
  }

  // --- 直近のセッション履歴 ---
  if (recent?.recentSessions && recent.recentSessions.length > 0) {
    lines.push('');
    lines.push('【直近の瞑想セッション】');
    const bodyLabel = (v: string) => v === '1' ? '軽い' : v === '2' ? 'ふつう' : '重い';
    const mindLabel = (v: string) => v === '1' ? '軽い' : v === '2' ? 'ふつう' : '重い';
    const breathLabel2 = (v: string) => v === '1' ? '浅い' : v === '2' ? 'ふつう' : '深い';
    recent.recentSessions.slice(0, 3).forEach(s => {
      const date = s.timestamp.split('T')[0];
      const parts = [date];
      if (s.body) parts.push(`体:${bodyLabel(s.body)}`);
      if (s.mind) parts.push(`心:${mindLabel(s.mind)}`);
      if (s.breath) parts.push(`呼吸:${breathLabel2(s.breath)}`);
      if (s.meditationType) parts.push(`種類:${s.meditationType}`);
      if (s.actualDuration) parts.push(`${Math.round(s.actualDuration / 60)}分`);
      lines.push(parts.join(' / '));
    });
  }

  // --- 直近の食事 ---
  if (recent?.recentMeals && recent.recentMeals.length > 0) {
    lines.push('');
    lines.push('【直近の食事】');
    recent.recentMeals.slice(0, 2).forEach(m => {
      lines.push(`${m.mealName}: 抗炎症${m.antiInflammation}/5、血糖安定${m.bloodSugarStability}/5、総合${m.overallScore}/5`);
    });
  }

  // --- カレンダーイベント（仕事・ストレス傾向） ---
  if (recent?.recentEvents && recent.recentEvents.length > 0) {
    lines.push('');
    lines.push('【直近の予定とストレス】');

    // 今日の予定
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = recent.recentEvents.filter(e => e.eventStart?.startsWith(today));
    const pastEvents = recent.recentEvents.filter(e => !e.eventStart?.startsWith(today));

    if (todayEvents.length > 0) {
      lines.push(`今日の予定: ${todayEvents.length}件`);
      todayEvents.slice(0, 3).forEach(e => {
        const time = e.eventStart?.split('T')[1]?.substring(0, 5) || '';
        const stressLabel = e.stressScore != null && e.stressScore >= 4 ? '(高ストレス)' : e.stressScore != null && e.stressScore >= 3 ? '(中ストレス)' : '';
        lines.push(`  ${time} ${e.eventSummary} ストレス${e.stressScore ?? '?'}/5 ${stressLabel}`);
      });
    }

    if (pastEvents.length > 0) {
      const highStressCount = pastEvents.filter(e => e.stressScore != null && e.stressScore >= 4).length;
      const avgStress = pastEvents.reduce((s, e) => s + (e.stressScore ?? 0), 0) / pastEvents.length;
      lines.push(`直近の予定: ${pastEvents.length}件、平均ストレス${avgStress.toFixed(1)}/5、高ストレス(4以上)${highStressCount}件`);

      // 仕事の負荷パターン
      const workEvents = pastEvents.filter(e => e.relationships?.includes('work'));
      if (workEvents.length > 0) {
        const workAvgStress = workEvents.reduce((s, e) => s + (e.stressScore ?? 0), 0) / workEvents.length;
        lines.push(`  仕事関連: ${workEvents.length}件、平均ストレス${workAvgStress.toFixed(1)}/5`);
      }
    }
  }

  // --- 個人プロファイル ---
  if (profile && profile.dataPoints >= 7) {
    lines.push('');
    lines.push('【この人の環境感受性（過去データから算出）】');
    if (Math.abs(profile.pressureSensitivity) > 0.2) {
      lines.push(`気圧感受性: ${profile.pressureSensitivity > 0 ? '敏感' : '鈍感'}（${profile.pressureSensitivity.toFixed(2)}）`);
    }
    if (Math.abs(profile.humiditySensitivity) > 0.2) {
      lines.push(`湿度感受性: ${profile.humiditySensitivity > 0 ? '敏感' : '鈍感'}（${profile.humiditySensitivity.toFixed(2)}）`);
    }
  }

  // --- 判定済みリスク要因 ---
  if (factors && factors.length > 0) {
    lines.push('');
    lines.push(`【検出されたリスク要因】${factors.join('、')}`);
  }

  return lines.join('\n');
}

/**
 * りなわんコメント用: 環境コンテキスト文字列（軽量版）
 */
export function buildEnvironmentContext(
  env: EnvironmentData,
  forecast?: BodyForecast,
): string {
  const lines: string[] = [];

  lines.push(`天気: ${env.weather.weatherLabel}、気温${env.weather.temperature}°C、湿度${env.weather.humidity}%`);

  const pressureDesc = env.weather.pressureChange <= -3 ? '急低下中'
    : env.weather.pressureChange <= -1 ? 'やや低下'
    : env.weather.pressureChange >= 3 ? '上昇中' : '安定';
  lines.push(`気圧: ${env.weather.pressure}hPa（前日比${env.weather.pressureChange > 0 ? '+' : ''}${env.weather.pressureChange}hPa、${pressureDesc}）`);
  lines.push(`月齢: ${env.moon.phase}（満月まで${env.moon.daysUntilFull}日）`);
  lines.push(`季節: ${env.season}`);

  if (forecast) {
    lines.push(`身体天気予報: ${forecast.label}`);
    if (forecast.factors.length > 0) {
      lines.push(`注意要因: ${forecast.factors.join('、')}`);
    }
  }

  return lines.join('\n');
}

// ========================================
// ユーティリティ
// ========================================

/** ピアソン相関係数 */
function correlate(pairs: { x: number; y: number }[]): number {
  const n = pairs.length;
  if (n < 3) return 0;

  const sumX = pairs.reduce((s, p) => s + p.x, 0);
  const sumY = pairs.reduce((s, p) => s + p.y, 0);
  const sumXY = pairs.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pairs.reduce((s, p) => s + p.x * p.x, 0);
  const sumY2 = pairs.reduce((s, p) => s + p.y * p.y, 0);

  const denom = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
