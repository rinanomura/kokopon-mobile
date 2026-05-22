import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// ── Glossary ──
const GLOSSARY: Record<string, string> = {
  BDNF: '脳由来神経栄養因子。神経細胞の成長・修復・シナプス結合の強化を促すタンパク質。運動や瞑想で増加する。',
  HPA軸: '視床下部-下垂体-副腎軸。ストレス応答の中枢経路で、コルチゾールの分泌を制御する。',
  前頭前野: '脳の前方に位置し、意思決定・感情制御・認知的柔軟性を担う領域。扁桃体の暴走を抑制する「ブレーキ」の役割。',
  扁桃体: '脳の側頭葉にある小さなアーモンド形の構造。恐怖や脅威の検出を担い、闘争・逃走反応を起動する。',
  コルチゾール: 'ストレスホルモン。短期的にはエネルギー動員に有用だが、慢性的な高値は炎症・免疫低下・記憶障害を引き起こす。',
  ドーパミン: '報酬系の主要な神経伝達物質。モチベーション・快感・学習に関与する。運動で自然に増加する。',
  迷走神経: '脳と内臓を結ぶ最長の脳神経。副交感神経の主要経路で、心拍・消化・炎症を調節する。呼吸法で活性化できる。',
  HRV: '心拍変動。心拍の間隔のばらつきを示す指標。高いほど自律神経の柔軟性が高く、ストレス適応力がある。',
  グリンファティック: '脳の老廃物除去システム。深い睡眠中に活性化し、アミロイドβなどの代謝産物を洗い流す。',
  リアプレイザル: '認知的再評価。出来事の意味づけを変えることで感情反応を調節する前頭前野の機能。',
  内受容感覚: '身体内部の状態（心拍、呼吸、内臓感覚）を感じ取る能力。瞑想で鍛えられ、感情認識の基盤となる。',
  セロトニン: '気分の安定・睡眠・食欲を調節する神経伝達物質。約90%が腸で産生される。トリプトファンから合成される。',
  ミトコンドリア: '細胞内のエネルギー工場。ATPを産生する。運動で数と機能が向上し、身体のエネルギー効率が上がる。',
  副交感神経: '自律神経の「休息と回復」モード。心拍を下げ、消化を促進し、身体を修復モードにする。',
  交感神経: '自律神経の「闘争・逃走」モード。心拍・血圧を上げ、身体を活動モードにする。',
  低グレード炎症: '自覚症状のない慢性的な軽度の炎症。疲労感・認知機能低下・気分の重さの原因となる。',
  減衰係数: '振動が収まる速さを表す物理用語。ここでは感情的な揺れがどれだけ早く安定に戻るかの比喩。',
  トリプトファン: 'セロトニンの前駆体となる必須アミノ酸。食事から摂取する必要があり、腸内環境がその変換効率に影響する。',
  オメガ3: '魚油・亜麻仁油に含まれる必須脂肪酸。抗炎症作用があり、BDNF産生を促進し、神経細胞膜の柔軟性を高める。',
  低GI食: '血糖値の上昇が緩やかな食品。血糖の急激な変動を防ぎ、HPA軸の不要な発火を抑えてコルチゾールを安定させる。',
};

// Sort terms by length descending to match longer terms first
const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

// ── Color tokens (light theme, adapted from HTML) ──
const C = {
  // Axes
  body: '#6aab9e',
  mind: '#5a9a5a',
  // Reactivity states
  r1: '#5a8fc0', // State A
  r2: '#c49030', // State B
  r3: '#8b6ec0', // State C
  // Four elements
  ex: '#d08540', // Exercise
  sl: '#8b6ec0', // Sleep
  di: '#c45c6a', // Diet
  med: '#4ea892', // Meditation
  // Inflammation
  inflam: '#c45c6a',
  // Backgrounds
  bodyBg: '#edf7f4',
  mindBg: '#f0f8f0',
  r1Bg: '#eef4fb',
  r2Bg: '#fdf5e8',
  r3Bg: '#f3eefb',
  exBg: '#fdf3e8',
  slBg: '#f3eefb',
  diBg: '#fceef0',
  medBg: '#ecf7f3',
  posBg: 'rgba(90,154,90,0.08)',
  negBg: 'rgba(196,92,106,0.08)',
};

// ── Data ──

type AxisCard = {
  num: string;
  title: string;
  desc: string;
  color: string;
};

