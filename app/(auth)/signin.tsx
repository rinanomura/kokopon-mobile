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

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <LinearGradient colors={["#7AD7F0", "#CDECF6"]} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
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
                  おかえりなさい！{"\n"}ログインしてね
                </Text>
              </LinearGradient>
            </View>
          </View>

          {/* フォーム部分 */}
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
              <Text style={styles.inputLabel}>パスワード</Text>
              <TextInput
                secureTextEntry
                placeholder="パスワードを入力"
                placeholderTextColor="#A0AEC0"
                value={password}
                onChangeText={setPassword}
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => router.push("/(auth)/reset-password")}
                style={styles.forgotPasswordLink}
              >
                <Text style={styles.forgotPasswordText}>
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
                  {busy ? "ログイン中..." : "ログイン"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* 新規登録リンク */}
            <TouchableOpacity
              onPress={() => router.push("/(auth)/signup")}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>
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
  forgotPasswordLink: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: "#718096",
  },
});
