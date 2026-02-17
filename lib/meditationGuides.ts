/**
 * 瞑想ガイド定義 & グルーピングロジック
 *
 * Phase 1: body × mind の 4グループ
 */

export type MeditationGroupId = 'body_scan' | 'grounding' | 'thought_clouds' | 'five_senses';

export interface MeditationGuideGroup {
  id: MeditationGroupId;
  label: string;
  files: {
    1: number | null;
    5: number | null;
    10: number | null;
  };
}

// フォールバック用の既存ガイド
const FALLBACK_FILES = {
  1: require('@/assets/sounds/release_breath_1m_rina.m4a'),
  5: require('@/assets/sounds/release_breath_5m_rina.m4a'),
  10: require('@/assets/sounds/release_breath_10m_rina.m4a'),
};

/**
 * Phase 1: 4グループの瞑想ガイド定義
 *
 * | グループ          | 条件               |
 * |------------------|--------------------|
 * | body_scan        | body>0 & mind>0    | 心身ともに重い
 * | grounding        | body>0 & mind<=0   | 身体が重い・心は軽め
 * | thought_clouds   | body<=0 & mind>0   | 心が重い・身体は軽め
 * | five_senses      | body<=0 & mind<=0  | 心身ともに軽い
 *
 * 音声ファイルが未アップロードのため、すべて release_breath をフォールバックとして使用
 */
export const MEDITATION_GUIDE_GROUPS: Record<MeditationGroupId, MeditationGuideGroup> = {
  body_scan: {
    id: 'body_scan',
    label: 'やすらぎのボディスキャン',
    files: {
      1: null, // assets/sounds/body_scan_1m_rina.m4a
      5: null, // assets/sounds/body_scan_5m_rina.m4a
      10: null, // assets/sounds/body_scan_10m_rina.m4a
    },
  },
  grounding: {
    id: 'grounding',
    label: '大地にゆだねる',
    files: {
      1: null, // assets/sounds/grounding_1m_rina.m4a
      5: null, // assets/sounds/grounding_5m_rina.m4a
      10: null, // assets/sounds/grounding_10m_rina.m4a
    },
  },
  thought_clouds: {
    id: 'thought_clouds',
    label: '思考の雲を眺める',
    files: {
      1: null, // assets/sounds/thought_clouds_1m_rina.m4a
      5: null, // assets/sounds/thought_clouds_5m_rina.m4a
      10: null, // assets/sounds/thought_clouds_10m_rina.m4a
    },
  },
  five_senses: {
    id: 'five_senses',
    label: '五感のマインドフルネス',
    files: {
      1: null, // assets/sounds/five_senses_1m_rina.m4a
      5: null, // assets/sounds/five_senses_5m_rina.m4a
      10: null, // assets/sounds/five_senses_10m_rina.m4a
    },
  },
};

/**
 * body と mind の値から適切な瞑想グループを返す
 *
 * @param body 1(軽い) / 2(ふつう) / 3(重い)
 * @param mind 1(軽い) / 2(ふつう) / 3(重い)
 */
export function getMeditationGroup(body: number, mind: number): MeditationGroupId {
  // 3=重い、2以下=軽い〜ふつう
  if (body >= 3 && mind >= 3) return 'body_scan';
  if (body >= 3 && mind < 3) return 'grounding';
  if (body < 3 && mind >= 3) return 'thought_clouds';
  return 'five_senses';
}

/**
 * 指定グループ・時間の音声ファイルを取得（フォールバック付き）
 */
export function getGuideFile(groupId: MeditationGroupId, duration: 1 | 5 | 10): number {
  const group = MEDITATION_GUIDE_GROUPS[groupId];
  return group.files[duration] ?? FALLBACK_FILES[duration];
}