const PREMISE_AXES: AxisCard[] = [
  {
    num: 'AXIS 01',
    title: '身体が重い／軽い',
    desc: '代謝・炎症・回復の問題。自律神経のハードウェア状態。低グレード炎症は重さの直接要因。',
    color: C.body,
  },
  {
    num: 'AXIS 02',
    title: '心が重い／軽い',
    desc: '報酬系＋自律神経＋予測整合。認知エネルギー経済の状態。神経炎症は前頭前野を疲弊させる。',
    color: C.mind,
  },
  {
    num: 'AXIS 03 — 三状態',
    title: '心の反応性',
    desc: '扁桃体＋HPA軸の感度。閾値×収束速度で三つに分かれる。',
    color: C.r1,
  },
];

type ReactState = {
  label: string;
  name: string;
  desc: string;
  color: string;
};

const REACT_STATES: ReactState[] = [
  {
    label: 'State A',
    name: '敏感だがすぐに安定',
    desc: '扁桃体が反応するが、前頭前野のリアプレイザルが速い。迷走神経トーン高、HRV高値。健全な反応性。',
    color: C.r1,
  },
  {
    label: 'State B',
    name: '敏感が続く',
    desc: '前頭前野の抑制が追いつかない。情動残響が長い。HPA軸過活動。消耗する反応性。',
    color: C.r2,
  },
  {
    label: 'State C',
    name: '常に安定',
    desc: '扁桃体閾値が高い、または前頭前野の抑制が常時強い。鈍化・凍結との区別が必要。',
    color: C.r3,
  },
];

type EffectItem = { type: 'pos' | 'neg' | 'key'; text: string };

type AxisEffect = {
  axisLabel: string;
  axisColor: string;
  items: EffectItem[];
};

type ReactivityEffect = {
  stateA: string;
  stateB: string;
  stateC: string;
};

type ElementSection = {
  num: string;
  enLabel: string;
  title: string;
  color: string;
  bg: string;
  desc: string;
  effects: AxisEffect[];
  reactivity: ReactivityEffect;
  keyInsight?: string;
};

