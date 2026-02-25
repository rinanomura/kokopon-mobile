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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { resetPassword, confirmResetPassword } from "aws-amplify/auth";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";

type Step = "request" | "confirm";

export default function ResetPasswordScreen() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const colors = useThemeColors();

  // ステップ1: リセットコードをリクエスト
  async function onRequestReset() {
    setErr(null);
    setBusy(true);
    try {
      await resetPassword({ username: email.trim() });
      setStep("confirm");
    } catch (e: any) {
      const errorMessage = e?.message || "エラーが発生しました";
      setErr(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  // ステップ2: 新しいパスワードを設定
  async function onConfirmReset() {
    setErr(null);

    if (newPassword !== confirmPassword) {
      setErr("パスワードが一致しません");
      return;
    }

    if (newPassword.length < 8) {
      setErr("パスワードは8文字以上にしてください");
      return;
    }

    setBusy(true);
    try {
      await confirmResetPassword({
        username: email.trim(),
        confirmationCode: code.trim(),
        newPassword,
      });
      // 成功したらサインイン画面に戻る
      router.replace("/(auth)/signin");
    } catch (e: any) {
      const errorMessage = e?.message || "エラーが発生しました";
      setErr(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  const isRequestValid = email.trim().length > 0;
  const isConfirmValid =
    code.trim().length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0;

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          {/* 戻るボタン */}
          <View style={styles.headerNav}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backButton, {
                backgroundColor: colors.showMascot ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.1)",
              }]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
                    <Text style={[styles.speechBubbleText, { color: colors.textSecondary }]}>
                      {step === "request"
                        ? "メールアドレスを\n入力してね"
                        : "届いたコードを\n入力してね"}
                    </Text>
                  </LinearGradient>
                </View>
              </View>
            ) : (
              <View style={styles.simpleHeader}>
                <Text style={[styles.simpleTitle, { color: colors.textPrimary }]}>
                  パスワードリセット
                </Text>
                <Text style={[styles.simpleSubtitle, { color: colors.textSecondary }]}>
                  {step === "request"
                    ? "メールアドレスを入力してください"
                    : "届いたコードを入力してください"}
                </Text>
              </View>
            )}

            {/* フォーム部分 */}
            <View style={styles.formContainer}>
              {step === "request" ? (
                // ステップ1: メールアドレス入力
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
                  <Text style={[styles.hint, { color: colors.textMuted }]}>
                    登録済みのメールアドレスにリセットコードを送信します
                  </Text>
                </View>
              ) : (
                // ステップ2: コードと新しいパスワード入力
                <>
                  <View style={styles.inputWrapper}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>確認コード</Text>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="6桁のコードを入力"
                      placeholderTextColor={colors.textMuted}
                      value={code}
                      onChangeText={setCode}
                      style={[styles.input, {
                        backgroundColor: colors.showMascot ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.1)",
                        borderColor: colors.showMascot ? "rgba(255, 255, 255, 0.5)" : colors.cardBorder,
                        color: colors.textPrimary,
                      }]}
                      maxLength={6}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>新しいパスワード</Text>
                    <TextInput
                      secureTextEntry
                      placeholder="8文字以上"
                      placeholderTextColor={colors.textMuted}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      style={[styles.input, {
                        backgroundColor: colors.showMascot ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.1)",
                        borderColor: colors.showMascot ? "rgba(255, 255, 255, 0.5)" : colors.cardBorder,
                        color: colors.textPrimary,
                      }]}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>パスワード（確認）</Text>
                    <TextInput
                      secureTextEntry
                      placeholder="もう一度入力"
                      placeholderTextColor={colors.textMuted}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      style={[styles.input, {
                        backgroundColor: colors.showMascot ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.1)",
                        borderColor: colors.showMascot ? "rgba(255, 255, 255, 0.5)" : colors.cardBorder,
                        color: colors.textPrimary,
                      }]}
                    />
                  </View>
                </>
              )}

              {!!err && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{err}</Text>
                </View>
              )}
            </View>

            {/* ボタン部分 */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={step === "request" ? onRequestReset : onConfirmReset}
                activeOpacity={0.8}
                disabled={
                  busy ||
                  (step === "request" ? !isRequestValid : !isConfirmValid)
                }
                style={[styles.buttonWrapper, { shadowColor: colors.buttonShadow }]}
              >
                <LinearGradient
                  colors={
                    (step === "request" ? isRequestValid : isConfirmValid) && !busy
                      ? [colors.buttonGradientStart, colors.buttonGradientEnd]
                      : ["#A0AEC0", "#B8C5D0"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>
                    {busy
                      ? "送信中..."
                      : step === "request"
                      ? "リセットコードを送信"
                      : "パスワードを変更"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {step === "confirm" && (
                <TouchableOpacity
                  onPress={() => setStep("request")}
                  style={styles.linkButton}
                >
                  <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                    コードが届かない場合はこちら
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerNav: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  mascotImage: {
    width: 100,
    height: 100,
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
  },
  speechBubbleText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
  },
  simpleHeader: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  simpleTitle: {
    fontSize: 24,
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
  hint: {
    fontSize: 12,
    marginLeft: 4,
    marginTop: 4,
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
});
