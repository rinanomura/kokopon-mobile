/**
 * トレーニングコンテンツマスター（12本完全版）
 *
 * 12本のトレーニングを一元管理する定義ファイル
 * - trainingMode ("intuitive" | "verbal") で表示文言を切り替え
 * - voice ("rina" | "rinawan") で音声ファイルを切り替え
 *
 * 象限と割り当て:
 * - 高活性×不快: release_breath, heat_notice, sound_release
 * - 高活性×快:   sense_energy, expand_chest, rhythm_notice
 * - 低活性×不快: ground_body, contact_points, slow_breath
 * - 低活性×快:   calm_stay, pleasant_notice, stillness
 */

// =============================================================================
// 型定義
// =============================================================================

/** トレーニングモード */
export type TrainingMode = 'intuitive' | 'verbal';

/** 音声話者タイプ */
export type VoiceType = 'rina' | 'rinawan';

/** メニューID（12本のトレーニング） */
export type MenuId =
  // 高活性×不快（Group 1）
  | 'release_breath'
  | 'heat_notice'
  | 'sound_release'
  // 高活性×快（Group 2）
  | 'sense_energy'
  | 'expand_chest'
  | 'rhythm_notice'
  // 低活性×不快（Group 3）
  | 'ground_body'
  | 'contact_points'
  | 'slow_breath'
  // 低活性×快（Group 4）
  | 'calm_stay'
  | 'pleasant_notice'
  | 'stillness';

/** 介入レベル (1=低, 2=中, 3=やや高〜高) */
export type InterventionLevel = 1 | 2 | 3;

/** 象限タイプ */
export type Quadrant = 'high_unpleasant' | 'high_pleasant' | 'low_unpleasant' | 'low_pleasant';

/** 音声ファイルの型（require で読み込んだアセット） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AudioSource = any;

/** 画像ファイルの型（require で読み込んだアセット） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImageSource = any;

/** トレーニングコンテンツの型定義 */
export type TrainingContent = {
  id: MenuId;
  quadrant: Quadrant;
  level: InterventionLevel;
  title: { intuitive: string; verbal: string };
  description: { intuitive: string; verbal: string };
  bubbleText: { intuitive: string; verbal: string };
  audio: { rina: AudioSource; rinawan: AudioSource };
  mascotGif: ImageSource;
  colors: {
    backgroundGradient: [string, string];
    cardGradient: [string, string];
    shadowColor: string;
  };
};

// =============================================================================
// 象限ごとのメニューID定義
// =============================================================================

/** 各象限に属するメニューID（レコメンドロジックで使用） */
export const QUADRANT_MENUS: Record<Quadrant, MenuId[]> = {
  high_unpleasant: ['release_breath', 'heat_notice', 'sound_release'],
  high_pleasant: ['sense_energy', 'expand_chest', 'rhythm_notice'],
  low_unpleasant: ['ground_body', 'contact_points', 'slow_breath'],
  low_pleasant: ['calm_stay', 'pleasant_notice', 'stillness'],
};

// =============================================================================
// トレーニングコンテンツマスター（12本）
// =============================================================================

