/**
 * 即時インサイトエンジン（ルールベース）
 *
 * AIを使わずに0.2秒以内で「今日の状態ラベル」と「根拠」を生成する。
 * トップ画面の即時表示レイヤーに使用。
 */

import type { EnvironmentData } from './weather';
import { assessEnvironmentRisk } from './weather';
import type { SessionLog, DailyHealthLog } from './api';

// ========================================
// 型定義
// ========================================

export type StatusLevel = 'good' | 'caution' | 'warning' | 'rest';

export interface InstantInsight {
  /** 状態ラベル（一言） */
  label: string;
  /** 状態レベル */
  level: StatusLevel;
  /** 短い一言メッセージ */
  message: string;
  /** 根拠リスト（最大3つ） */
  factors: string[];
  /** アイコン */
  emoji: string;
  /** 環境サマリー（天気・気温・気圧） */
  envSummary: string | null;
}

export interface SubjectiveInput {
  body: number;    // 1=軽い, 2=ふつう, 3=重い
  mind: number;    // 1=軽い, 2=ふつう, 3=重い
  breath: number; // 1=浅い, 2=ふつう, 3=深い
}

// ========================================
// ユーティリティ
// ========================================

/** 日付文字列を「今日」「昨日」「N日前」に変換 */
function formatRelativeDate(dateStr: string): string {
  const today = new Date();
  const target = new Date(dateStr);
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const targetDateStr = dateStr.split('T')[0];

  if (targetDateStr === todayStr) return '今日';
  if (targetDateStr === yesterdayStr) return '昨日';

  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return `${diffDays}日前`;
  return targetDateStr; // 古いデータはそのまま日付表示
}

// ========================================
// メイン関数
// ========================================

/**
 * 環境データ + 直近データから即時インサイトを生成（ルールベース）
 */