const ELEMENTS: ElementSection[] = [
  {
    num: '01',
    enLabel: 'Meditation',
    title: '瞑想',
    color: C.med,
    bg: C.medBg,
    desc: '感情を消すのでもない。鈍くするのでもない。振動の減衰係数を上げる技術。トップダウン経路では前頭前野が扁桃体への抑制性投射を強化し、HPA軸の過剰発火を抑え、コルチゾールが安定する。BDNFが増加しこの回路がさらに太くなる。ボトムアップ経路では呼吸の減速が迷走神経を活性化し、交感神経を鎮め、身体の慢性的な緊張パターンを解除する。この経路は炎症も抑制する。二つの経路が同時に動くから、敏感でも安定できる。',
    effects: [
      {
        axisLabel: '身体',
        axisColor: C.body,
        items: [
          { type: 'pos', text: '迷走神経トーン↑ → 副交感優位 → 身体の慢性緊張パターン解除。呼吸を整えることで迷走神経が活性化し、コルチゾールの安定と炎症の抑制が同時に起きる' },
          { type: 'key', text: '呼吸を整えるだけで身体ルートからコルチゾールと炎症の両方を下げられる' },
        ],
      },
      {
        axisLabel: '心',
        axisColor: C.mind,
        items: [
          { type: 'pos', text: '前頭前野→扁桃体の抑制回路強化 → HPA軸安定 → コルチゾール正常化。警報が減り戦闘モードが減る' },
          { type: 'pos', text: 'BDNF↑ → 前頭前野のシナプス強化 → 認知再評価（リアプレイザル）の速度↑ → 「戻る回路」が物理的に強くなる' },
        ],
      },
    ],
    reactivity: {
      stateA: '最も効果を実感しやすい。既に収束力がある状態で、前頭前野の回路がさらに効率化。減衰がさらに速くなる。',
      stateB: '瞑想の核心的ターゲット。「反応は起きた。しかし巻き込まれない」を体験として学習。前頭前野→扁桃体の抑制回路を繰り返し訓練し、BDNF↑で回路を固定。情動残響の持続時間が短縮していく。',
      stateC: '鈍化・凍結由来の場合、内受容感覚（interoception）の訓練を通じて、抑圧された情動信号を安全に再接続。感度の適正化。',
    },
    keyInsight: '瞑想の本質：トップダウン（前頭前野→扁桃体抑制→コルチゾール安定）とボトムアップ（呼吸→迷走神経→緊張解除＋炎症↓）が同時に作動する。BDNFが増加し前頭前野の「戻る回路」が物理的に太くなる。これが減衰係数を上げる訓練の実体。敏感でも安定できる。',
  },
  {
    num: '02',
    enLabel: 'Exercise',
    title: '運動',
    color: C.ex,
    bg: C.exBg,
    desc: '報酬系を直接刺激する数少ない行為。コルチゾールを一過性に上げた後、正常な日内リズムへの復帰を促す。同時にBDNFを増加させ、前頭前野のシナプス結合を強化する。つまり即応性と可塑性の両方を同時にチューニングする。定期的な運動は扁桃体の過活動を抑制し、慢性的な炎症も低下させる。ただし過負荷は逆効果。ポイントは「回復できる量」。',
    effects: [
      {
        axisLabel: '身体',
        axisColor: C.body,
        items: [
          { type: 'pos', text: '軽い有酸素運動 → 血流改善・ミトコンドリア活性。運動後のコルチゾール低下が日内リズムを整え、慢性的な炎症も下がる → 身体を軽くする' },
          { type: 'neg', text: '過負荷 → コルチゾール過剰＋炎症増加が回復を上回り、身体を重くする' },
        ],
      },
      {
        axisLabel: '心',
        axisColor: C.mind,
        items: [
          { type: 'pos', text: 'リズム運動 → ドーパミン↑ BDNF↑ → 心を軽く。BDNFが前頭前野を強化し、扁桃体への抑制が効率化。「戻る回路」が太くなる' },
          { type: 'key', text: '報酬系を直接刺激する数少ない行為' },
        ],
      },
    ],
    reactivity: {
      stateA: '収束力を強化。迷走神経トーン↑で戻るスピードが速くなる。最も恩恵が大きい。',
      stateB: '前頭前野→扁桃体の制御回路を強化。ただし過負荷はHPA軸をさらに刺激し逆効果。',
      stateC: '鈍化由来の場合、適度な運動刺激が感度を回復させる。凍結状態の解除に有効。',
    },
  },
  {
    num: '03',
    enLabel: 'Sleep',
    title: '睡眠',
    color: C.sl,
    bg: C.slBg,
    desc: '身体回復の主装置にして、三軸すべてを同時にリセットする唯一の生理プロセス。深い徐波睡眠中に成長ホルモンが分泌され、組織が修復される。グリンファティック系が代謝老廃物を洗い流し、前頭前野の機能が回復する。HPA軸がリセットされ、コルチゾールの日内リズムが正常化する。睡眠不足はたった1晩で扁桃体の反応性を60%増大させ、前頭前野による抑制が効かなくなる。炎症も即座に上昇する。State AをState Bに押し下げる最大のリスク因子。',
    effects: [
      {
        axisLabel: '身体',
        axisColor: C.body,
        items: [
          { type: 'pos', text: '深い睡眠 → 成長ホルモン分泌で組織修復。HPA軸がリセットされコルチゾールの日内リズムが正常化 → 軽くなる' },
          { type: 'neg', text: '睡眠不足 → コルチゾールリズム崩壊＋炎症上昇＋代謝効率低下 → 身体が重くなる' },
        ],
      },
      {
        axisLabel: '心',
        axisColor: C.mind,
        items: [
          { type: 'pos', text: 'グリンファティック洗浄 → 代謝老廃物を除去し前頭前野回復。ドーパミン受容体もリセットされ、報酬系が正常化' },
          { type: 'neg', text: '睡眠不足 → 扁桃体が過活動（60%↑）になり、前頭前野の抑制が追いつかなくなる → 心が重くなる' },
        ],
      },
    ],
    reactivity: {
      stateA: 'この状態を維持。REM睡眠で日中の情動記憶を処理し、翌日の収束力を保つ。',
      stateB: '最重要介入点。HPA軸をリセットし扁桃体閾値を正常化。睡眠不足はState B固着の最大要因。コルチゾール過剰が続くとBDNFが抑制され、回復力そのものが低下する。',
      stateC: 'REM睡眠中の情動再処理が適度な感度回復を促す。凍結由来の鈍化を緩やかに解除。',
    },
  },
  {
    num: '04',
    enLabel: 'Diet',
    title: '食事',
    color: C.di,
    bg: C.diBg,
    desc: '血糖の安定がコルチゾールの安定に直結する。血糖が急落すると身体は「エネルギー危機」と判断し、HPA軸が発火してコルチゾールが上昇する。この繰り返しが慢性化すると、扁桃体の閾値が下がり反応性が持続化する。逆に安定した栄養はHPA軸を穏やかに保ち、BDNFの産生も支える。オメガ3脂肪酸はBDNF産生を促進し、発酵食品は腸内環境を介してセロトニン前駆体（トリプトファン）の供給を安定させる。超加工食品は慢性的な炎症を招き、炎症は扁桃体の閾値を下げ、前頭前野を疲弊させる。',
    effects: [
      {
        axisLabel: '身体',
        axisColor: C.body,
        items: [
          { type: 'pos', text: '低GI食・オメガ3・発酵食品 → 血糖安定でコルチゾールの不要な発火を防ぐ。オメガ3はBDNF産生を促進し、炎症も抑える → 身体軽い' },
          { type: 'neg', text: '超加工食品・高糖質 → 血糖乱高下→コルチゾール頻発。慢性的な炎症が身体を重くする' },
        ],
      },
      {
        axisLabel: '心',
        axisColor: C.mind,
        items: [
          { type: 'pos', text: '安定した栄養 → 血糖安定→HPA軸が穏やかに→コルチゾール安定→心が軽い。腸内環境改善でセロトニン前駆体の供給も安定' },
          { type: 'neg', text: '血糖急落 → 「エネルギー危機」としてHPA軸が発火 → コルチゾール↑ → 扁桃体閾値↓ → 心が重い' },
        ],
      },
    ],
    reactivity: {
      stateA: 'カフェイン過多で収束が遅れState B側へ。血糖安定でこの状態を維持。',
      stateB: '血糖乱高下がHPA軸を繰り返し刺激し、コルチゾール過剰→扁桃体閾値低下の悪循環。安定栄養が基盤改善になる。',
      stateC: '栄養で維持。ただしカフェイン・刺激物で閾値が下がり崩れうる。',
    },
    keyInsight: '食事の特性：即効性は低いが基盤としての影響力が最大。血糖安定がHPA軸を穏やかに保ち、オメガ3がBDNFを支え、炎症の慢性ソース（超加工食品）を減らすだけで、運動・睡眠・瞑想の効果がすべて底上げされる。',
  },
];

