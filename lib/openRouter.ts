/**
 * OpenRouter API クライアント
 * カレンダー予定のAI分類に使用
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

// モデル設定
const MODELS = {
  classification: 'anthropic/claude-3.5-haiku',  // 分類用（高速・低コスト）
  chat: 'openai/gpt-5.2-chat',                   // チャット用（高品質な対話）
  audio: 'openai/gpt-audio-mini',                // 音声チャット用（コスト効率）
  vision: 'anthropic/claude-sonnet-4.5', // Vision対応（食事写真分析）
};

// 分類結果の型定義
export interface EventClassification {
  participants: 'solo' | 'small' | 'large';
  relationships: Array<'family' | 'work' | 'friend' | 'stranger'> | null;
  format: 'online' | 'onsite';
  eventType: 'meeting' | 'presentation' | 'social' | 'task' | 'other';
  stressScore: 1 | 2 | 3 | 4 | 5;
}

export interface ClassifiedEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  classification: EventClassification;
}

/**
 * OpenRouter APIを呼び出してテキストを生成
 */
async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  model: 'classification' | 'chat' = 'classification'
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kokopon.app',
      'X-Title': 'Kokopon Mobile',
    },
    body: JSON.stringify({
      model: MODELS[model],
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: model === 'chat' ? 0.7 : 0.3,
      max_tokens: model === 'chat' ? 4000 : 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * カレンダーイベントを分類するためのシステムプロンプト
 */
const CLASSIFICATION_SYSTEM_PROMPT = `あなたはカレンダー予定を分析してストレス度合いを判定するアシスタントです。

予定のタイトルと詳細情報から、以下の形式でJSON配列を返してください。

各予定について:
- participants: "solo"(一人), "small"(2-4人), "large"(5人以上)
- relationships: 配列形式で複数選択可能。["family", "work", "friend", "stranger"]から該当するものを選択。一人の場合はnullまたは空配列[]
  - "family": 家族
  - "work": 仕事関係
  - "friend": 友人
  - "stranger": 初対面/知らない人
  - 例: 友人の紹介で初対面の人と会う → ["friend", "stranger"]
- format: "online"(オンライン/リモート), "onsite"(対面/現地)
- eventType: "meeting"(会議), "presentation"(発表/プレゼン), "social"(食事/交流), "task"(作業/タスク), "other"(その他)
- stressScore: 1-5の数値
  - 1: 非常にリラックス（趣味、休憩など）
  - 2: 低ストレス（家族との時間、友人との食事など）
  - 3: 中程度（通常の仕事ミーティングなど）
  - 4: やや高ストレス（重要な会議、締切のある作業など）
  - 5: 高ストレス（プレゼン、面接、初対面の大人数など）

判断のヒント:
- 「zoom」「meet」「teams」などはonline
- 「ランチ」「飲み」「食事」などはsocial
- 「1on1」「MTG」「会議」などはmeeting
- 「発表」「プレゼン」「面接」などはpresentation
- 一人の作業やタスクはsolo + task、relationshipsはnull

必ず有効なJSON配列のみを返してください。説明文は不要です。`;

/**
 * カレンダーイベントのリストを分類
 */
export async function classifyCalendarEvents(
  events: Array<{ id: string; summary: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }>
): Promise<ClassifiedEvent[]> {
  if (events.length === 0) {
    return [];
  }

  // バッチサイズ（大量イベントでAI出力が切れるのを防ぐ）
  const BATCH_SIZE = 10;
  const allResults: ClassifiedEvent[] = [];

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batchEvents = events.slice(i, i + BATCH_SIZE);
    const batchResults = await classifyBatch(batchEvents, i);
    allResults.push(...batchResults);
  }

  return allResults;
}

async function classifyBatch(
  events: Array<{ id: string; summary: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }>,
  baseIndex: number
): Promise<ClassifiedEvent[]> {
  // イベント情報を整形
  const eventList = events.map((event, index) => ({
    index: baseIndex + index,
    id: event.id,
    summary: event.summary || '(タイトルなし)',
    start: event.start.dateTime || event.start.date || '',
    end: event.end.dateTime || event.end.date || '',
  }));

  const prompt = `以下のカレンダー予定を分類してください:

${eventList.map(e => `${e.index + 1}. "${e.summary}" (${e.start})`).join('\n')}

JSON配列で返してください。各要素は { index, participants, relationships, format, eventType, stressScore } の形式です。relationshipsは配列形式で複数選択可能です。`;

  try {
    const response = await callOpenRouter(prompt, CLASSIFICATION_SYSTEM_PROMPT);

    // JSONを抽出（余分なテキストがあっても対応）
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to parse classification response:', response);
      return events.map(e => createDefaultClassification(e));
    }

    const classifications = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      participants: EventClassification['participants'];
      relationships: EventClassification['relationships'];
      format: EventClassification['format'];
      eventType: EventClassification['eventType'];
      stressScore: EventClassification['stressScore'];
    }>;

    // 結果をマッピング
    return eventList.map((event) => {
      const classification = classifications.find(c => c.index === event.index + 1);

      if (classification) {
        // relationshipsを正規化（配列でない場合は配列に変換）
        let relationships = classification.relationships;
        if (relationships && !Array.isArray(relationships)) {
          relationships = [relationships as unknown as 'family' | 'work' | 'friend' | 'stranger'];
        }

        return {
          id: event.id,
          summary: event.summary,
          start: event.start,
          end: event.end,
          classification: {
            participants: classification.participants,
            relationships: relationships,
            format: classification.format,
            eventType: classification.eventType,
            stressScore: classification.stressScore,
          },
        };
      }

      return createDefaultClassification(events.find(e => e.id === event.id)!);
    });
  } catch (error) {
    console.error('Classification error:', error);
    return events.map(e => createDefaultClassification(e));
  }
}

