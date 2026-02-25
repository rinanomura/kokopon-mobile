import { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { signIn, signOut, getCurrentUser } from "aws-amplify/auth";
import { router } from "expo-router";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const colors = useThemeColors();

  async function onSignIn() {
    setErr(null);
    setBusy(true);
    try {
      // 既存のセッションがあればサインアウト
      try {
        await getCurrentUser();
        await signOut();
      } catch {
        // ユーザーがいない場合は無視
      }

      const result = await signIn({ username: email.trim(), password });
      console.log("サインイン成功:", result);
      // RootLayout が signedIn 判定して /(app) に遷移させます
    } catch (e: any) {
      // エラー詳細を表示
      const errorDetails = [
        e?.message,
        e?.name,
        e?.code,
        e?.underlyingError?.message,
      ].filter(Boolean).join(" | ");

      setErr(errorDetails || JSON.stringify(e));
    } finally {
      setBusy(false);
    }
  }

  const isFormValid = email.trim().length > 0 && password.length > 0;

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          {/* ヘッダー部分 */}
          {colors.showMascot ? (
            <View style={styles.header}>
              <Image
                source={require("@/assets/images/rinawan_tilting_head.gif")}
                style={styles.mascotImage}
                resizeMode="contain"
              />
              <View style={styles.speechBubbleContainer}>
                <View style={[styles.speechBubbleTail, { borderRightColor: colors.bubbleBg[0] }]} />
                <LinearGradient
                  colors={colors.bubbleBg as unknown as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.speechBubble, { borderColor: colors.bubbleBorder }]}
                >
                  <View style={styles.sparkleTopRight}>
                    <Text style={[styles.sparkleText, { color: colors.sparkleColor }]}>✧</Text>
                  </View>
                  <Text style={[styles.speechBubbleText, { color: colors.textSecondary }]}>
                    おかえりなさい！{"\n"}ログインしてね
                  </Text>
                </LinearGradient>
              </View>
            </View>
          ) : (
            <View style={styles.simpleHeader}>
              <Text style={[styles.simpleTitle, { color: colors.textPrimary }]}>
                ログイン
              </Text>
              <Text style={[styles.simpleSubtitle, { color: colors.textSecondary }]}>
                おかえりなさい
              </Text>
            </View>
          )}

          {/* フォーム部分 */}
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>メールアドレス</Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="example@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                style={[styles.input, {
                  backgroundColor: colors.showMascot ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.1)",
                  borderColor: colors.showMascot ? "rgba(255, 255, 255, 0.5)" : colors.cardBorder,
                  color: colors.textPrimary,
                }]}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>パスワード</Text>
              <TextInput
                secureTextEntry
                placeholder="パスワードを入力"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                style={[styles.input, {
                  backgroundColor: colors.showMascot ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.1)",
                  borderColor: colors.showMascot ? "rgba(255, 255, 255, 0.5)" : colors.cardBorder,
                  color: colors.textPrimary,
                }]}
              />
              <TouchableOpacity
                onPress={() => router.push("/(auth)/reset-password")}
                style={styles.forgotPasswordLink}
              >
                <Text style={[styles.forgotPasswordText, { color: colors.textMuted }]}>
                  パスワードをお忘れですか？
                </Text>
              </TouchableOpacity>
            </View>

            {!!err && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{err}</Text>
              </View>
            )}
          </View>

          {/* ボタン部分 */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onSignIn}
              activeOpacity={0.8}
              disabled={busy || !isFormValid}
              style={[styles.buttonWrapper, { shadowColor: colors.buttonShadow }]}
            >
              <LinearGradient
                colors={
                  isFormValid && !busy
                    ? [colors.buttonGradientStart, colors.buttonGradientEnd]
                    : ["#A0AEC0", "#B8C5D0"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>
                  {busy ? "ログイン中..." : "ログイン"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* 新規登録リンク */}
            <TouchableOpacity
              onPress={() => router.push("/(auth)/signup")}
              style={styles.linkButton}
            >
              <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                アカウントをお持ちでない方はこちら
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  mascotImage: {
    width: 110,
    height: 110,
  },
  speechBubbleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  speechBubbleTail: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    marginRight: -1,
  },
  speechBubble: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    position: "relative",
  },
  sparkleTopRight: {
    position: "absolute",
    top: -6,
    right: -4,
  },
  sparkleText: {
    fontSize: 14,
  },
  speechBubbleText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  simpleHeader: {
    alignItems: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  simpleTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  simpleSubtitle: {
    fontSize: 15,
  },
  formContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 4,
  },
  input: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  errorContainer: {
    backgroundColor: "rgba(255, 99, 99, 0.15)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 99, 99, 0.3)",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 13,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: "center",
  },
  buttonWrapper: {
    width: "100%",
    borderRadius: 25,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  button: {
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 16,
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: "underline",
  },
  forgotPasswordLink: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 13,
  },
});
