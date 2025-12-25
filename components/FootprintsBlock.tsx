import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = {
  totalCount: number;        // これまでの回数
  startedAtISO?: string;     // 利用開始日（ISO文字列）
  monthCount?: number;       // 今月の回数（任意）
};

function formatStartedAt(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  // 例：2025年3月
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(d);
}

export default function FootprintsBlock({
  totalCount,
  startedAtISO,
  monthCount,
}: Props) {
  const startedLabel = formatStartedAt(startedAtISO);

  // 0回/1回/n回の文言出し分け（評価・達成感を出しすぎない）
  const lines = (() => {
    if (totalCount <= 0) {
      return {
        top: "まだ、ここに",
        mid: "足あとがありません。",
        bottom: "今の気持ちを選ぶところから、始めてみましょう。",
      };
    }
    if (totalCount === 1) {
      return {
        top: "ここに、",
        mid: "ひとつ足あとが残っています。",
        bottom: "思い出したときに、戻ってきて大丈夫です。",
      };
    }
    return {
      top: "これまでに",
      mid: `${totalCount}回 立ち止まっています`,
      bottom: "思い出したときに、ここに戻ってきた回数です。",
    };
  })();

  return (
    <View style={styles.wrap} accessibilityLabel="footprints-block">
      <Text style={styles.top}>{lines.top}</Text>

      {/* 数字が主役になりすぎない程度に、ここだけ少し強調 */}
      <Text style={[styles.mid, totalCount >= 2 && styles.midEmph]}>
        {lines.mid}
      </Text>

      {/* 利用開始日・今月の回数（任意） */}
      {totalCount >= 2 && (startedLabel || typeof monthCount === "number") && (
        <Text style={styles.meta}>
          {startedLabel ? `${startedLabel}から` : ""}
          {typeof monthCount === "number" ? `${startedLabel ? " / " : ""}今月は${monthCount}回` : ""}
        </Text>
      )}

      <Text style={styles.bottom}>{lines.bottom}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  top: {
    fontSize: 14,
    color: "rgba(0,0,0,0.45)",
    marginBottom: 2,
  },
  mid: {
    fontSize: 16,
    color: "rgba(0,0,0,0.55)",
    marginBottom: 6,
  },
  midEmph: {
    fontWeight: "600",
    color: "rgba(0,0,0,0.62)",
  },
  meta: {
    fontSize: 12,
    color: "rgba(0,0,0,0.38)",
    marginBottom: 6,
  },
  bottom: {
    fontSize: 13,
    color: "rgba(0,0,0,0.40)",
    textAlign: "center",
    lineHeight: 18,
  },
});
