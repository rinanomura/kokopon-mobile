import { useState, useEffect, useCallback } from 'react';
import { Platform, NativeModules } from 'react-native';

// ネイティブモジュールが実際にリンクされているか事前チェック
const isHealthKitNativeAvailable = Platform.OS === 'ios' && !!NativeModules.ReactNativeHealthkit;

/**
 * ワークアウトの要約データ
 */
export interface WorkoutSummary {
  activityType: number;
  activityName: string;
  durationMinutes: number;
  totalEnergyBurned?: number; // kcal
  totalDistance?: number; // m
  startDate: Date;
  endDate: Date;
}

/**
 * 日別ヘルスデータの型定義
 */
export interface DailyHealthData {
  date: string; // YYYY-MM-DD
  avgHeartRate?: number;
  avgHRV?: number;
  sleepHours?: number;
  steps?: number;
  activeCalories?: number; // kcal
  exerciseMinutes?: number;
  workouts?: WorkoutSummary[];
}

/**
 * useHealthKit の返り値
 */
interface UseHealthKitResult {
  healthData: DailyHealthData[];
  isAvailable: boolean;
  isAuthorized: boolean;
  loading: boolean;
  requestAuthorization: () => Promise<void>;
  fetchHealthData: (days?: number) => Promise<void>;
}

/**
 * ワークアウトの種類を日本語名に変換
 */
const WORKOUT_ACTIVITY_NAMES: Record<number, string> = {
  1: 'アメリカンフットボール',
  2: 'アーチェリー',
  3: 'オーストラリアンフットボール',
  4: 'バドミントン',
  5: '野球',
  6: 'バスケットボール',
  7: 'ボウリング',
  8: 'ボクシング',
  9: 'クライミング',
  10: 'クリケット',
  11: 'クロストレーニング',
  12: 'カーリング',
  13: 'サイクリング',
  14: 'ダンス',
  16: 'エリプティカル',
  17: '乗馬',
  18: 'フェンシング',
  19: '釣り',
  20: '筋トレ',
  21: 'ゴルフ',
  22: '体操',
  23: 'ハンドボール',
  24: 'ハイキング',
  25: 'ホッケー',
  26: 'ハンティング',
  27: 'ラクロス',
  28: '格闘技',
  29: 'マインドフルネス',
  31: 'パドルスポーツ',
  32: '遊び',
  33: 'ウォーミングアップ',
  34: 'ラケットボール',
  35: 'ローイング',
  36: 'ラグビー',
  37: 'ランニング',
  38: 'セーリング',
  39: 'スケート',
  40: 'スノースポーツ',
  41: 'サッカー',
  42: 'ソフトボール',
  43: 'スカッシュ',
  44: '階段上り',
  45: 'サーフィン',
  46: '水泳',
  47: '卓球',
  48: 'テニス',
  49: 'トラック&フィールド',
  50: 'ウエイトトレーニング',
  51: 'バレーボール',
  52: 'ウォーキング',
  53: '水中フィットネス',
  54: '水球',
  55: 'ウォータースポーツ',
  56: 'レスリング',
  57: 'ヨガ',
  58: 'バレエ',
  59: 'コアトレーニング',
  60: 'クロスカントリースキー',
  61: 'ダウンヒルスキー',
  62: '柔軟体操',
  63: 'HIIT',
  64: 'ジャンプロープ',
  65: 'キックボクシング',
  66: 'ピラティス',
  67: 'スノーボード',
  68: '階段マシン',
  69: 'ステップトレーニング',
  70: '車椅子ウォーク',
  71: '車椅子ラン',
  72: 'タイチー',
  73: 'ミックスカーディオ',
  74: 'ハンドサイクリング',
  75: 'ディスクスポーツ',
  76: 'フィットネスゲーム',
  77: 'カーディオダンス',
  78: 'ソーシャルダンス',
  79: 'ピックルボール',
  80: 'クールダウン',
  82: 'トライアスロン',
  83: 'トランジション',
  84: 'ダイビング',
  3000: 'その他',
};

function getWorkoutActivityName(type: number): string {
  return WORKOUT_ACTIVITY_NAMES[type] || `ワークアウト(${type})`;
}

// HealthKitモジュールを動的にrequire
function getHealthKit(): typeof import('@kingstinct/react-native-healthkit') | null {
  if (!isHealthKitNativeAvailable) return null;
  try {
    return require('@kingstinct/react-native-healthkit');
  } catch (error) {
    console.log('HealthKit module not available:', error);
    return null;
  }
}

/**
 * HealthKitから HRV・心拍・睡眠・ワークアウト・歩数・カロリー・運動時間を取得するhook
 * iOS以外ではフォールバック（空データ）を返す
 *
 * @kingstinct/react-native-healthkit v8.x API を使用
 */