/**
 * デフォルトの分類を作成（エラー時のフォールバック）
 */
function createDefaultClassification(
  event: { id: string; summary: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }
): ClassifiedEvent {
  return {
    id: event.id,
    summary: event.summary || '(タイトルなし)',
    start: event.start.dateTime || event.start.date || '',
    end: event.end.dateTime || event.end.date || '',
    classification: {
      participants: 'solo',
      relationships: null,
      format: 'onsite',
      eventType: 'other',
      stressScore: 3,
    },
  };
}

/**
 * ストレススコアのラベルを取得
 */
export function getStressLabel(score: number): string {
  switch (score) {
    case 1: return 'リラックス';
    case 2: return '低ストレス';
    case 3: return '中程度';
    case 4: return 'やや高';
    case 5: return '高ストレス';
    default: return '不明';
  }
}

/**
 * ストレススコアの色を取得
 */
export function getStressColor(score: number): string {
  switch (score) {
    case 1: return '#4CAF50'; // 緑
    case 2: return '#8BC34A'; // 薄緑
    case 3: return '#FFC107'; // 黄色
    case 4: return '#FF9800'; // オレンジ
    case 5: return '#F44336'; // 赤
    default: return '#9E9E9E'; // グレー
  }
}

/**
 * ストレス分析用のシステムプロンプト
 */
const ANALYSIS_SYSTEM_PROMPT = `あなたはストレスマネジメントの専門家です。ユーザーのカレンダーデータとヘルスケアデータ（心拍数・HRV・睡眠）からストレス傾向を分析し、具体的で実用的なアドバイスを提供します。

三軸モデルについて:
- Axis 01（覚醒度）: 瞑想セッションの前後で測定
- Axis 02（反応性）: HRV（心拍変動）が指標。HRVが低いほどストレス反応性が高い
- Axis 03（身体）: 睡眠時間が指標。睡眠不足は身体的ストレスの蓄積を示す

分析結果は以下のJSON形式で返してください:
{
  "summary": "全体的な傾向の要約（2-3文）",
  "insights": [
    "具体的な気づき1",
    "具体的な気づき2",
    "具体的な気づき3"
  ],
  "advice": [
    "具体的なアドバイス1",
    "具体的なアドバイス2",
    "具体的なアドバイス3"
  ],
  "riskDays": ["リスクが高い曜日や時期"],
  "positivePatterns": ["良いパターンや習慣"]
}

注意点:
- ユーザーの実際のデータに基づいた具体的な分析を行う
- 抽象的ではなく、実行可能なアドバイスを提供
- ポジティブな面も見つけて伝える
- 日本語で回答`;

/**
 * ストレスデータを分析してアドバイスを生成
 */
export interface StressAnalysisInput {
  events: Array<{
    date: string;
    summary: string;
    stressScore: number;
    participants?: string;
    relationships?: string[];
    format?: string;
  }>;
  sessions: Array<{
    date: string;
    beforeArousal: number;
    afterArousal?: number;
  }>;
  totalDays: number;
  // チャット履歴（イベントについてのユーザーとの会話）
  chats?: Array<{
    eventId: string;
    eventSummary?: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  }>;
  // 変更履歴（ユーザーがスコアや参加者を変更した履歴）
  changeLogs?: Array<{
    eventId: string;
    eventSummary?: string;
    timestamp: string;
    changedBy: 'ai' | 'user';
    oldStressScore?: number | null;
    newStressScore?: number | null;
    oldParticipants?: string | null;
    newParticipants?: string | null;
  }>;
  // HealthKitデータ（HRV・心拍・睡眠・歩数・カロリー・運動・ワークアウト）
  healthKit?: Array<{
    date: string;
    avgHeartRate?: number;
    avgHRV?: number;
    sleepHours?: number;
    steps?: number;
    activeCalories?: number;
    exerciseMinutes?: number;
    workouts?: Array<{
      activityName: string;
      durationMinutes: number;
      totalEnergyBurned?: number;
    }>;
  }>;
}

export interface StressAnalysisResult {
  summary: string;
  insights: string[];
  advice: string[];
  riskDays: string[];
  positivePatterns: string[];
}