export const TRAINING_CONTENTS: Record<MenuId, TrainingContent> = {
  // ===========================================================================
  // Group 1: 高活性×不快（紫〜ピンク系）
  // ===========================================================================
  release_breath: {
    id: 'release_breath',
    quadrant: 'high_unpleasant',
    level: 2,
    title: {
      intuitive: '吐く息の出口を感じてみる30秒',
      verbal: '緊張した呼吸をゆるめる30秒',
    },
    description: {
      intuitive: '吐く息が体から出ていく感覚に、そっと意識を向けてみます。',
      verbal: '緊張で浅くなった呼吸を、無理に変えずにそのまま観察します。',
    },
    bubbleText: {
      intuitive: '少しエネルギーが高まっているみたい。\n吐く息に意識を向けてみようね。',
      verbal: '緊張や焦りがあるみたい。\n呼吸をゆるめてみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/release_breath_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/release_breath_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_exhaling.gif'),
    colors: {
      backgroundGradient: ['#D4A5E8', '#E8D0F0'],
      cardGradient: ['#B07CC8', '#C9A0D8'],
      shadowColor: '#B07CC8',
    },
  },

  heat_notice: {
    id: 'heat_notice',
    quadrant: 'high_unpleasant',
    level: 1,
    title: {
      intuitive: '体の熱やこわばりに気づく30秒',
      verbal: '体にたまった緊張を感じる30秒',
    },
    description: {
      intuitive: '体のどこかに熱やこわばりがないか、そっと探してみます。',
      verbal: '緊張がたまっている場所を、評価せずに感じてみます。',
    },
    bubbleText: {
      intuitive: '体に何か感じるところがあるかな。\n熱やこわばりを探してみようね。',
      verbal: '緊張がたまっているところがあるみたい。\n一緒に感じてみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/heat_notice_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/heat_notice_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_standing.gif'),
    colors: {
      backgroundGradient: ['#DDA5E8', '#EED0F0'],
      cardGradient: ['#BA7CC8', '#D2A0D8'],
      shadowColor: '#BA7CC8',
    },
  },

  sound_release: {
    id: 'sound_release',
    quadrant: 'high_unpleasant',
    level: 1,
    title: {
      intuitive: '周囲の音に意識を向ける30秒',
      verbal: '頭の中の高まりを外に向ける30秒',
    },
    description: {
      intuitive: '今聞こえている音に、そっと耳を傾けてみます。',
      verbal: '頭の中の考えから離れて、外の世界の音に意識を向けます。',
    },
    bubbleText: {
      intuitive: '頭がいっぱいになっているかな。\n周りの音を聞いてみようね。',
      verbal: '考えがぐるぐるしているみたい。\n外の音に意識を向けてみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/sound_release_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/sound_release_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_looking_around.gif'),
    colors: {
      backgroundGradient: ['#CDA5E8', '#E0D0F0'],
      cardGradient: ['#A87CC8', '#C0A0D8'],
      shadowColor: '#A87CC8',
    },
  },

  // ===========================================================================
  // Group 2: 高活性×快（ピンク〜コーラル系）
  // ===========================================================================
  sense_energy: {
    id: 'sense_energy',
    quadrant: 'high_pleasant',
    level: 1,
    title: {
      intuitive: '今のエネルギーを感じてみる30秒',
      verbal: '高まっている感覚を味わう30秒',
    },
    description: {
      intuitive: '体の中にあるエネルギーや活力を、そのまま感じてみます。',
      verbal: '今の高揚感や喜びを、そのまま味わってみます。',
    },
    bubbleText: {
      intuitive: '元気なエネルギーがあるみたい。\nその感覚をそのまま感じてみようね。',
      verbal: '高揚感や喜びがあるんだね。\nそのまま味わってみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/sense_energy_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/sense_energy_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_feeling_energy.gif'),
    colors: {
      backgroundGradient: ['#FFB6C1', '#FFDCE4'],
      cardGradient: ['#FF85A2', '#FFB6C1'],
      shadowColor: '#FF85A2',
    },
  },

  expand_chest: {
    id: 'expand_chest',
    quadrant: 'high_pleasant',
    level: 2,
    title: {
      intuitive: '胸のひらきに気づく30秒',
      verbal: '前向きな広がりを感じる30秒',
    },
    description: {
      intuitive: '胸のあたりがどんな感じか、そっと意識を向けてみます。',
      verbal: '前向きな気持ちが広がっていく感覚を味わいます。',
    },
    bubbleText: {
      intuitive: '胸のあたりに何か感じるかな。\nひらきに気づいてみようね。',
      verbal: '前向きな気持ちがあるみたい。\nその広がりを感じてみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/expand_chest_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/expand_chest_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_breathing.gif'),
    colors: {
      backgroundGradient: ['#FFC0CB', '#FFE4E9'],
      cardGradient: ['#FF8FA5', '#FFC0CB'],
      shadowColor: '#FF8FA5',
    },
  },

  rhythm_notice: {
    id: 'rhythm_notice',
    quadrant: 'high_pleasant',
    level: 1,
    title: {
      intuitive: '体のリズムを感じてみる30秒',
      verbal: '今の調子やテンポを感じる30秒',
    },
    description: {
      intuitive: '心臓の鼓動や呼吸のリズムを、そっと感じてみます。',
      verbal: '今の自分のテンポや調子を、そのまま観察します。',
    },
    bubbleText: {
      intuitive: '体にリズムがあるね。\nそのリズムを感じてみようね。',
      verbal: '今の調子はどうかな。\nテンポを感じてみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/rhythm_notice_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/rhythm_notice_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_sitting.gif'),
    colors: {
      backgroundGradient: ['#FFCAD4', '#FFEAEF'],
      cardGradient: ['#FF99AA', '#FFCAD4'],
      shadowColor: '#FF99AA',
    },
  },

  // ===========================================================================
  // Group 3: 低活性×不快（ブルー〜ラベンダー系）
  // ===========================================================================
  ground_body: {
    id: 'ground_body',
    quadrant: 'low_unpleasant',
    level: 2,
    title: {
      intuitive: '体の重さをあずけてみる30秒',
      verbal: '不安定な感覚を落ち着かせる30秒',
    },
    description: {
      intuitive: '体の重さがどこにあずけられているか、そっと感じてみます。',
      verbal: '不安定な感覚を、無理に変えずにそのまま見つめます。',
    },
    bubbleText: {
      intuitive: '少し重さを感じているのかな。\n体をあずける感覚を味わってみようね。',
      verbal: '不安定な感じがあるみたい。\n一緒に落ち着いてみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/ground_body_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/ground_body_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_putting_body_weight.gif'),
    colors: {
      backgroundGradient: ['#A5B8E8', '#D0DEF0'],
      cardGradient: ['#7A8FC8', '#A0B8D8'],
      shadowColor: '#7A8FC8',
    },
  },

  contact_points: {
    id: 'contact_points',
    quadrant: 'low_unpleasant',
    level: 3,
    title: {
      intuitive: '体が触れている場所を感じる30秒',
      verbal: '現在地を確かめる30秒',
    },
    description: {
      intuitive: '椅子や床に触れている部分を、そっと意識してみます。',
      verbal: '今ここにいることを、体の感覚で確かめます。',
    },
    bubbleText: {
      intuitive: '体がどこかに触れているね。\nその感覚を感じてみようね。',
      verbal: '今ここにいることを確認しようね。\n体の感覚で確かめてみよう。',
    },
    audio: {
      rina: require('@/assets/sounds/contact_points_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/contact_points_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_laying_down.gif'),
    colors: {
      backgroundGradient: ['#B0C0E8', '#D8E4F0'],
      cardGradient: ['#8598C8', '#ABC0D8'],
      shadowColor: '#8598C8',
    },
  },

  slow_breath: {
    id: 'slow_breath',
    quadrant: 'low_unpleasant',
    level: 1,
    title: {
      intuitive: 'ゆっくりした動きを眺める30秒',
      verbal: '停滞した感覚をそのまま見る30秒',
    },
    description: {
      intuitive: '呼吸のゆっくりした動きを、ただ眺めてみます。',
      verbal: '動けない感覚を、無理に変えずにそのまま見つめます。',
    },
    bubbleText: {
      intuitive: 'ゆっくりでいいよ。\n呼吸の動きを眺めてみようね。',
      verbal: '停滞している感じがあるんだね。\nそのまま見つめてみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/slow_breath_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/slow_breath_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_tilting_head.gif'),
    colors: {
      backgroundGradient: ['#9AB0E8', '#C8D8F0'],
      cardGradient: ['#7088C8', '#98B0D8'],
      shadowColor: '#7088C8',
    },
  },

  // ===========================================================================
  // Group 4: 低活性×快（ティール〜ミント系）
  // ===========================================================================
  calm_stay: {
    id: 'calm_stay',
    quadrant: 'low_pleasant',
    level: 1,
    title: {
      intuitive: '今の呼吸を味わう30秒',
      verbal: '落ち着いた状態を保つ30秒',
    },
    description: {
      intuitive: '今の呼吸の出入りを、そのまま静かに感じてみましょう。',
      verbal: '今の穏やかな状態を、そのまま保ってみます。',
    },
    bubbleText: {
      intuitive: '穏やかな状態みたいだね。\nそのまま呼吸を感じてみようね。',
      verbal: '落ち着いているね。\nその状態を保ってみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/calm_stay_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/calm_stay_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_breathing_eye-closed.gif'),
    colors: {
      backgroundGradient: ['#7AD7C8', '#CDEEF0'],
      cardGradient: ['#5ABFB0', '#8AD7C8'],
      shadowColor: '#5ABFB0',
    },
  },

  pleasant_notice: {
    id: 'pleasant_notice',
    quadrant: 'low_pleasant',
    level: 2,
    title: {
      intuitive: '心地よさのある場所に気づく30秒',
      verbal: '穏やかな感覚に注意を向ける30秒',
    },
    description: {
      intuitive: '体のどこかに心地よさがないか、そっと探してみます。',
      verbal: '穏やかな感覚がある場所に、意識を向けてみます。',
    },
    bubbleText: {
      intuitive: '心地よい場所があるかな。\n探してみようね。',
      verbal: '穏やかな感覚があるみたい。\n注意を向けてみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/pleasant_notice_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/pleasant_notice_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_turning_around.gif'),
    colors: {
      backgroundGradient: ['#88DDD0', '#D5F0ED'],
      cardGradient: ['#68C5B8', '#98DDD0'],
      shadowColor: '#68C5B8',
    },
  },

  stillness: {
    id: 'stillness',
    quadrant: 'low_pleasant',
    level: 1,
    title: {
      intuitive: '静けさをそのまま眺める30秒',
      verbal: '何も起きていない感覚に触れる30秒',
    },
    description: {
      intuitive: '今の静けさを、そのまま味わってみます。',
      verbal: '特に何も起きていない、その感覚をただ感じます。',
    },
    bubbleText: {
      intuitive: '静かな時間だね。\nその静けさを眺めてみようね。',
      verbal: '何も起きていない感覚。\nそれをそのまま感じてみようね。',
    },
    audio: {
      rina: require('@/assets/sounds/stillness_30s_rina.m4a'),
      rinawan: require('@/assets/sounds/stillness_30s_rinawan.mp3'),
    },
    mascotGif: require('@/assets/images/rinawan_breathing_eye-closed.gif'),
    colors: {
      backgroundGradient: ['#96E3D8', '#DCF2EF'],
      cardGradient: ['#76CBC0', '#A6E3D8'],
      shadowColor: '#76CBC0',
    },
  },
};

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * コンテンツを取得する
 */
export function getTrainingContent(menuId: MenuId): TrainingContent {
  return TRAINING_CONTENTS[menuId];
}

/**
 * 全メニューIDの一覧を取得
 */
export function getAllMenuIds(): MenuId[] {
  return Object.keys(TRAINING_CONTENTS) as MenuId[];
}

/**
 * メニューIDが有効かどうかを判定
 */
export function isValidMenuId(id: string): id is MenuId {
  return id in TRAINING_CONTENTS;
}

/**
 * 座標から象限を判定
 * @param x - 快-不快軸 (x >= 0: 快, x < 0: 不快)
 * @param y - 活性軸 (y > 0: 高活性, y <= 0: 低活性)
 */
export function getQuadrant(x: number, y: number): Quadrant {
  const isHighArousal = y > 0;
  const isPleasant = x >= 0;

  if (isHighArousal && !isPleasant) return 'high_unpleasant';
  if (isHighArousal && isPleasant) return 'high_pleasant';
  if (!isHighArousal && !isPleasant) return 'low_unpleasant';
  return 'low_pleasant';
}

/**
 * 象限に属するメニューIDリストを取得
 */
export function getMenuIdsByQuadrant(quadrant: Quadrant): MenuId[] {
  return QUADRANT_MENUS[quadrant];
}