export function useHealthKit(): UseHealthKitResult {
  const [healthData, setHealthData] = useState<DailyHealthData[]>([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  // 利用可能チェック
  useEffect(() => {
    if (!isHealthKitNativeAvailable) return;

    const checkAvailability = async () => {
      try {
        const HK = getHealthKit();
        if (!HK) return;

        const available = await HK.default.isHealthDataAvailable();
        setIsAvailable(available);
      } catch (error) {
        console.log('HealthKit availability check failed:', error);
      }
    };

    checkAvailability();
  }, []);

  const requestAuthorization = useCallback(async () => {
    if (!isHealthKitNativeAvailable) return;
    const HK = getHealthKit();
    if (!HK || !isAvailable) return;

    try {
      const { HKQuantityTypeIdentifier, HKCategoryTypeIdentifier } = HK;

      // 読み取り権限のリスト
      const readPermissions: string[] = [
        HKQuantityTypeIdentifier.heartRate,
        HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
        HKCategoryTypeIdentifier.sleepAnalysis,
        HKQuantityTypeIdentifier.stepCount,
        HKQuantityTypeIdentifier.activeEnergyBurned,
        HKQuantityTypeIdentifier.appleExerciseTime,
      ];

      // ワークアウト権限を追加（ライブラリがexportしていれば使う）
      if ((HK as any).HKWorkoutTypeIdentifier) {
        readPermissions.push((HK as any).HKWorkoutTypeIdentifier);
      }

      await HK.default.requestAuthorization(
        readPermissions as any[],
        [] // write permissions (none)
      );

      // iOSではrequestAuthorizationは拒否でもエラーにならない
      // 実際にデータが取れるかで判断するため、試しにfetchしてみる
      setIsAuthorized(true);

      console.log('HealthKit authorization requested successfully');
    } catch (error) {
      console.error('HealthKit authorization failed:', error);
    }
  }, [isAvailable]);

  const fetchHealthData = useCallback(async (days: number = 30) => {
    if (!isHealthKitNativeAvailable) return;
    const HK = getHealthKit();
    if (!HK || !isAvailable) return;

    setLoading(true);
    try {
      const { HKQuantityTypeIdentifier, HKCategoryTypeIdentifier } = HK;
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // 日別のデータを格納するMap
      const dataByDate = new Map<string, {
        heartRates: number[];
        hrvValues: number[];
        sleepMinutes: number;
        steps: number;
        activeCalories: number;
        exerciseMinutes: number;
        workouts: WorkoutSummary[];
      }>();

      // 初期化（全日付分）
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = d.toISOString().split('T')[0];
        dataByDate.set(dateKey, {
          heartRates: [],
          hrvValues: [],
          sleepMinutes: 0,
          steps: 0,
          activeCalories: 0,
          exerciseMinutes: 0,
          workouts: [],
        });
      }

      // 心拍数を取得
      try {
        const heartRateSamples = await HK.default.queryQuantitySamples(
          HKQuantityTypeIdentifier.heartRate,
          { from: startDate, to: now }
        );
        heartRateSamples.forEach((sample: { startDate: Date; quantity: number }) => {
          const dateKey = new Date(sample.startDate).toISOString().split('T')[0];
          const entry = dataByDate.get(dateKey);
          if (entry) {
            entry.heartRates.push(sample.quantity);
          }
        });
      } catch (error) {
        console.log('Failed to fetch heart rate:', error);
      }

      // HRVを取得
      try {
        const hrvSamples = await HK.default.queryQuantitySamples(
          HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
          { from: startDate, to: now }
        );
        hrvSamples.forEach((sample: { startDate: Date; quantity: number }) => {
          const dateKey = new Date(sample.startDate).toISOString().split('T')[0];
          const entry = dataByDate.get(dateKey);
          if (entry) {
            entry.hrvValues.push(sample.quantity);
          }
        });
      } catch (error) {
        console.log('Failed to fetch HRV:', error);
      }

      // 睡眠データを取得
      try {
        const sleepSamples = await HK.default.queryCategorySamples(
          HKCategoryTypeIdentifier.sleepAnalysis,
          { from: startDate, to: now }
        );
        sleepSamples.forEach((sample: { startDate: Date; endDate: Date; value: number }) => {
          // value >= 1: InBed以上の睡眠状態
          if (sample.value >= 1) {
            const sampleStart = new Date(sample.startDate);
            const sampleEnd = new Date(sample.endDate);
            const minutes = (sampleEnd.getTime() - sampleStart.getTime()) / (1000 * 60);
            // 睡眠の終了日をキーにする（翌朝起きた日）
            const dateKey = sampleEnd.toISOString().split('T')[0];
            const entry = dataByDate.get(dateKey);
            if (entry) {
              entry.sleepMinutes += minutes;
            }
          }
        });
      } catch (error) {
        console.log('Failed to fetch sleep data:', error);
      }

      // 歩数を取得
      try {
        const stepSamples = await HK.default.queryQuantitySamples(
          HKQuantityTypeIdentifier.stepCount,
          { from: startDate, to: now }
        );
        stepSamples.forEach((sample: { startDate: Date; quantity: number }) => {
          const dateKey = new Date(sample.startDate).toISOString().split('T')[0];
          const entry = dataByDate.get(dateKey);
          if (entry) {
            entry.steps += sample.quantity;
          }
        });
      } catch (error) {
        console.log('Failed to fetch step count:', error);
      }

      // 消費カロリーを取得
      try {
        const calorieSamples = await HK.default.queryQuantitySamples(
          HKQuantityTypeIdentifier.activeEnergyBurned,
          { from: startDate, to: now }
        );
        calorieSamples.forEach((sample: { startDate: Date; quantity: number }) => {
          const dateKey = new Date(sample.startDate).toISOString().split('T')[0];
          const entry = dataByDate.get(dateKey);
          if (entry) {
            entry.activeCalories += sample.quantity;
          }
        });
      } catch (error) {
        console.log('Failed to fetch active energy:', error);
      }

      // 運動時間を取得
      try {
        const exerciseSamples = await HK.default.queryQuantitySamples(
          HKQuantityTypeIdentifier.appleExerciseTime,
          { from: startDate, to: now }
        );
        exerciseSamples.forEach((sample: { startDate: Date; quantity: number }) => {
          const dateKey = new Date(sample.startDate).toISOString().split('T')[0];
          const entry = dataByDate.get(dateKey);
          if (entry) {
            entry.exerciseMinutes += sample.quantity;
          }
        });
      } catch (error) {
        console.log('Failed to fetch exercise time:', error);
      }

      // ワークアウトを取得
      try {
        const workoutSamples = await HK.default.queryWorkoutSamples({
          from: startDate,
          to: now,
        });
        workoutSamples.forEach((workout: {
          startDate: Date;
          endDate: Date;
          workoutActivityType: number;
          duration: number;
          totalEnergyBurned?: { quantity: number };
          totalDistance?: { quantity: number };
        }) => {
          const dateKey = new Date(workout.startDate).toISOString().split('T')[0];
          const entry = dataByDate.get(dateKey);
          if (entry) {
            entry.workouts.push({
              activityType: workout.workoutActivityType,
              activityName: getWorkoutActivityName(workout.workoutActivityType),
              durationMinutes: Math.round(workout.duration / 60),
              totalEnergyBurned: workout.totalEnergyBurned
                ? Math.round(workout.totalEnergyBurned.quantity)
                : undefined,
              totalDistance: workout.totalDistance
                ? Math.round(workout.totalDistance.quantity)
                : undefined,
              startDate: new Date(workout.startDate),
              endDate: new Date(workout.endDate),
            });
          }
        });
      } catch (error) {
        console.log('Failed to fetch workouts:', error);
      }

      // 集計結果をDailyHealthData配列に変換
      const result: DailyHealthData[] = [];
      dataByDate.forEach((data, date) => {
        const entry: DailyHealthData = { date };

        if (data.heartRates.length > 0) {
          entry.avgHeartRate = Math.round(
            data.heartRates.reduce((a, b) => a + b, 0) / data.heartRates.length
          );
        }

        if (data.hrvValues.length > 0) {
          entry.avgHRV = Math.round(
            data.hrvValues.reduce((a, b) => a + b, 0) / data.hrvValues.length
          );
        }

        if (data.sleepMinutes > 0) {
          entry.sleepHours = Math.round((data.sleepMinutes / 60) * 10) / 10;
        }

        if (data.steps > 0) {
          entry.steps = Math.round(data.steps);
        }

        if (data.activeCalories > 0) {
          entry.activeCalories = Math.round(data.activeCalories);
        }

        if (data.exerciseMinutes > 0) {
          entry.exerciseMinutes = Math.round(data.exerciseMinutes);
        }

        if (data.workouts.length > 0) {
          entry.workouts = data.workouts;
        }

        result.push(entry);
      });

      // 日付順にソート
      result.sort((a, b) => a.date.localeCompare(b.date));
      setHealthData(result);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAvailable]);

  return {
    healthData,
    isAvailable,
    isAuthorized,
    loading,
    requestAuthorization,
    fetchHealthData,
  };
}