type SummaryRow = {
  label: string;
  color: string;
  body: string;
  mind: string;
  stateA: string;
  stateB: string;
  stateC: string;
};

const SUMMARY_ROWS: SummaryRow[] = [
  { label: '瞑想', color: C.med, body: '迷走神経↑', mind: '前頭前野強化', stateA: '減衰をさらに速く', stateB: '核心ターゲット', stateC: '内受容感覚回復' },
  { label: '運動', color: C.ex, body: '代謝改善で軽く', mind: 'ドーパミン↑で軽く', stateA: '収束力を強化', stateB: '制御回路↑', stateC: '感度を回復' },
  { label: '睡眠', color: C.sl, body: '修復で軽く', mind: '前頭前野回復', stateA: '維持', stateB: '閾値正常化', stateC: 'REM情動処理' },
  { label: '食事', color: C.di, body: '血糖安定で軽く', mind: '予測安定で軽く', stateA: 'カフェインで崩れる', stateB: '血糖乱高下で悪化', stateC: '栄養で維持' },
];

type EssenceCard = {
  label: string;
  value: string;
  desc: string;
  color: string;
};

const ESSENCE: EssenceCard[] = [
  { label: '身体の軽さ', value: '代謝', desc: 'エネルギー効率と炎症制御', color: C.body },
  { label: '心の軽さ', value: '報酬＋安全', desc: 'ドーパミン系と予測整合', color: C.mind },
  { label: '反応性の質', value: '収束力', desc: '敏感さではなく、戻れるかどうか', color: C.r1 },
];

// ── Components ──

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={s.pill}>
      <View style={[s.pillDot, { backgroundColor: color }]} />
      <Text style={s.pillText}>{label}</Text>
    </View>
  );
}

