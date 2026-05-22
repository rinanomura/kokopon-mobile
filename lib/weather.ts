/**
 * 気象データ取得（Open-Meteo API）+ 月齢計算
 * APIキー不要・完全無料
 */

// ========================================
// 型定義
// ========================================

export interface CurrentWeather {
  temperature: number;       // °C
  humidity: number;          // %
  pressure: number;          // hPa
  pressureChange: number;    // 前日比 hPa（負=低気圧接近）
  weatherCode: number;       // WMO天気コード
  weatherLabel: string;      // 天気の日本語ラベル
  uvIndex: number;
  windSpeed: number;         // km/h
}

export interface MoonPhaseInfo {
  phase: string;             // 月相の名前
  illumination: number;      // 輝面比 0-1
  daysUntilFull: number;     // 満月まであと何日
  emoji: string;
}

export interface EnvironmentData {
  weather: CurrentWeather;
  moon: MoonPhaseInfo;
  season: string;            // 春/夏/秋/冬
  timestamp: string;
}

// ========================================
// WMO天気コード → 日本語
// ========================================

const WEATHER_CODES: Record<number, string> = {
  0: '快晴',
  1: 'ほぼ晴れ',
  2: '一部曇り',
  3: '曇り',
  45: '霧',
  48: '着氷性の霧',
  51: '弱い霧雨',
  53: '霧雨',
  55: '強い霧雨',
  61: '弱い雨',
  63: '雨',
  65: '強い雨',
  71: '弱い雪',
  73: '雪',
  75: '強い雪',
  80: 'にわか雨',
  81: '強いにわか雨',
  82: '激しいにわか雨',
  95: '雷雨',
  96: '雷雨(ひょう)',
  99: '激しい雷雨(ひょう)',
};

function getWeatherLabel(code: number): string {
  return WEATHER_CODES[code] || '不明';
}

// ========================================
// Open-Meteo API
// ========================================

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<CurrentWeather> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: 'temperature_2m,relative_humidity_2m,surface_pressure,weather_code,wind_speed_10m',
    daily: 'surface_pressure_mean,uv_index_max',
    timezone: 'Asia/Tokyo',
    past_days: '1',
    forecast_days: '1',
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status}`);
  }

  const data = await response.json();

  const current = data.current;
  const daily = data.daily;

  // 前日の気圧 (past_days=1 なので index 0 が昨日)
  const yesterdayPressure = daily.surface_pressure_mean?.[0] ?? current.surface_pressure;
  const todayPressure = current.surface_pressure;
  const pressureChange = Math.round((todayPressure - yesterdayPressure) * 10) / 10;

  return {
    temperature: Math.round(current.temperature_2m * 10) / 10,
    humidity: Math.round(current.relative_humidity_2m),
    pressure: Math.round(todayPressure * 10) / 10,
    pressureChange,
    weatherCode: current.weather_code,
    weatherLabel: getWeatherLabel(current.weather_code),
    uvIndex: daily.uv_index_max?.[daily.uv_index_max.length - 1] ?? 0,
    windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
  };
}

// ========================================
// 月齢計算（天文学的近似）
// ========================================

const MOON_PHASES = [
  { name: '新月', emoji: '🌑' },
  { name: '三日月', emoji: '🌒' },
  { name: '上弦の月', emoji: '🌓' },
  { name: '十日夜の月', emoji: '🌔' },
  { name: '満月', emoji: '🌕' },
  { name: '十六夜の月', emoji: '🌖' },
  { name: '下弦の月', emoji: '🌗' },
  { name: '二十六夜の月', emoji: '🌘' },
] as const;

export function getMoonPhase(date: Date = new Date()): MoonPhaseInfo {
  // Conway's moon phase approximation
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  let r = year % 100;
  r %= 19;
  if (r > 9) r -= 19;
  r = ((r * 11) % 30) + month + day;
  if (month < 3) r += 2;
  r -= (year < 2000 ? 4 : 8.3);
  r = Math.floor(r + 0.5) % 30;
  if (r < 0) r += 30;

  // 月齢 r (0-29)
  const lunarAge = r;
  const illumination = Math.round((1 - Math.cos((lunarAge / 29.53) * 2 * Math.PI)) / 2 * 100) / 100;

  // 8相に分類
  const phaseIndex = Math.floor((lunarAge / 29.53) * 8) % 8;
  const phase = MOON_PHASES[phaseIndex];

  // 満月(月齢≈15)までの日数
  const daysUntilFull = lunarAge <= 15
    ? Math.round(15 - lunarAge)
    : Math.round(29.53 - lunarAge + 15);

  return {
    phase: phase.name,
    illumination,
    daysUntilFull,
    emoji: phase.emoji,
  };
}

// ========================================
// 季節判定
// ========================================

export function getSeason(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return '春';
  if (month >= 6 && month <= 8) return '夏';
  if (month >= 9 && month <= 11) return '秋';
  return '冬';
}

// ========================================
// 統合: 環境データ取得
// ========================================

export async function fetchEnvironmentData(
  latitude: number,
  longitude: number
): Promise<EnvironmentData> {
  const now = new Date();
  const weather = await fetchWeather(latitude, longitude);
  const moon = getMoonPhase(now);
  const season = getSeason(now);

  return {
    weather,
    moon,
    season,
    timestamp: now.toISOString(),
  };
}

// ========================================
// 環境リスク判定（ルールベース）
// ========================================

export interface EnvironmentRisk {
  level: 'low' | 'moderate' | 'high';
  factors: string[];
}

export function assessEnvironmentRisk(env: EnvironmentData): EnvironmentRisk {
  const factors: string[] = [];
  let riskScore = 0;

  // 気圧低下
  if (env.weather.pressureChange <= -5) {
    factors.push('急激な気圧低下');
    riskScore += 3;
  } else if (env.weather.pressureChange <= -2) {
    factors.push('気圧低下傾向');
    riskScore += 1;
  }

  // 低気圧（1013hPa未満）
  if (env.weather.pressure < 1005) {
    factors.push('低気圧');
    riskScore += 2;
  } else if (env.weather.pressure < 1010) {
    factors.push('やや低気圧');
    riskScore += 1;
  }

  // 高湿度
  if (env.weather.humidity > 80) {
    factors.push('高湿度');
    riskScore += 1;
  }

  // 寒暖差（季節外れの気温）
  if (env.season === '冬' && env.weather.temperature > 15) {
    factors.push('季節外れの暖かさ');
    riskScore += 1;
  }
  if (env.season === '夏' && env.weather.temperature > 33) {
    factors.push('猛暑');
    riskScore += 2;
  }

  // 満月前後
  if (env.moon.daysUntilFull <= 1) {
    factors.push('満月前後');
    riskScore += 1;
  }

  // 季節の変わり目（3,6,9,12月）
  const month = new Date().getMonth() + 1;
  if ([3, 4, 6, 9, 10, 12].includes(month)) {
    // 季節の変わり目は自律神経が乱れやすい
    // ただし常に出すのはうるさいので、他のリスクと合わさる時だけ
  }

  const level: EnvironmentRisk['level'] =
    riskScore >= 4 ? 'high' :
    riskScore >= 2 ? 'moderate' :
    'low';

  return { level, factors };
}
