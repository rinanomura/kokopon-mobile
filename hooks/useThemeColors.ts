import { usePreferences } from './usePreferences';

// テーマカラーの型定義
export interface ThemeColors {
  // グラデーション背景
  gradientStart: string;
  gradientEnd: string;
  // アクセントカラー
  accent: string;
  accentLight: string;
  // カード/セクション背景
  card: string;
  cardBorder: string;
  // テキスト
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // 吹き出し
  bubbleBg: readonly [string, string, string];
  bubbleBorder: string;
  bubbleShadow: string;
  // タブバー
  tabBarBg: string;
  tabBarActive: string;
  tabBarInactive: string;
  // ボタン
  buttonGradientStart: string;
  buttonGradientEnd: string;
  buttonShadow: string;
  // 選択ボタン
  selectorBg: string;
  selectorBorder: string;
  selectorSelectedBg: string;
  selectorSelectedBorder: string;
  selectorSelectedText: string;
  // タイトル装飾
  titleBg: readonly [string, string, string];
  titleBorder: string;
  titleDecor: string;
  // スパークル
  sparkleColor: string;
  // マスコット表示
  showMascot: boolean;
  // StatusBar
  statusBarStyle: 'dark-content' | 'light-content';
  // モーダル
  modalBg: string;
  // ジャーニーマップ
  journeyGradient: readonly [string, string];
  journeyBorder: string;
  journeyDotInactive: string;
  journeyDotActive: string;
  journeyDotToday: string;
  journeyLine: string;
  // 統計値
  statValueColor: string;
  // 進捗リング
  progressRingBg: string;
  progressRingFill: string;
  timerCircleBg: string;
}

const CUTE_COLORS: ThemeColors = {
  gradientStart: '#7AD7F0',
  gradientEnd: '#CDECF6',
  accent: '#FF85A2',
  accentLight: '#FFB6C1',
  card: 'rgba(255, 255, 255, 0.9)',
  cardBorder: 'rgba(255, 182, 193, 0.3)',
  textPrimary: '#4A5568',
  textSecondary: '#718096',
  textMuted: '#A0AEC0',
  bubbleBg: ['#FFF5F7', '#FFFFFF', '#FFF0F5'],
  bubbleBorder: 'rgba(255, 182, 193, 0.5)',
  bubbleShadow: '#FFB6C1',
  tabBarBg: '#FFFFFF',
  tabBarActive: '#FF85A2',
  tabBarInactive: '#A0AEC0',
  buttonGradientStart: '#FF85A2',
  buttonGradientEnd: '#FFB6C1',
  buttonShadow: '#FF85A2',
  selectorBg: 'rgba(255, 255, 255, 0.8)',
  selectorBorder: 'rgba(255, 182, 193, 0.3)',
  selectorSelectedBg: '#FF85A2',
  selectorSelectedBorder: '#FF85A2',
  selectorSelectedText: '#FFFFFF',
  titleBg: ['rgba(255,240,245,0.95)', 'rgba(255,255,255,0.95)', 'rgba(255,240,245,0.95)'],
  titleBorder: 'rgba(255, 182, 193, 0.5)',
  titleDecor: '#FF85A2',
  sparkleColor: '#FF69B4',
  showMascot: true,
  statusBarStyle: 'dark-content',
  modalBg: '#FFFFFF',
  journeyGradient: ['rgba(255,255,255,0.95)', 'rgba(255,240,245,0.9)'],
  journeyBorder: 'rgba(255, 182, 193, 0.4)',
  journeyDotInactive: 'rgba(255, 182, 193, 0.3)',
  journeyDotActive: '#FF85A2',
  journeyDotToday: '#FF85A2',
  journeyLine: 'rgba(255, 182, 193, 0.3)',
  statValueColor: '#FF85A2',
  progressRingBg: 'rgba(255, 182, 193, 0.3)',
  progressRingFill: '#FF85A2',
  timerCircleBg: 'rgba(255, 255, 255, 0.8)',
};