export function generateInstantInsight(
  env: EnvironmentData | null,
  recentSessions?: SessionLog[],
  recentHealthLogs?: DailyHealthLog[],
): InstantInsight {
  let score = 0; // 高いほど注意が必要
  const factors: string[] = [];

  // --- 環境サマリー ---
  let envSummary: string | null = null;
  if (env) {
    const pressureArrow = env.weather.pressureChange <= -3 ? ' ↓'
      : env.weather.pressureChange <= -1 ? ' ↘'
      : env.weather.pressureChange >= 3 ? ' ↑'
      : env.weather.pressureChange >= 1 ? ' ↗'
      : '';
    envSummary = `${env.weather.weatherLabel} ${env.weather.temperature}°C / 湿度${env.weather.humidity}% / ${env.weather.pressure}hPa${pressureArrow}`;
  }

  // --- 環境リスク ---
  if (env) {
    const risk = assessEnvironmentRisk(env);
    if (risk.level === 'high') {
      score += 3;
      factors.push(...risk.factors.slice(0, 2));
    } else if (risk.level === 'moderate') {
      score += 1;
      if (risk.factors.length > 0) factors.push(risk.factors[0]);
    }

    // 気圧の急低下
    if (env.weather.pressureChange <= -5) {
      score += 2;
      if (!factors.some(f => f.includes('気圧'))) {
        factors.push('気圧が急低下中');
      }
    } else if (env.weather.pressureChange <= -3) {
      score += 1;
      if (!factors.some(f => f.includes('気圧'))) {
        factors.push('気圧がやや低下');
      }
    }

    // 高湿度
    if (env.weather.humidity > 80) {
      score += 1;
      factors.push('湿度が高め');
    }
  }

  // --- 直近のヘルスログ（日付つき） ---
  if (recentHealthLogs && recentHealthLogs.length > 0) {
    const latest = recentHealthLogs[0];
    const when = formatRelativeDate(latest.date);
    if (latest.sleepHours != null && latest.sleepHours < 6) {
      score += 2;
      factors.push(`${when}の睡眠 ${latest.sleepHours}時間（不足）`);
    } else if (latest.sleepHours != null && latest.sleepHours < 7) {
      score += 1;
      factors.push(`${when}の睡眠 ${latest.sleepHours}時間（やや短め）`);
    }

    // 3日間の睡眠傾向
    if (recentHealthLogs.length >= 3) {
      const logsWithSleep = recentHealthLogs
        .slice(0, 3)
        .filter(l => l.sleepHours != null);
      if (logsWithSleep.length >= 2) {
        const avgSleep = logsWithSleep.reduce((sum, l) => sum + (l.sleepHours ?? 0), 0) / logsWithSleep.length;
        if (avgSleep < 6) {
          score += 1;
          factors.push(`直近${logsWithSleep.length}日の平均睡眠が不足`);
        }
      }
    }
  }

  // --- 直近セッション（日付つき） ---
  if (recentSessions && recentSessions.length > 0) {
    const last = recentSessions[0];
    const when = formatRelativeDate(last.timestamp);
    if (last.body === '3' && last.mind === '3') {
      score += 2;
      factors.push(`${when}のセッション：からだもこころも重い`);
    } else if (last.body === '3') {
      score += 1;
      factors.push(`${when}のセッション：からだが重い`);
    } else if (last.mind === '3') {
      score += 1;
      factors.push(`${when}のセッション：こころが重い`);
    }
    if (last.breath === '1') {
      score += 1;
      factors.push(`${when}のセッション：呼吸が浅い`);
    }
  }

  // --- レベル＆ラベル決定 ---
  const trimmedFactors = factors.slice(0, 3);

  if (score >= 5) {
    return {
      label: '休息モード',
      level: 'rest',
      message: '無理しない日にしましょう',
      factors: trimmedFactors,
      emoji: '🌧️',
      envSummary,
    };
  }
  if (score >= 3) {
    return {
      label: '注意ぎみ',
      level: 'warning',
      message: '刺激を減らした方がよさそうです',
      factors: trimmedFactors,
      emoji: '☁️',
      envSummary,
    };
  }
  if (score >= 1) {
    return {
      label: 'まずまず',
      level: 'caution',
      message: '少しだけ気をつけて過ごしましょう',
      factors: trimmedFactors,
      emoji: '⛅',
      envSummary,
    };
  }

  return {
    label: '安定',
    level: 'good',
    message: '穏やかな日です',
    factors: trimmedFactors.length > 0 ? trimmedFactors : ['特に注意する要因はありません'],
    emoji: '☀️',
    envSummary,
  };
}

/**
 * 主観入力（body/mind/breath）から即時フィードバックを生成
 */
export function getSubjectiveFeedback(input: SubjectiveInput): string {
  const { body, mind, breath } = input;

  // 全部未選択
  if (body === 0 && mind === 0 && breath === 0) {
    return '今の自分を感じてみましょう';
  }

  // 重い状態の数をカウント
  const heavyCount = (body === 3 ? 1 : 0) + (mind === 3 ? 1 : 0) + (breath === 1 ? 1 : 0);
  const lightCount = (body === 1 ? 1 : 0) + (mind === 1 ? 1 : 0) + (breath === 3 ? 1 : 0);

  if (heavyCount >= 3) {
    return '疲労が溜まっているかもしれません。今日はゆっくり過ごしましょう';
  }
  if (heavyCount >= 2) {
    return '少し重めの状態ですね。無理しないでいきましょう';
  }
  if (body === 3 && breath === 1) {
    return 'からだの重さと呼吸の浅さ、両方感じているんですね';
  }
  if (mind === 3 && breath === 1) {
    return 'こころが重く、呼吸も浅い状態。静かな時間が助けになります';
  }
  if (body === 3) {
    return 'からだが重いと感じているんですね';
  }
  if (mind === 3) {
    return 'こころが重めですね。そのまま気づいていられるのが大事です';
  }
  if (breath === 1) {
    return '呼吸が浅いと感じているんですね。ゆっくり深呼吸してみましょう';
  }
  if (lightCount >= 3) {
    return 'いい状態ですね。トレーニングの効果が出やすい日です';
  }
  if (lightCount >= 2) {
    return '比較的軽やかな状態ですね';
  }

  return '';
}
