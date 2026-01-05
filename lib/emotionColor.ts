/**
 * 感情座標（x, y）から HSL カラーを生成するユーティリティ
 *
 * 思想：
 * - 良い／悪いの評価は一切しない
 * - 一般的な色のイメージで直感的に伝える
 *
 * 色のルール（直感的なマッピング）：
 * - 快（x > 0）: 暖色系（黄色〜オレンジ）
 * - 不快（x < 0）: 寒色系（青〜紫）
 * - 高活性（y < 0）: 鮮やか・赤寄り
 * - 低活性（y > 0）: 落ち着き・青/緑寄り
 *
 * 結果：
 * - 快 + 高活性 → オレンジ〜黄色（元気、ワクワク）
 * - 快 + 低活性 → 緑（穏やか、リラックス）
 * - 不快 + 高活性 → 赤〜赤紫（緊張、イライラ）
 * - 不快 + 低活性 → 青〜紫（落ち込み、疲れ）
 */

/**
 * x, y 座標から Hue を計算（直感的な色イメージ）
 */
function calculateHue(x: number, y: number): number {
  // clamp to [-1, 1]
  const clampedX = Math.max(-1, Math.min(1, x));
  const clampedY = Math.max(-1, Math.min(1, y));

  // 基本の色相（xで決定）
  // x = -1（不快）→ 青系 240°
  // x = 0 → 中間
  // x = +1（快）→ 黄色系 50°
  //
  // yで調整（高活性→赤寄り、低活性→青/緑寄り）
  // y = -1（高活性）→ 赤方向にシフト
  // y = +1（低活性）→ 青/緑方向にシフト

  let hue: number;

  if (clampedX >= 0) {
    // 快（右半分）: 黄色〜緑〜オレンジ
    // x: 0→1, 基本H: 60°（黄色）
    // y: -1→+1 で調整: オレンジ(30°)→緑(120°)
    const baseHue = 60;
    const yShift = clampedY * 40; // -40〜+40
    hue = baseHue + yShift; // 20°〜100°
  } else {
    // 不快（左半分）: 青〜紫〜赤紫
    // x: -1→0, 基本H: 260°（青紫）
    // y: -1→+1 で調整: 赤紫(320°)→青(220°)
    const baseHue = 260;
    const yShift = -clampedY * 50; // +50〜-50
    hue = baseHue + yShift; // 210°〜310°
  }

  return ((hue % 360) + 360) % 360;
}

/**
 * x, y 座標から Saturation を計算
 */
function calculateSaturation(x: number, y: number): number {
  const clampedX = Math.max(-1, Math.min(1, x));
  const clampedY = Math.max(-1, Math.min(1, y));

  // 中心からの距離で彩度を決定
  const r = Math.sqrt(clampedX * clampedX + clampedY * clampedY);

  // r: 0→1, S: 60%→85%（全体的に彩度アップ）
  return 60 + r * 25;
}

/**
 * 感情座標からチップ背景色を生成
 *
 * @param x - 快・不快 (-1 = 不快, +1 = 快)
 * @param y - 活性度（画面座標: -1 = 高活性, +1 = 低活性）
 * @param alpha - 透明度 (0-1, デフォルト: 0.5)
 * @returns HSLA カラー文字列
 */
export function emotionToChipColor(
  x: number,
  y: number,
  alpha: number = 0.55
): string {
  const hue = calculateHue(x, y);
  const saturation = calculateSaturation(x, y);
  const lightness = 72; // 明度を下げて色を際立たせる

  return `hsla(${Math.round(hue)}, ${Math.round(saturation)}%, ${lightness}%, ${alpha})`;
}

/**
 * 「未記録」状態のチップ背景色
 * グレー系で控えめに表示
 */
export function getMissingChipColor(alpha: number = 0.35): string {
  return `hsla(210, 10%, 75%, ${alpha})`;
}