export async function analyzeStressPatterns(
  input: StressAnalysisInput
): Promise<StressAnalysisResult> {
  // データを整形
  const eventsByDay: Record<string, typeof input.events> = {};
  input.events.forEach(event => {
    const day = event.date.split('T')[0];
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(event);
  });

  // 曜日別の集計
  const weekdayStats: Record<string, { count: number; totalStress: number }> = {};
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  Object.entries(eventsByDay).forEach(([dateStr, events]) => {
    const date = new Date(dateStr);
    const weekday = weekdays[date.getDay()];
    if (!weekdayStats[weekday]) weekdayStats[weekday] = { count: 0, totalStress: 0 };
    events.forEach(e => {
      weekdayStats[weekday].count++;
      weekdayStats[weekday].totalStress += e.stressScore;
    });
  });

  // 関係性別の集計
  const relationshipStats: Record<string, { count: number; totalStress: number }> = {};
  input.events.forEach(event => {
    if (event.relationships) {
      event.relationships.forEach(rel => {
        if (!relationshipStats[rel]) relationshipStats[rel] = { count: 0, totalStress: 0 };
        relationshipStats[rel].count++;
        relationshipStats[rel].totalStress += event.stressScore;
      });
    }
  });

  // 瞑想の効果
  const sessionEffect = input.sessions.filter(s => s.afterArousal !== undefined)
    .map(s => ({
      before: s.beforeArousal,
      after: s.afterArousal!,
      improvement: s.beforeArousal - s.afterArousal!,
    }));

  // チャット履歴のサマリー
  const chatSummary = input.chats && input.chats.length > 0
    ? input.chats.slice(0, 5).map(chat => {
        const userMessages = chat.messages.filter(m => m.role === 'user').map(m => m.content).join(' / ');
        return `- ${chat.eventSummary || chat.eventId}: ユーザーの発言「${userMessages.substring(0, 100)}${userMessages.length > 100 ? '...' : ''}」`;
      }).join('\n')
    : 'なし';

  // 変更履歴のサマリー
  const changeLogSummary = input.changeLogs && input.changeLogs.length > 0
    ? input.changeLogs.slice(0, 10).map(log => {
        const changes: string[] = [];
        if (log.oldStressScore !== null && log.newStressScore !== null) {
          changes.push(`ストレス: ${log.oldStressScore}→${log.newStressScore}`);
        }
        if (log.oldParticipants && log.newParticipants) {
          changes.push(`参加者: ${log.oldParticipants}→${log.newParticipants}`);
        }
        return `- ${log.eventSummary || log.eventId}: ${changes.join(', ')} (${log.changedBy === 'user' ? 'ユーザー変更' : 'AI変更'})`;
      }).join('\n')
    : 'なし';

  // HealthKitデータのサマリー
  const healthKitSummary = (() => {
    if (!input.healthKit || input.healthKit.length === 0) return 'データなし';

    const withHR = input.healthKit.filter(d => d.avgHeartRate !== undefined);
    const withHRV = input.healthKit.filter(d => d.avgHRV !== undefined);
    const withSleep = input.healthKit.filter(d => d.sleepHours !== undefined);

    const lines: string[] = [];
    if (withHR.length > 0) {
      const avgHR = withHR.reduce((sum, d) => sum + d.avgHeartRate!, 0) / withHR.length;
      lines.push(`- 平均心拍数: ${avgHR.toFixed(0)} bpm（${withHR.length}日分）`);
    }
    if (withHRV.length > 0) {
      const avgHRV = withHRV.reduce((sum, d) => sum + d.avgHRV!, 0) / withHRV.length;
      const lowHRVDays = withHRV.filter(d => d.avgHRV! < 30).length;
      lines.push(`- 平均HRV(SDNN): ${avgHRV.toFixed(0)} ms（${withHRV.length}日分）`);
      if (lowHRVDays > 0) {
        lines.push(`  - HRV低下日（<30ms）: ${lowHRVDays}日 → ストレス反応性が高い可能性`);
      }
    }
    if (withSleep.length > 0) {
      const avgSleep = withSleep.reduce((sum, d) => sum + d.sleepHours!, 0) / withSleep.length;
      const shortSleepDays = withSleep.filter(d => d.sleepHours! < 6).length;
      lines.push(`- 平均睡眠時間: ${avgSleep.toFixed(1)}時間（${withSleep.length}日分）`);
      if (shortSleepDays > 0) {
        lines.push(`  - 短時間睡眠日（<6h）: ${shortSleepDays}日 → 身体的な負荷が高い可能性`);
      }
    }

    const withSteps = input.healthKit.filter(d => d.steps !== undefined);
    if (withSteps.length > 0) {
      const avgSteps = withSteps.reduce((sum, d) => sum + d.steps!, 0) / withSteps.length;
      lines.push(`- 平均歩数: ${Math.round(avgSteps).toLocaleString()}歩/日（${withSteps.length}日分）`);
    }

    const withCalories = input.healthKit.filter(d => d.activeCalories !== undefined);
    if (withCalories.length > 0) {
      const avgCal = withCalories.reduce((sum, d) => sum + d.activeCalories!, 0) / withCalories.length;
      lines.push(`- 平均消費カロリー: ${Math.round(avgCal)} kcal/日（${withCalories.length}日分）`);
    }

    const withExercise = input.healthKit.filter(d => d.exerciseMinutes !== undefined);
    if (withExercise.length > 0) {
      const avgExercise = withExercise.reduce((sum, d) => sum + d.exerciseMinutes!, 0) / withExercise.length;
      lines.push(`- 平均運動時間: ${Math.round(avgExercise)}分/日（${withExercise.length}日分）`);
    }

    const withWorkouts = input.healthKit.filter(d => d.workouts && d.workouts.length > 0);
    if (withWorkouts.length > 0) {
      const allWorkouts = withWorkouts.flatMap(d => d.workouts!);
      const totalWorkouts = allWorkouts.length;
      const typeCounts: Record<string, number> = {};
      allWorkouts.forEach(w => {
        typeCounts[w.activityName] = (typeCounts[w.activityName] || 0) + 1;
      });
      const topTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => `${name}(${count}回)`)
        .join(', ');
      lines.push(`- ワークアウト: ${totalWorkouts}回（${withWorkouts.length}日）/ 種類: ${topTypes}`);
    }

    return lines.length > 0 ? lines.join('\n') : 'データなし';
  })();

  const prompt = `以下のストレスデータを分析してください:

【期間】過去${input.totalDays}日間

【イベント統計】
- 総イベント数: ${input.events.length}件
- 平均ストレススコア: ${input.events.length > 0 ? (input.events.reduce((sum, e) => sum + e.stressScore, 0) / input.events.length).toFixed(1) : 0}
- 高ストレス(4-5)イベント: ${input.events.filter(e => e.stressScore >= 4).length}件

【曜日別】
${Object.entries(weekdayStats).map(([day, stat]) =>
  `${day}曜日: ${stat.count}件, 平均${stat.count > 0 ? (stat.totalStress / stat.count).toFixed(1) : 0}`
).join('\n')}

【関係性別】
${Object.entries(relationshipStats).map(([rel, stat]) => {
  const label = rel === 'work' ? '仕事' : rel === 'family' ? '家族' : rel === 'friend' ? '友人' : '初対面';
  return `${label}: ${stat.count}件, 平均${stat.count > 0 ? (stat.totalStress / stat.count).toFixed(1) : 0}`;
}).join('\n')}

【瞑想セッション】
- 実施回数: ${input.sessions.length}回
${sessionEffect.length > 0 ? `- 平均改善度: ${(sessionEffect.reduce((sum, s) => sum + s.improvement, 0) / sessionEffect.length).toFixed(2)}` : ''}

【高ストレスイベントサンプル】
${input.events.filter(e => e.stressScore >= 4).slice(0, 5).map(e =>
  `- ${e.summary} (スコア: ${e.stressScore})`
).join('\n')}

【ユーザーとの会話履歴】
${chatSummary}

【ユーザーによるスコア修正履歴】
${changeLogSummary}

【ヘルスケアデータ（Apple HealthKit）】
${healthKitSummary}
※HRV（心拍変動）が低い日はストレス反応性が高い状態（三軸モデル Axis 02）を示します。
※睡眠時間が短い日は身体的な負荷が高い状態（三軸モデル Axis 03）を示します。
※歩数・消費カロリー・運動時間・ワークアウトは身体活動レベルを示します。運動とストレス軽減の相関があれば言及してください。
※ヘルスデータとカレンダーイベントのストレススコアの相関があれば、具体的に言及してください。

※チャット履歴や修正履歴から、ユーザーの実際の感じ方や傾向を読み取ってください。AIの判定とユーザーの感覚のずれがあれば、それも分析に含めてください。

JSON形式でのみ回答してください。`;

  try {
    const response = await callOpenRouter(prompt, ANALYSIS_SYSTEM_PROMPT);

    // JSONを抽出
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to parse analysis response:', response);
      return getDefaultAnalysis();
    }

    return JSON.parse(jsonMatch[0]) as StressAnalysisResult;
  } catch (error) {
    console.error('Analysis error:', error);
    return getDefaultAnalysis();
  }
}