function MatrixTable() {
  const headers = [
    { label: '身体', color: C.body },
    { label: '心', color: C.mind },
    { label: '反応性', color: C.r1 },
  ];
  const rows = [
    { label: '瞑想', color: C.med, vals: ['迷走神経↑', '前頭前野強化', '減衰係数↑'] },
    { label: '運動', color: C.ex, vals: ['代謝改善で軽く', 'ドーパミン↑で軽く', '収束力↑'] },
    { label: '睡眠', color: C.sl, vals: ['修復で軽く', '前頭前野回復', '閾値正常化'] },
    { label: '食事', color: C.di, vals: ['血糖安定で軽く', '予測安定で軽く', '刺激物→持続化'] },
  ];

  return (
    <View style={s.matrix}>
      {/* Header row */}
      <View style={s.matrixRow}>
        <View style={[s.matrixCell, s.matrixHeader, { flex: 1 }]} />
        {headers.map((h, i) => (
          <View key={i} style={[s.matrixCell, s.matrixHeader, { flex: 1.2 }]}>
            <View style={[s.matrixDot, { backgroundColor: h.color }]} />
            <Text style={s.matrixHeaderText}>{h.label}</Text>
          </View>
        ))}
      </View>
      {/* Data rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={[s.matrixRow, ri === rows.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={[s.matrixCell, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
            <View style={[s.matrixDot, { backgroundColor: row.color }]} />
            <Text style={s.matrixRowLabel}>{row.label}</Text>
          </View>
          {row.vals.map((v, vi) => (
            <View key={vi} style={[s.matrixCell, { flex: 1.2 }]}>
              <Text style={s.matrixVal}>{v}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function PremiseCard({ axis, onTermPress }: { axis: AxisCard; onTermPress: (t: string) => void }) {
  return (
    <View style={s.premiseCard}>
      <View style={[s.premiseStripe, { backgroundColor: axis.color }]} />
      <Text style={[s.premiseNum, { color: axis.color }]}>{axis.num}</Text>
      <Text style={[s.premiseTitle, { color: axis.color }]}>{axis.title}</Text>
      <RichText text={axis.desc} style={s.premiseDesc} onTermPress={onTermPress} />
    </View>
  );
}

function ReactStateCard({ state, onTermPress }: { state: ReactState; onTermPress: (t: string) => void }) {
  return (
    <View style={[s.reactCard, { borderLeftColor: state.color }]}>
      <Text style={[s.reactLabel, { color: state.color }]}>{state.label}</Text>
      <Text style={[s.reactName, { color: state.color }]}>{state.name}</Text>
      <RichText text={state.desc} style={s.reactDesc} onTermPress={onTermPress} />
    </View>
  );
}

function EffectIcon({ type }: { type: 'pos' | 'neg' | 'key' }) {
  const map = {
    pos: { bg: C.posBg, color: C.mind, icon: '\u2191' },
    neg: { bg: C.negBg, color: C.inflam, icon: '\u2193' },
    key: { bg: 'transparent', color: '#A0AEC0', icon: '\u25CE' },
  };
  const m = map[type];
  return (
    <View style={[s.effectIcon, { backgroundColor: m.bg }]}>
      <Text style={[s.effectIconText, { color: m.color }]}>{m.icon}</Text>
    </View>
  );
}

function EffectCard({ effect, onTermPress }: { effect: AxisEffect; onTermPress: (t: string) => void }) {
  return (
    <View style={s.effectCard}>
      <View style={s.effectHeader}>
        <View style={[s.effectDot, { backgroundColor: effect.axisColor }]} />
        <Text style={[s.effectAxisLabel, { color: effect.axisColor }]}>{effect.axisLabel}</Text>
      </View>
      {effect.items.map((item, i) => (
        <View key={i} style={s.effectRow}>
          <EffectIcon type={item.type} />
          <RichText text={item.text} style={s.effectText} onTermPress={onTermPress} />
        </View>
      ))}
    </View>
  );
}

function ReactivitySection({ reactivity, color, onTermPress }: { reactivity: ReactivityEffect; color: string; onTermPress: (t: string) => void }) {
  const states = [
    { label: 'State A', name: 'すぐ安定', text: reactivity.stateA, color: C.r1 },
    { label: 'State B', name: '敏感が続く', text: reactivity.stateB, color: C.r2 },
    { label: 'State C', name: '常に安定', text: reactivity.stateC, color: C.r3 },
  ];
  return (
    <View style={s.reactivitySection}>
      <Text style={[s.reactivityTitle, { color }]}>反応性三状態への影響</Text>
      {states.map((st, i) => (
        <View key={i} style={[s.reactivityRow, { borderLeftColor: st.color }]}>
          <Text style={[s.reactivityStateLabel, { color: st.color }]}>
            {st.label}: {st.name}
          </Text>
          <RichText text={st.text} style={s.reactivityStateText} onTermPress={onTermPress} />
        </View>
      ))}
    </View>
  );
}

function ElementBlock({ element, onTermPress }: { element: ElementSection; onTermPress: (t: string) => void }) {
  return (
    <View style={s.elementBlock}>
      <Text style={[s.elementNum, { color: element.color }]}>
        {element.num} — {element.enLabel}
      </Text>
      <Text style={[s.elementTitle, { color: element.color }]}>{element.title}</Text>
      <RichText text={element.desc} style={s.elementDesc} onTermPress={onTermPress} />

      {/* Effects grid */}
      <View style={s.effectsGrid}>
        {element.effects.map((eff, i) => (
          <EffectCard key={i} effect={eff} onTermPress={onTermPress} />
        ))}
      </View>

      {/* Reactivity */}
      <ReactivitySection reactivity={element.reactivity} color={element.color} onTermPress={onTermPress} />

      {/* Key insight */}
      {element.keyInsight && (
        <View style={[s.keyInsight, { borderLeftColor: element.color }]}>
          <RichText text={element.keyInsight} style={s.keyInsightText} onTermPress={onTermPress} />
        </View>
      )}
    </View>
  );
}

