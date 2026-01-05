/**
 * OpenRouter API クライアント
 * カレンダー予定のAI分類に使用
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

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
async function callOpenRouter(prompt: string, systemPrompt: string): Promise<string> {
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
      model: 'anthropic/claude-3.5-haiku',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
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

  // イベント情報を整形
  const eventList = events.map((event, index) => ({
    index,
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
const ANALYSIS_SYSTEM_PROMPT = `あなたはストレスマネジメントの専門家です。ユーザーのカレンダーデータからストレス傾向を分析し、具体的で実用的なアドバイスを提供します。

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