function getDefaultAnalysis(): StressAnalysisResult {
  return {
    summary: 'データが不足しているため、詳細な分析ができません。',
    insights: ['より多くのデータを収集することで、傾向が見えてきます。'],
    advice: ['引き続きカレンダーの予定を記録してください。'],
    riskDays: [],
    positivePatterns: [],
  };
}

// ========================================
// 身体天気予報AI生成
// ========================================

const BODY_FORECAST_SYSTEM_PROMPT = `あなたは環境医学と神経科学に詳しいパーソナルアドバイザーです。
ユーザーの身体データ・環境データ・仕事/予定・食事・瞑想履歴から、
「最近の傾向」と「今日特に気をつけること」を分析的に伝えてください。

【summaryの書き方】
- 「最近、〜が続いています」「ここ数日、〜の傾向です」など傾向から入る
- そこに今日の環境（天気・気圧）を掛け合わせて「今日は〜に気をつけてください」と注意喚起
- 仕事のストレスが高い日が続いていれば言及する
- 睡眠不足が続いていれば言及する
- 具体的な数値を入れて根拠を示す

【summaryの例】
- 「ここ数日、高ストレスの仕事が続き睡眠も5時間台です。今日は気圧上昇で回復傾向ですが、蓄積疲労に注意してください」
- 「最近、体が重いと感じるセッションが続いています。低気圧の接近もあり、炎症反応が出やすい状態です」
- 「睡眠・食事ともに安定しています。気圧も穏やかで、身体のコンディションは良好です」

【recommendationの書き方】
- 現在時刻以降にできることだけを提案する（朝なら朝〜夜、夜なら今夜〜就寝前のみ）
- 今日具体的にすべきことを2〜3個、箇条書き風に「、」区切りで並べる
- 最後は「がおすすめです」で締める
- 例（朝）: 「午前中の軽いストレッチ、会議前の深呼吸、22時までの就寝がおすすめです」
- 例（夜）: 「ぬるめのお風呂、スマホを置いて深呼吸、早めの就寝がおすすめです」

【luckyItemの書き方】
- 現在の時間帯に合ったアイテムを提案する（朝なら朝食向き、夜なら夕食・リラックス向き）
- 今日の身体状態・環境に合わせた「おすすめの食べ物・飲み物・行動」を1つ提案
- 科学的な根拠があるもの（例: 低気圧→マグネシウム豊富なバナナ、睡眠不足→トリプトファン豊富な豆乳）
- アイテム名は短く（10文字以内）、理由も短く（20文字以内）
- 楽しい気持ちになるようなトーンで
- 例: {"item": "ダークチョコ", "reason": "BDNFを増やして脳を元気に", "emoji": "🍫"}
- 例: {"item": "バナナ", "reason": "マグネシウムで自律神経を安定", "emoji": "🍌"}
- 例: {"item": "緑茶", "reason": "テアニンでリラックス集中", "emoji": "🍵"}
- 例: {"item": "15分の散歩", "reason": "セロトニン生成を促進", "emoji": "🚶"}

【meditationTipの書き方】
- 今日の身体・環境状態に合わせた瞑想時の意識ポイントを1つ提案
- 具体的で実践しやすい内容（例: 「吐く息を長めに」「身体の重さをそのまま観察」）
- 30文字以内で簡潔に
- 例: 「吐く息を倍の長さにして副交感神経を優位に」
- 例: 「身体の重さを否定せず、ただ観察してみましょう」
- 例: 「呼吸の温度の変化に意識を向けてみましょう」

【ルール】
- summaryは2〜3文、120文字以内
- recommendationは1文、80文字以内（項目は「、」区切り）
- luckyItemは必ず返す
- meditationTipは必ず返す
- 科学的根拠のある内容のみ。占いにしない
- データがない項目は触れない
- 日本語で回答

【回答形式】
必ず以下のJSON形式のみで返してください。
{"summary": "...", "recommendation": "...", "luckyItem": {"item": "...", "reason": "...", "emoji": "..."}, "meditationTip": "..."}`;

