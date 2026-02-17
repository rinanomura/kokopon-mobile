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

type Step = "request" | "confirm";

export default function ResetPasswordScreen() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <LinearGradient colors={["#7AD7F0", "#CDECF6"]} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          {/* 戻るボタン */}
          <View style={styles.headerNav}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color="#4A5568" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ヘッダー部分 */}
            <View style={styles.header}>
              <Image
                source={require("@/assets/images/rinawan_tilting_head.gif")}
                style={styles.mascotImage}
                resizeMode="contain"
              />
              <View style={styles.speechBubbleContainer}>
                <View style={styles.speechBubbleTail} />
                <LinearGradient
                  colors={["#FFF5F7", "#FFFFFF", "#FFF0F5"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.speechBubble}
                >
                  <Text style={styles.speechBubbleText}>
                    {step === "request"
                      ? "メールアドレスを\n入力してね"
                      : "届いたコードを\n入力してね"}
                  </Text>
                </LinearGradient>
              </View>
            </View>

            {/* フォーム部分 */}
            <View style={styles.formContainer}>
              {step === "request" ? (
                // ステップ1: メールアドレス入力
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>メールアドレス</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="example@email.com"
                    placeholderTextColor="#A0AEC0"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                  />
                  <Text style={styles.hint}>
                    登録済みのメールアドレスにリセットコードを送信します
                  </Text>
                </View>
              ) : (
                // ステップ2: コードと新しいパスワード入力
                <>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>確認コード</Text>
                    <TextInput
                      keyboardType="number-pad"
                      placeholder="6桁のコードを入力"
                      placeholderTextColor="#A0AEC0"
                      value={code}
                      onChangeText={setCode}
                      style={styles.input}
                      maxLength={6}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>新しいパスワード</Text>
                    <TextInput
                      secureTextEntry
                      placeholder="8文字以上"
                      placeholderTextColor="#A0AEC0"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>パスワード（確認）</Text>
                    <TextInput
                      secureTextEntry
                      placeholder="もう一度入力"
                      placeholderTextColor="#A0AEC0"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      style={styles.input}
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
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={
                    (step === "request" ? isRequestValid : isConfirmValid) && !busy
                      ? ["#FF85A2", "#FFB6C1"]
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
                  <Text style={styles.linkText}>
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
    backgroundColor: "rgba(255, 255, 255, 0.5)",
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
    borderRightColor: "#FFF5F7",
    marginRight: -1,
  },
  speechBubble: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: "rgba(255, 182, 193, 0.5)",
    shadowColor: "#FFB6C1",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  speechBubbleText: {
    fontSize: 14,
    color: "#5A6B7C",
    fontWeight: "600",
    lineHeight: 21,
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
    color: "#5A6B7C",
    marginLeft: 4,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#11181C",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  hint: {
    fontSize: 12,
    color: "#718096",
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
    shadowColor: "#FF85A2",
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
    color: "#5A6B7C",
    textDecorationLine: "underline",
  },
});