function SummaryTable() {
  return (
    <View style={s.summaryCard}>
      <LinearGradient
        colors={[C.med, C.ex, C.sl, C.di]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.summaryStripe}
      />
      <Text style={s.summaryTitle}>四要素 × 三軸 サマリー</Text>
      {/* Column headers */}
      <View style={s.summaryHeaderRow}>
        <View style={{ flex: 1.2 }} />
        <Text style={[s.summaryHeaderCell, { color: C.body }]}>身体</Text>
        <Text style={[s.summaryHeaderCell, { color: C.mind }]}>心</Text>
        <Text style={[s.summaryHeaderCell, { color: C.r1 }]}>A</Text>
        <Text style={[s.summaryHeaderCell, { color: C.r2 }]}>B</Text>
        <Text style={[s.summaryHeaderCell, { color: C.r3 }]}>C</Text>
      </View>
      {SUMMARY_ROWS.map((row, i) => (
        <View key={i} style={[s.summaryDataRow, i < SUMMARY_ROWS.length - 1 && s.summaryRowBorder]}>
          <View style={[s.summaryLabelCell, { flex: 1.2 }]}>
            <View style={[s.matrixDot, { backgroundColor: row.color }]} />
            <Text style={[s.summaryLabelText, { color: row.color }]}>{row.label}</Text>
          </View>
          <Text style={s.summaryDataCell}>{row.body}</Text>
          <Text style={s.summaryDataCell}>{row.mind}</Text>
          <Text style={[s.summaryDataCell, { color: C.r1 }]}>{row.stateA}</Text>
          <Text style={[s.summaryDataCell, { color: C.r2 }]}>{row.stateB}</Text>
          <Text style={[s.summaryDataCell, { color: C.r3 }]}>{row.stateC}</Text>
        </View>
      ))}
    </View>
  );
}

function EssenceCards() {
  return (
    <View style={s.essenceGrid}>
      {ESSENCE.map((e, i) => (
        <View key={i} style={s.essenceCard}>
          <View style={[s.essenceStripe, { backgroundColor: e.color }]} />
          <Text style={s.essenceLabel}>{e.label}</Text>
          <Text style={[s.essenceValue, { color: e.color }]}>{e.value}</Text>
          <Text style={s.essenceDesc}>{e.desc}</Text>
        </View>
      ))}
    </View>
  );
}

// ── RichText (glossary-aware) ──

function RichText({
  text,
  style,
  onTermPress,
}: {
  text: string;
  style?: any;
  onTermPress: (term: string) => void;
}) {
  const parts: { text: string; isTerm: boolean }[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliest = -1;
    let matchedTerm = '';
    for (const term of GLOSSARY_TERMS) {
      const idx = remaining.indexOf(term);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        matchedTerm = term;
      }
    }
    if (earliest === -1) {
      parts.push({ text: remaining, isTerm: false });
      break;
    }
    if (earliest > 0) {
      parts.push({ text: remaining.slice(0, earliest), isTerm: false });
    }
    parts.push({ text: matchedTerm, isTerm: true });
    remaining = remaining.slice(earliest + matchedTerm.length);
  }

  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.isTerm ? (
          <Text
            key={i}
            style={s.glossaryTerm}
            onPress={() => onTermPress(p.text)}
          >
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}