export interface BodyForecastAIResult {
  summary: string;
  recommendation: string;
  luckyItem?: { item: string; reason: string; emoji: string };
  meditationTip?: string;
}

export async function generateBodyForecastAI(
  context: string
): Promise<BodyForecastAIResult | null> {
  try {
    const result = await callOpenRouter(context, BODY_FORECAST_SYSTEM_PROMPT, 'classification');
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('generateBodyForecastAI error:', error);
  }
  return null;
}

// ========================================
// マインドフルコメント生成（りなわんの一言）
// ========================================

const MINDFUL_COMMENT_SYSTEM_PROMPT = `あなたは「りなわん」というマインドフルネスの案内役キャラクターです。
ユーザーが入力した3つの心身状態の値と、今日の環境データをもとに、やさしく寄り添う一言を生成してください。

【りなわんのキャラクター】
- 一人称は「ボク」
- 親しみやすくやさしい口調（「〜だね」「〜だよ」）
- 相手の気持ちに寄り添い、押し付けがましくない

【値の意味（1〜3）】
- body: 身体の感じ（1=軽い、2=ふつう、3=重い）
- mind: 心の感じ（1=軽い、2=ふつう、3=重い）
- breath: 呼吸の状態

【環境データがある場合】
- 天気や気圧の情報を自然に織り込む（「低気圧だから体が重く感じるのかも」など）
- 環境データは理由づけのヒントとして使い、押し付けない
- 環境データがない場合は心身状態だけで返答する

【ルール】
- 1〜2文、50文字以内
- アドバイスではなく、気持ちへの寄り添い + 環境への気づき
- 専門用語（グラウンディング、マインドフルネス、ボディスキャン等）は使わない
- やさしい日常の言葉だけを使う`;

const MINDFUL_COMMENT_SIMPLE_SYSTEM_PROMPT = `あなたはマインドフルネスの案内役です。
ユーザーが入力した3つの心身状態の値と、今日の環境データをもとに、やさしく寄り添う一言を生成してください。

【口調】
- キャラクター名は名乗らない
- 親しみやすい敬語調（「〜ですね」「〜ましょう」）
- 相手の気持ちに寄り添い、押し付けがましくない

【値の意味（1〜3）】
- body: 身体の感じ（1=軽い、2=ふつう、3=重い）
- mind: 心の感じ（1=軽い、2=ふつう、3=重い）
- breath: 呼吸の状態

【環境データがある場合】
- 天気や気圧の情報を自然に織り込む
- 環境データは理由づけのヒントとして使い、押し付けない

【ルール】
- 1〜2文、50文字以内
- アドバイスではなく、気持ちへの寄り添い + 環境への気づき
- 専門用語（グラウンディング、マインドフルネス、ボディスキャン等）は使わない
- やさしい日常の言葉だけを使う`;

const MINDFUL_COMMENT_FALLBACK_MESSAGES = [
  '今の自分に気づけたね',
  '教えてくれてありがとう',
  '一緒にゆっくりしよう',
  '自分を感じる時間だね',
  '今のままで大丈夫だよ',
];

const MINDFUL_COMMENT_SIMPLE_FALLBACK_MESSAGES = [
  '今のご自身に気づけましたね',
  '教えてくださりありがとうございます',
  'ゆっくりしていきましょう',
  'ご自身を感じる時間ですね',
  '今のままで大丈夫ですよ',
];

/**
 * 3つの選択値から一言コメントを生成（環境コンテキスト対応）
 */
