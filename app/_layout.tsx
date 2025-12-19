import "react-native-get-random-values";
import "text-encoding-polyfill";
import "react-native-url-polyfill/auto";
import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import AsyncStorage from "@react-native-async-storage/async-storage";
import outputs from "../amplify_outputs.json";

import { useEffect, useState, useCallback } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

// React Native用: AsyncStorageをKeyValueStorageとして使用
const asyncStorageAdapter = {
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  getItem: (key: string) => AsyncStorage.getItem(key),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
  clear: () => AsyncStorage.clear(),
};

// Amplify設定
Amplify.configure(outputs);

// React Native用: トークンストレージを設定
cognitoUserPoolsTokenProvider.setKeyValueStorage(asyncStorageAdapter);

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // 認証状態をチェック
  const checkAuthState = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      setSignedIn(!!session.tokens?.idToken);
    } catch {
      setSignedIn(false);
    } finally {
      setReady(true);
    }
  }, []);

  // 初回チェック
  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  // 認証イベントをリッスン
  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      console.log("Auth event:", payload.event);
      switch (payload.event) {
        case "signedIn":
          setSignedIn(true);
          break;
        case "signedOut":
          setSignedIn(false);
          break;
        case "tokenRefresh":
          checkAuthState();
          break;
      }
    });

    return () => unsubscribe();
  }, [checkAuthState]);

  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!signedIn && !inAuthGroup) {
      router.replace("/(auth)/signin" as const);
    }
    if (signedIn && inAuthGroup) {
      router.replace("/(app)/(tabs)" as const);
    }
  }, [ready, signedIn, segments]);

  if (!ready) return null;

  return <Slot />;
}