function GlossaryModal({
  term,
  onClose,
}: {
  term: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={term !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={() => {}}>
          <Text style={s.modalTitle}>{term}</Text>
          <Text style={s.modalDesc}>{term ? GLOSSARY[term] : ''}</Text>
          <Pressable style={s.modalClose} onPress={onClose}>
            <Text style={s.modalCloseText}>閉じる</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main Screen ──

export default function LearnScreen() {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const handleTermPress = (term: string) => setSelectedTerm(term);

  return (
    <LinearGradient colors={['#FFF5F7', '#F0F4FF']} style={s.gradient}>
      <SafeAreaView style={s.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={s.hero}>
            <Text style={s.heroLabel}>NEUROLOGICAL MINDFULNESS FRAMEWORK</Text>
            <Text style={s.heroTitle}>
              <Text style={{ color: C.med }}>瞑想</Text>・
              <Text style={{ color: C.ex }}>運動</Text>・
              <Text style={{ color: C.sl }}>睡眠</Text>・
              <Text style={{ color: C.di }}>食事</Text>
            </Text>
            <Text style={s.heroSub}>
              四つの生活要素は「気分の調整」ではなく「生理の調整」。{'\n'}
              三軸すべてに同時に作用する。{'\n'}
              瞑想は感情を消すのではない。振動の収束係数を上げる技術。
            </Text>
            <View style={s.pillRow}>
              <Pill label="身体" color={C.body} />
              <Pill label="心" color={C.mind} />
              <Pill label="反応性" color={C.r1} />
              <Pill label="炎症" color={C.inflam} />
            </View>

            <View style={{ marginTop: 24, width: '100%' }}>
              <MatrixTable />
            </View>
          </View>

          <View style={s.divider} />

          {/* ── Premise ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>PREMISE</Text>
            <Text style={s.sectionTitle}>前提：三つの軸</Text>
            <Text style={s.sectionDesc}>
              反応性は三状態に分かれる。「敏感であること」自体は問題ではない。収束できるかが分岐点。
            </Text>

            {PREMISE_AXES.map((axis, i) => (
              <PremiseCard key={i} axis={axis} onTermPress={handleTermPress} />
            ))}

            <Text style={[s.sectionSubhead, { marginTop: 20, marginBottom: 8 }]}>
              反応性の三状態
            </Text>
            {REACT_STATES.map((state, i) => (
              <ReactStateCard key={i} state={state} onTermPress={handleTermPress} />
            ))}
          </View>

          <View style={s.divider} />

          {/* ── Four Elements ── */}
          {ELEMENTS.map((element, i) => (
            <React.Fragment key={i}>
              <ElementBlock element={element} onTermPress={handleTermPress} />
              {i < ELEMENTS.length - 1 && <View style={s.divider} />}
            </React.Fragment>
          ))}

          <View style={s.divider} />

          {/* ── Integration ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>INTEGRATION</Text>
            <Text style={s.sectionTitle}>全体統合</Text>

            <SummaryTable />
            <EssenceCards />

            {/* Final message */}
            <View style={s.finalCard}>
              <LinearGradient
                colors={[C.med, C.ex, C.sl, C.di]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.finalStripe}
              />
              <Text style={s.finalText}>
                <Text style={s.finalBold}>心の安定は意志の産物ではない。</Text>
                {'\n'}
                <RichText text="エネルギー経済と安全経済のバランスである。整えば軽い。乱れれば重い。" onTermPress={handleTermPress} />
                {'\n\n'}
                <Text style={s.finalBold}>ストレスは振動。健康は振動が止まることではない。振動が収束すること。</Text>
                {'\n\n'}
                <RichText text="反応性の本質は「敏感かどうか」ではなく" onTermPress={handleTermPress} />
                <Text style={s.finalBold}>「戻れるかどうか」</Text>。{'\n'}
                <RichText text="敏感に反応してすぐ安定する状態こそ、最も健全な神経系の姿。" onTermPress={handleTermPress} />
                {'\n\n'}
                <RichText text="瞑想・運動・睡眠・食事はこの三軸すべてに同時に作用する。" onTermPress={handleTermPress} />
                {'\n'}
                <RichText text="「気持ちの持ちよう」ではなく、" onTermPress={handleTermPress} />
                <Text style={s.finalBold}>「生理の調整」として設計する</Text>
                <RichText text="のが正確。" onTermPress={handleTermPress} />
                {'\n\n'}
                <Text style={s.finalBold}>瞑想は、その収束係数を上げる技術。</Text>
                {'\n'}
                <RichText text="前頭前野→扁桃体のトップダウン制御と、" onTermPress={handleTermPress} />
                {'\n'}
                <RichText text="呼吸→迷走神経のボトムアップ調整。" onTermPress={handleTermPress} />
                {'\n'}
                <RichText text="この二つの経路が同時に動くから、敏感でも安定できる。" onTermPress={handleTermPress} />
              </Text>
            </View>
          </View>

          <View style={s.bottomSpacer} />
        </ScrollView>

        <GlossaryModal term={selectedTerm} onClose={() => setSelectedTerm(null)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ──

const s = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  heroLabel: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 3,
    color: '#A0AEC0',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '300',
    color: '#2D3748',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 16,
  },
  heroSub: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#FFFFFF',
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, color: '#718096', fontWeight: '400' },

  // Matrix table
  matrix: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  matrixRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  matrixCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixHeader: {
    backgroundColor: '#F7FAFC',
    flexDirection: 'row',
    gap: 3,
  },
  matrixHeaderText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#718096',
    letterSpacing: 0.5,
  },
  matrixDot: { width: 6, height: 6, borderRadius: 3 },
  matrixRowLabel: { fontSize: 12, fontWeight: '500', color: '#4A5568' },
  matrixVal: { fontSize: 11, color: '#718096', textAlign: 'center', lineHeight: 16 },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 40,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },

  // Section
  section: { padding: 20, paddingTop: 32 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 2,
    color: '#A0AEC0',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '300',
    color: '#2D3748',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#718096',
    lineHeight: 22,
    marginBottom: 20,
  },
  sectionSubhead: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4A5568',
  },

  // Premise cards
  premiseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 16,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  premiseStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  premiseNum: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 2,
    marginBottom: 4,
  },
  premiseTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  premiseDesc: {
    fontSize: 13,
    color: '#718096',
    lineHeight: 21,
  },

  // React state cards
  reactCard: {
    backgroundColor: '#F7FAFC',
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  reactLabel: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  reactName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  reactDesc: {
    fontSize: 12,
    color: '#718096',
    lineHeight: 20,
  },

  // Element block
  elementBlock: { padding: 20, paddingTop: 32, paddingBottom: 16 },
  elementNum: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 2,
    marginBottom: 4,
  },
  elementTitle: {
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 30,
    marginBottom: 6,
  },
  elementDesc: {
    fontSize: 13,
    color: '#718096',
    lineHeight: 22,
    marginBottom: 20,
  },

  // Effects grid
  effectsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  effectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
  },
  effectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  effectDot: { width: 5, height: 5, borderRadius: 3 },
  effectAxisLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  effectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  effectIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  effectIconText: {
    fontSize: 11,
    fontWeight: '700',
  },
  effectText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    color: '#4A5568',
  },

  // Reactivity section
  reactivitySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
    marginBottom: 16,
  },
  reactivityTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  reactivityRow: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginBottom: 10,
  },
  reactivityStateLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  reactivityStateText: {
    fontSize: 12,
    color: '#718096',
    lineHeight: 20,
  },

  // Key insight
  keyInsight: {
    backgroundColor: '#F7FAFC',
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 16,
  },
  keyInsightText: {
    fontSize: 13,
    lineHeight: 22,
    color: '#4A5568',
  },

  // Summary table
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  summaryStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#2D3748',
    marginBottom: 14,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    marginBottom: 4,
  },
  summaryHeaderCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  summaryDataRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  summaryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  summaryLabelCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryLabelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryDataCell: {
    flex: 1,
    fontSize: 10,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Essence cards
  essenceGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  essenceCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  essenceStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  essenceLabel: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 1.5,
    color: '#A0AEC0',
    marginBottom: 4,
  },
  essenceValue: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  essenceDesc: {
    fontSize: 10,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 15,
  },

  // Final card
  finalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  finalStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  finalText: {
    fontSize: 13,
    lineHeight: 24,
    color: '#718096',
  },
  finalBold: {
    fontWeight: '600',
    color: '#2D3748',
  },

  bottomSpacer: { height: 40 },

  // Glossary term
  glossaryTerm: {
    color: '#5a8fc0',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  modalDesc: {
    fontSize: 14,
    lineHeight: 24,
    color: '#4A5568',
    marginBottom: 20,
  },
  modalClose: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
  },
  modalCloseText: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
  },
});
