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
import { signUp, confirmSignUp, autoSignIn } from "aws-amplify/auth";
import { router } from "expo-router";

type Step = "form" | "confirm";

export default function SignUpScreen() {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // サインアップ処理
  async function onSignUp() {
    setErr(null);

    if (password !== confirmPassword) {
      setErr("パスワードが一致しません");
      return;
    }

    if (password.length < 8) {
      setErr("パスワードは8文字以上で入力してください");
      return;
    }

    setBusy(true);
    try {
      await signUp({
        username: email.trim(),
        password,
        options: {
          userAttributes: {
            email: email.trim(),
          },
        },
      });
      setStep("confirm");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  // 確認コード検証処理
  async function onConfirm() {
    setErr(null);
    setBusy(true);
    try {
      await confirmSignUp({
        username: email.trim(),
        confirmationCode: code,
      });
      // 自動サインイン
      await autoSignIn();
      // RootLayout が signedIn 判定して /(app) に遷移させます
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const isFormValid =
    email.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length > 0;

  const isCodeValid = code.length === 6;

  return (
    <LinearGradient colors={["#7AD7F0", "#CDECF6"]} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
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
                  <View style={styles.sparkleTopRight}>
                    <Text style={styles.sparkleText}>✧</Text>
                  </View>
                  <Text style={styles.speechBubbleText}>
                    {step === "form"
                      ? "はじめまして！\nアカウントを作ろう"
                      : "メールを確認してね！\n確認コードを入力してね"}
                  </Text>
                </LinearGradient>
              </View>
            </View>

            {step === "form" ? (
              /* 登録フォーム */
              <View style={styles.formContainer}>
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
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>パスワード（8文字以上）</Text>
                  <TextInput
                    secureTextEntry
                    placeholder="パスワードを入力"
                    placeholderTextColor="#A0AEC0"
                    value={password}
                    onChangeText={setPassword}
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

                {!!err && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{err}</Text>
                  </View>
                )}

                {/* 登録ボタン */}
                <View style={styles.buttonArea}>
                  <TouchableOpacity
                    onPress={onSignUp}
                    activeOpacity={0.8}
                    disabled={busy || !isFormValid}
                    style={styles.buttonWrapper}
                  >
                    <LinearGradient
                      colors={
                        isFormValid && !busy
                          ? ["#FF85A2", "#FFB6C1"]
                          : ["#A0AEC0", "#B8C5D0"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.button}
                    >
                      <Text style={styles.buttonText}>
                        {busy ? "登録中..." : "アカウントを作成"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* ログインへ戻る */}
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>
                    すでにアカウントをお持ちの方はこちら
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* 確認コード入力 */
              <View style={styles.formContainer}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>確認コード（6桁）</Text>
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="123456"
                    placeholderTextColor="#A0AEC0"
                    value={code}
                    onChangeText={setCode}
                    maxLength={6}
                    style={[styles.input, styles.codeInput]}
                  />
                </View>

                {!!err && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{err}</Text>
                  </View>
                )}

                {/* 確認ボタン */}
                <View style={styles.buttonArea}>
                  <TouchableOpacity
                    onPress={onConfirm}
                    activeOpacity={0.8}
                    disabled={busy || !isCodeValid}
                    style={styles.buttonWrapper}
                  >
                    <LinearGradient
                      colors={
                        isCodeValid && !busy
                          ? ["#FF85A2", "#FFB6C1"]
                          : ["#A0AEC0", "#B8C5D0"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.button}
                    >
                      <Text style={styles.buttonText}>
                        {busy ? "確認中..." : "確認する"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* 戻るリンク */}
                <TouchableOpacity
                  onPress={() => setStep("form")}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>入力画面に戻る</Text>
                </TouchableOpacity>
              </View>
            )}
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
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
    position: "relative",
  },
  sparkleTopRight: {
    position: "absolute",
    top: -6,
    right: -4,
  },
  sparkleText: {
    fontSize: 14,
    color: "#FFB6C1",
  },
  speechBubbleText: {
    fontSize: 14,
    color: "#5A6B7C",
    fontWeight: "600",
    lineHeight: 21,
    letterSpacing: 0.2,
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
  codeInput: {
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: "600",
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
  buttonArea: {
    paddingTop: 16,
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
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    color: "#5A6B7C",
    textDecorationLine: "underline",
  },
});