const SIMPLE_COLORS: ThemeColors = {
  gradientStart: '#1A2744',
  gradientEnd: '#2D3A5C',
  accent: '#C8A96E',
  accentLight: '#D4BA82',
  card: 'rgba(255, 255, 255, 0.08)',
  cardBorder: 'rgba(200, 169, 110, 0.2)',
  textPrimary: '#E2E8F0',
  textSecondary: '#A0AEC0',
  textMuted: '#718096',
  bubbleBg: ['rgba(45, 58, 92, 0.95)', 'rgba(35, 48, 78, 0.95)', 'rgba(45, 58, 92, 0.95)'],
  bubbleBorder: 'rgba(200, 169, 110, 0.3)',
  bubbleShadow: 'rgba(0, 0, 0, 0.3)',
  tabBarBg: '#1A2744',
  tabBarActive: '#C8A96E',
  tabBarInactive: '#5A6B7C',
  buttonGradientStart: '#C8A96E',
  buttonGradientEnd: '#D4BA82',
  buttonShadow: 'rgba(200, 169, 110, 0.4)',
  selectorBg: 'rgba(255, 255, 255, 0.06)',
  selectorBorder: 'rgba(200, 169, 110, 0.15)',
  selectorSelectedBg: '#C8A96E',
  selectorSelectedBorder: '#C8A96E',
  selectorSelectedText: '#1A2744',
  titleBg: ['rgba(45, 58, 92, 0.9)', 'rgba(35, 48, 78, 0.9)', 'rgba(45, 58, 92, 0.9)'],
  titleBorder: 'rgba(200, 169, 110, 0.3)',
  titleDecor: '#C8A96E',
  sparkleColor: '#C8A96E',
  showMascot: false,
  statusBarStyle: 'light-content',
  modalBg: '#2D3A5C',
  journeyGradient: ['rgba(45, 58, 92, 0.95)', 'rgba(35, 48, 78, 0.9)'],
  journeyBorder: 'rgba(200, 169, 110, 0.3)',
  journeyDotInactive: 'rgba(200, 169, 110, 0.2)',
  journeyDotActive: '#C8A96E',
  journeyDotToday: '#C8A96E',
  journeyLine: 'rgba(200, 169, 110, 0.2)',
  statValueColor: '#C8A96E',
  progressRingBg: 'rgba(200, 169, 110, 0.2)',
  progressRingFill: '#C8A96E',
  timerCircleBg: 'rgba(255, 255, 255, 0.08)',
};

/**
 * 現在のデザインテーマに応じたカラーパレットを返す
 */
export function useThemeColors(): ThemeColors {
  const { designTheme } = usePreferences();
  return designTheme === 'simple' ? SIMPLE_COLORS : CUTE_COLORS;
}

// テーマ別テキストの型
export interface ThemeTexts {
  homeTitle: string;
  homeBubbleDefault: string;
  timeSelectTitle: string;
  modeSelectTitle: string;
  breathingHint: string;
  completionMessage: string;
  reminderHint: string;
}

const CUTE_TEXTS: ThemeTexts = {
  homeTitle: '今の状態を教えてね！',
  homeBubbleDefault: '準備ができたら\n始めよう！',
  timeSelectTitle: '時間を選んでね',
  modeSelectTitle: 'モードを選んでね',
  breathingHint: 'りなわんと一緒に\nゆっくり呼吸してみよう',
  completionMessage: 'おつかれさま！',
  reminderHint: 'りなわんが毎日お知らせします',
};

const SIMPLE_TEXTS: ThemeTexts = {
  homeTitle: '今の状態を教えてください',
  homeBubbleDefault: '準備ができたら\n始めましょう',
  timeSelectTitle: '時間を選んでください',
  modeSelectTitle: 'モードを選んでください',
  breathingHint: 'ゆっくり呼吸してみましょう',
  completionMessage: 'おつかれさまでした',
  reminderHint: '毎日お知らせします',
};

/**
 * 現在のデザインテーマに応じたテキストを返す
 */
export function useThemeTexts(): ThemeTexts {
  const { designTheme } = usePreferences();
  return designTheme === 'simple' ? SIMPLE_TEXTS : CUTE_TEXTS;
}