export async function generateMindfulComment(params: {
  body: number;
  mind: number;
  breath: number;
  designTheme?: 'cute' | 'simple';
  environmentContext?: string; // 環境データの要約テキスト
}): Promise<string> {
  const isSimple = params.designTheme === 'simple';
  const systemPrompt = isSimple ? MINDFUL_COMMENT_SIMPLE_SYSTEM_PROMPT : MINDFUL_COMMENT_SYSTEM_PROMPT;
  const fallbacks = isSimple ? MINDFUL_COMMENT_SIMPLE_FALLBACK_MESSAGES : MINDFUL_COMMENT_FALLBACK_MESSAGES;

  try {
    let prompt = `body=${params.body}, mind=${params.mind}, breath=${params.breath}`;
    if (params.environmentContext) {
      prompt += `\n\n【今日の環境】\n${params.environmentContext}`;
    }
    const result = await callOpenRouter(prompt, systemPrompt, 'classification');
    return result.trim().replace(/^[「『]|[」』]$/g, '');
  } catch (error) {
    console.error('generateMindfulComment error:', error);
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

const AFTER_COMMENT_SYSTEM_PROMPT = `あなたは「りなわん」というやさしい案内役キャラクターです。
瞑想トレーニングを終えたユーザーに、やさしく寄り添う一言を生成してください。

【りなわんのキャラクター】
- 一人称は「ボク」
- 親しみやすくやさしい口調（「〜だね」「〜だよ」）
- 相手の気持ちに寄り添い、押し付けがましくない

【ルール】
- 1〜2文
- ねぎらいの気持ちを込める
- 専門用語（グラウンディング、マインドフルネス、ボディスキャン等）は絶対に使わない
- やさしい日常の言葉だけを使う
- 「〜だね」「〜だよ」のやさしい語尾`;

const AFTER_COMMENT_SIMPLE_SYSTEM_PROMPT = `あなたはマインドフルネスの案内役です。
瞑想トレーニングを終えたユーザーに、やさしく寄り添う一言を生成してください。

【口調】
- キャラクター名は名乗らない
- 親しみやすい敬語調（「〜ですね」「〜ましたね」）
- 相手の気持ちに寄り添い、押し付けがましくない

【ルール】
- 1〜2文
- ねぎらいの気持ちを込める
- 専門用語（グラウンディング、マインドフルネス、ボディスキャン等）は絶対に使わない
- やさしい日常の言葉だけを使う
- 「〜ですね」「〜ましたね」の親しみやすい敬語`;

/**
 * トレーニング後のコメントを生成
 */
export async function generateAfterComment(params: {
  body: number;
  mind: number;
  breath: number;
  meditationGuideId: string;
  designTheme?: 'cute' | 'simple';
  reflection?: {
    breathing?: string;
    body?: string;
    mind?: string;
  };
}): Promise<string> {
  const isSimple = params.designTheme === 'simple';
  const systemPrompt = isSimple ? AFTER_COMMENT_SIMPLE_SYSTEM_PROMPT : AFTER_COMMENT_SYSTEM_PROMPT;

  try {
    const reflectionLabels: Record<string, string> = {
      good: 'よかった',
      neutral: 'ふつう/変わらない',
      notSure: 'よくわからない',
    };
    let reflectionText = '';
    if (params.reflection?.breathing || params.reflection?.body || params.reflection?.mind) {
      const parts: string[] = [];
      if (params.reflection.breathing) parts.push(`呼吸: ${reflectionLabels[params.reflection.breathing] ?? params.reflection.breathing}`);
      if (params.reflection.body) parts.push(`体: ${reflectionLabels[params.reflection.body] ?? params.reflection.body}`);
      if (params.reflection.mind) parts.push(`気持ち: ${reflectionLabels[params.reflection.mind] ?? params.reflection.mind}`);
      reflectionText = `\n瞑想後の振り返り: ${parts.join(', ')}`;
    }
    const prompt = `瞑想前の状態: body=${params.body}, mind=${params.mind}, breath=${params.breath}\n実施した瞑想タイプ: ${params.meditationGuideId}${reflectionText}\n\nトレーニングを終えたユーザーへのやさしい一言を生成してください。`;
    const result = await callOpenRouter(prompt, systemPrompt, 'classification');
    return result.trim().replace(/^[「『]|[」』]$/g, '');
  } catch (error) {
    console.error('generateAfterComment error:', error);
    const fallbacks = isSimple ? [
      'おつかれさまでした。\n今日もご自身と向き合う時間を取れましたね。',
      'すばらしいですね。\nまた気が向いたらいつでもどうぞ。',
      'おつかれさまでした。\nどんな感覚でも、気づけたことが大切です。',
      'ありがとうございます。\n今の自分に気づけましたね。',
      'よくがんばりましたね。\nゆっくりお休みください。',
    ] : [
      'おつかれさま！\n今日も自分と過ごす時間をつくれたね。',
      'えらいね！\nまた気が向いたら会いに来てね。',
      'おつかれさま！\nどんな感覚でも、気づけたことがすばらしいよ。',
      'ありがとう！\n今の自分に気づけたね。',
      'がんばったね！\nゆっくり休んでね。',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// ========================================
// イベントチャット（AIレビュー）機能
// ========================================

/**
 * チャットメッセージの型定義
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * イベントチャット用のシステムプロンプト
 */
const EVENT_CHAT_SYSTEM_PROMPT = `あなたは「りなわん」というマインドフルネスの案内役キャラクターです。ユーザーのカレンダー予定について、ストレスの原因を一緒に探っていきます。

【りなわんのキャラクター】
- 一人称は「ボク」
- 親しみやすくやさしい口調（「〜だよ」「〜だね」「〜かな？」「〜してみてね」）
- 相手の気持ちに寄り添い、押し付けがましくない
- 言葉の奥にある「もうひとつの声」を聴くことを大切にしている
- 分析より「感じる」ことを重視

【重要なルール】
- アドバイスや結論は出さない
- 原因追求と状況確認に集中する
- 質問を通じてユーザー自身が気づきを得られるように導く
- 1回の返答は2-3文程度に抑える
- 具体的な質問を1つだけする
- 相手の感情にのまれず、ただ見守る姿勢

【口調の例】
- 「この予定、どんなところがちょっと気になるかな？」
- 「なるほど〜。以前も似たようなことがあったりした？」
- 「参加する人の中で、特に気を使っちゃう人っているかな？」
- 「その気持ち、わかるよ。もう少し教えてくれる？」
- 「ふむふむ。その『もやもや』の正体、一緒に探ってみようか」
- 「そっか〜。それって、どんな感じがするの？」

【避けること】
- 「〜すべき」「〜した方がいい」などの指示的な言葉
- 長い説明や分析
- 堅苦しい敬語`;

/**
 * イベントについてチャットする
 */
export async function chatAboutEvent(
  event: {
    eventSummary: string;
    eventStart: string;
    eventEnd: string;
    stressScore?: number;
    participants?: string;
    relationships?: string[];
    format?: string;
  },
  chatHistory: ChatMessage[],
  userMessage: string
): Promise<string> {
  // イベント情報をコンテキストとして追加
  const eventContext = `【分析対象の予定】
タイトル: ${event.eventSummary}
日時: ${event.eventStart}
ストレススコア: ${event.stressScore || '未設定'}/5
参加者規模: ${event.participants === 'solo' ? '一人' : event.participants === 'small' ? '少人数' : '大人数'}
関係性: ${event.relationships?.join(', ') || '不明'}
形式: ${event.format === 'online' ? 'オンライン' : '対面'}`;

  // 会話履歴を構築
  const messages = [
    { role: 'system' as const, content: EVENT_CHAT_SYSTEM_PROMPT + '\n\n' + eventContext },
    ...chatHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kokopon.app',
      'X-Title': 'Kokopon Mobile',
    },
    body: JSON.stringify({
      model: MODELS.chat,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * チャットの最初のメッセージを生成
 */
export async function startEventChat(
  event: {
    eventSummary: string;
    eventStart: string;
    stressScore?: number;
    participants?: string;
    relationships?: string[];
    format?: string;
  }
): Promise<string> {
  // 過去か未来かを判定
  const eventDate = new Date(event.eventStart);
  const now = new Date();
  const isPast = eventDate < now;

  // 過去なら「出来事」、未来なら「予定」
  const eventWord = isPast ? '出来事' : '予定';

  const stressText = event.stressScore
    ? event.stressScore >= 4
      ? isPast ? 'ちょっと大変だった' : 'ちょっと緊張しそうな'
      : event.stressScore >= 3
        ? 'まあまあな'
        : isPast ? 'リラックスできた' : 'リラックスできそうな'
    : '';

  const prompt = `やっほー、りなわんだよ。

「${event.eventSummary}」について、一緒に見てみようか。${stressText ? `${stressText}${eventWord}みたいだね。` : ''}

この${eventWord}のこと、どんなふうに感じてる？気になってることとか、もやもやしてることがあったら教えてね。`;

  return prompt;
}

// ========================================
// 音声チャット機能
// ========================================

/**
 * 音声チャット用のシステムプロンプト（音声出力用に調整）
 */
const VOICE_CHAT_SYSTEM_PROMPT = `あなたは「りなわん」というマインドフルネスの案内役キャラクターです。音声で会話しています。

【りなわんのキャラクター】
- 一人称は「ボク」
- 親しみやすくやさしい口調（「〜だよ」「〜だね」「〜かな？」「〜してみてね」）
- 相手の気持ちに寄り添い、押し付けがましくない
- 言葉の奥にある「もうひとつの声」を聴くことを大切にしている

【重要なルール】
- アドバイスや結論は出さない
- 原因追求と状況確認に集中する
- 質問を通じてユーザー自身が気づきを得られるように導く
- 1回の返答は短く（2-3文程度）
- 音声なので、読み上げやすい自然な日本語で話す
- 「...」や記号は使わない

【口調の例】
- 「うんうん、そうなんだね」
- 「それってどんな感じがする？」
- 「なるほどね、もう少し聞かせて」`;

/**
 * 音声入力からテキストレスポンスを生成（シンプル版）
 * 音声を直接chatモデルに送信し、テキストで返答を得る
 */
export async function voiceChat(
  audioBase64: string,
  eventContext: string,
  chatHistory: ChatMessage[]
): Promise<{ audioBase64: string; text: string }> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  // gpt-4o-audio-previewを使用して音声入力→テキスト出力
  const messages = [
    { role: 'system' as const, content: VOICE_CHAT_SYSTEM_PROMPT + '\n\n' + eventContext },
    ...chatHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: [
        {
          type: 'input_audio',
          input_audio: {
            data: audioBase64,
            format: 'm4a',
          },
        },
      ],
    },
  ];

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kokopon.app',
      'X-Title': 'Kokopon Mobile',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-audio-preview',
      messages,
      modalities: ['text'],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter Audio API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  return { audioBase64: '', text };
}

/**
 * テキストから音声を生成（Text-to-Speech）
 * @param text 読み上げるテキスト
 * @returns 音声のBase64データ
 */
export async function textToSpeech(text: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kokopon.app',
      'X-Title': 'Kokopon Mobile',
    },
    body: JSON.stringify({
      model: MODELS.audio,
      messages: [
        { role: 'user', content: text },
      ],
      modalities: ['audio'],
      audio: {
        voice: 'alloy',
        format: 'pcm16',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter TTS API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.audio?.data || '';
}

/**
 * テキスト入力からテキストレスポンスを生成（音声モード用だがテキストのみ）
 */
export async function chatWithVoiceResponse(
  userText: string,
  eventContext: string,
  chatHistory: ChatMessage[]
): Promise<{ audioBase64: string; text: string }> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const messages = [
    { role: 'system' as const, content: VOICE_CHAT_SYSTEM_PROMPT + '\n\n' + eventContext },
    ...chatHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: userText },
  ];

  // 通常のチャットモデルを使用
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kokopon.app',
      'X-Title': 'Kokopon Mobile',
    },
    body: JSON.stringify({
      model: MODELS.chat,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  return { audioBase64: '', text };
}

// ========================================
// 食事写真AI分析機能
// ========================================

/**
 * 食事写真分析結果の型定義
 */
export interface MealAnalysis {
  mealName: string;           // 料理名
  bloodSugarStability: number; // 血糖安定度 1-5
  antiInflammation: number;    // 抗炎症スコア 1-5
  bdnfSupport: number;         // BDNF支援 1-5
  serotoninSupply: number;     // セロトニン原料 1-5
  hpaAxisImpact: number;       // HPA軸への影響 1-5 (高いほど良い=刺激が少ない)
  overallScore: number;        // 総合スコア 1-5
  comment: string;             // 一言コメント
  detectedFoods: string[];     // 検出された食材
}

/**
 * 食事写真分析用のシステムプロンプト
 */
const MEAL_ANALYSIS_SYSTEM_PROMPT = `あなたは神経科学に基づく食事分析の専門家です。写真から食事を分析し、メンタルヘルスへの影響を評価します。

以下の神経科学フレームワークに基づいて評価してください：

【評価軸】
1. 血糖安定度 (bloodSugarStability): 1-5
   - 低GI食品が多いほど高スコア。血糖の急上昇・急降下はHPA軸を発火させコルチゾールを上昇させる
   - 5: 玄米、全粒粉、野菜中心（低GI）
   - 1: 白米大盛り、菓子パン、砂糖多量（高GI）

2. 抗炎症スコア (antiInflammation): 1-5
   - 抗炎症食品が多いほど高スコア。慢性炎症は扁桃体の閾値を下げ前頭前野を疲弊させる
   - 5: 青魚、野菜、オリーブオイル、ナッツ
   - 1: 超加工食品、揚げ物多量、トランス脂肪酸

3. BDNF支援 (bdnfSupport): 1-5
   - BDNF産生を促進する栄養素（オメガ3、ポリフェノール等）の含有量
   - 5: サーモン、ブルーベリー、緑茶、ダークチョコレート
   - 1: 栄養素の少ない加工食品

4. セロトニン原料 (serotoninSupply): 1-5
   - トリプトファン（セロトニン前駆体）と腸内環境改善食品の含有量
   - 5: 大豆製品、バナナ、発酵食品、卵
   - 1: トリプトファン源がほぼない食事

5. HPA軸安定度 (hpaAxisImpact): 1-5
   - 高いほど良い（HPA軸への刺激が少ない）
   - 5: バランスの良い食事、カフェイン少
   - 1: カフェイン過多、血糖乱高下を招く食事

【回答形式】
必ず以下のJSON形式のみで回答してください。説明文は不要です。
{
  "mealName": "料理名（日本語）",
  "bloodSugarStability": 数値(1-5),
  "antiInflammation": 数値(1-5),
  "bdnfSupport": 数値(1-5),
  "serotoninSupply": 数値(1-5),
  "hpaAxisImpact": 数値(1-5),
  "overallScore": 数値(1-5),
  "comment": "一言コメント（神経科学的な観点から、日本語で、50文字以内）",
  "detectedFoods": ["食材1", "食材2", ...]
}

overallScoreは5つのスコアの加重平均を目安に算出してください。`;

/**
 * 食事写真をAIで分析する
 */
export async function analyzeMealPhoto(imageBase64: string): Promise<MealAnalysis> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kokopon.app',
      'X-Title': 'Kokopon Mobile',
    },
    body: JSON.stringify({
      model: MODELS.vision,
      messages: [
        { role: 'system', content: MEAL_ANALYSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: 'この食事を分析してください。',
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter Vision API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  // JSONを抽出
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Failed to parse meal analysis response:', content);
    throw new Error('食事の分析に失敗しました');
  }

  return JSON.parse(jsonMatch[0]) as MealAnalysis;
}
