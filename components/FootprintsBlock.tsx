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
        top: "",
        mid: "まだ記録がありません",
        bottom: "今の気持ちを選ぶところから、始めてみましょう。",
      };
    }
    if (totalCount === 1) {
      return {
        top: "",
        mid: "一度、ここに立ち止まりました",
        bottom: "また気が向いたときに、戻ってきてください。",
      };
    }
    return {
      top: "",
      mid: `${totalCount}回、ここに戻ってきています`,
      bottom: "ふと思い出したときに、立ち止まった記録です。",
    };
  })();

  return (
    <View style={styles.wrap} accessibilityLabel="footprints-block">
      {lines.top ? <Text style={styles.top}>{lines.top}</Text> : null}

      {/* 数字が主役になりすぎない */}
      <Text style={styles.mid}>
        {lines.mid}
      </Text>

      {/* 利用開始日・今月の回数（2回以上のときのみ） */}
      {totalCount >= 2 && (startedLabel || typeof monthCount === "number") && (
        <Text style={styles.meta}>
          {typeof monthCount === "number" ? `今月：${monthCount}回` : ""}
          {typeof monthCount === "number" && startedLabel ? " / " : ""}
          {startedLabel ? `はじめた月：${startedLabel}` : ""}
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
