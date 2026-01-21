import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ExpoFileSystem from 'expo-file-system/legacy';
import {
  chatAboutEvent,
  startEventChat,
  voiceChat,
  chatWithVoiceResponse,
  ChatMessage,
} from '@/lib/openRouter';
import {
  updateEventClassification,
  createEventChangeLog,
  getUserId,
  EventClassificationParticipants,
  upsertEventChat,
  getEventChat,
  EventChatMessage,
} from '@/lib/api';

type Participants = 'solo' | 'small' | 'large';
type Format = 'online' | 'onsite';
type Relationship = 'family' | 'work' | 'friend' | 'stranger';
type InputMode = 'text' | 'voice';

/**
 * EventChatScreen - イベントについてAIとチャットする画面
 */
export default function EventChatScreen() {
  const params = useLocalSearchParams<{
    eventId: string;
    eventSummary: string;
    eventStart: string;
    eventEnd: string;
    stressScore: string;
    participants: string;
    relationships: string;
    format: string;
  }>();

  // 確認モード（true=確認画面、false=チャット画面）
  const [isConfirmMode, setIsConfirmMode] = useState(true);

  // 編集可能な値
  const [stressScore, setStressScore] = useState<number>(
    params.stressScore ? parseInt(params.stressScore) : 3
  );
  const [participants, setParticipants] = useState<Participants>(
    (params.participants as Participants) || 'solo'
  );
  const [format, setFormat] = useState<Format>(
    (params.format as Format) || 'onsite'
  );
  const [relationships, setRelationships] = useState<Relationship[]>(
    params.relationships ? params.relationships.split(',') as Relationship[] : []
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasSavedChat, setHasSavedChat] = useState(false);

  // 音声モード関連
  // Web プラットフォームでは音声機能が使えないため無効化
  const isVoiceSupported = Platform.OS !== 'web';
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // イベント情報（確認後の値を使用）
  const getEvent = useCallback(() => ({
    eventSummary: params.eventSummary || '',
    eventStart: params.eventStart || '',
    eventEnd: params.eventEnd || '',
    stressScore,
    participants,
    relationships: relationships.length > 0 ? relationships : undefined,
    format,
  }), [params, stressScore, participants, format, relationships]);

  // 過去か未来かを判定
  const isPast = useMemo(() => {
    const eventDate = new Date(params.eventStart || '');
    return eventDate < new Date();
  }, [params.eventStart]);

  // 過去なら「出来事」、未来なら「予定」
  const eventWord = isPast ? '出来事' : '予定';

  // イベントコンテキスト（音声チャット用）
  const getEventContext = useCallback(() => {
    const event = getEvent();
    return `【分析対象の${eventWord}】
タイトル: ${event.eventSummary}
日時: ${event.eventStart}
ストレススコア: ${event.stressScore || '未設定'}/5
参加者規模: ${event.participants === 'solo' ? '一人' : event.participants === 'small' ? '少人数' : '大人数'}
関係性: ${event.relationships?.join(', ') || '不明'}
形式: ${event.format === 'online' ? 'オンライン' : '対面'}`;
  }, [getEvent, eventWord]);

  // 確認してチャット開始
  const handleConfirm = useCallback(async () => {
    // 元の値を取得
    const originalStressScore = params.stressScore ? parseInt(params.stressScore) : null;
    const originalParticipants = (params.participants as Participants) || null;

    // スコアと人数と形式と関係性の変更をバックエンドに保存
    if (params.eventId) {
      try {
        // 変更があったかチェック
        const stressScoreChanged = originalStressScore !== stressScore;
        const participantsChanged = originalParticipants !== participants;
        const hasAnyChange = stressScoreChanged || participantsChanged;

        await updateEventClassification(params.eventId, {
          stressScore,
          participants,
          format,
          relationships: relationships.length > 0 ? relationships : null,
          isManuallyEdited: true,
        });

        // 変更があった場合はEventChangeLogを作成
        if (hasAnyChange) {
          const id = await getUserId();
          await createEventChangeLog({
            userId: id,
            eventId: params.eventId,
            timestamp: new Date().toISOString(),
            changedBy: 'user',
            oldStressScore: stressScoreChanged ? originalStressScore : null,
            newStressScore: stressScoreChanged ? stressScore : null,
            oldParticipants: participantsChanged ? (originalParticipants as EventClassificationParticipants) : null,
            newParticipants: participantsChanged ? (participants as EventClassificationParticipants) : null,
          });
          console.log('EventChangeLog saved successfully');
        }
      } catch (error) {
        console.error('Failed to save event classification or change log:', error);
        // 保存に失敗しても、チャットは続行
      }
    }

    setIsConfirmMode(false);
    const event = getEvent();
    const initialMessage = await startEventChat(event);
    setMessages([
      {
        role: 'assistant',
        content: initialMessage,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [getEvent, params.eventId, params.stressScore, params.participants, stressScore, participants, format, relationships]);

  // ユーザーID取得と既存チャット読み込み
  useEffect(() => {
    const loadUserAndChat = async () => {
      try {
        const id = await getUserId();
        setUserId(id);

        // 既存のチャット履歴を読み込む
        if (params.eventId) {
          const existingChat = await getEventChat(params.eventId);
          if (existingChat && existingChat.messages) {
            // JSONとして保存されている場合はパース
            const parsedMessages = typeof existingChat.messages === 'string'
              ? JSON.parse(existingChat.messages)
              : existingChat.messages;
            if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
              setMessages(parsedMessages);
              setHasSavedChat(true);
              setIsConfirmMode(false); // 既存のチャットがあれば確認画面をスキップ
            }
          }
        }
      } catch (error) {
        console.error('Load user/chat error:', error);
      }
    };
    loadUserAndChat();
  }, [params.eventId]);

  // チャットメッセージを保存（ユーザーが会話を始めたタイミングで）
  useEffect(() => {
    const saveChat = async () => {
      if (!params.eventId || !userId || messages.length === 0) return;

      // ユーザーのメッセージが含まれている場合のみ保存
      const hasUserMessage = messages.some(m => m.role === 'user');
      if (!hasUserMessage) return;

      try {
        const chatMessages: EventChatMessage[] = messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));
        await upsertEventChat(params.eventId, userId, chatMessages);
      } catch (error) {
        console.error('Save chat error:', error);
      }
    };

    // 初回読み込み時は保存しない（読み込んだメッセージを再保存しないため）
    if (hasSavedChat && messages.length > 0) {
      // 読み込み直後は保存をスキップ
      setHasSavedChat(false);
    } else if (messages.length > 0) {
      saveChat();
    }
  }, [messages, params.eventId, userId, hasSavedChat]);

  // オーディオの初期化
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } catch (error) {
        console.error('Audio setup error:', error);
      }
    };
    setupAudio();

    return () => {
      // クリーンアップ
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // 録音開始
  const startRecording = async () => {
    // Webプラットフォームでは録音機能は使えない
    if (!isVoiceSupported) {
      Alert.alert('エラー', '音声機能はiOS/Androidアプリでのみ利用可能です');
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('エラー', 'マイクへのアクセス許可が必要です');
        return;
      }

      // 他の音声を停止してから録音モードに設定
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // シミュレーターでも動作する録音設定
      const recordingOptions: Audio.RecordingOptions = {
        isMeteringEnabled: false,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.error('Start recording error:', error);
      Alert.alert('エラー', '録音を開始できませんでした');
    }
  };

  // 録音停止して送信
  const stopRecordingAndSend = async () => {
    // Webプラットフォームでは録音機能は使えない
    if (!isVoiceSupported) return;

    // 録音中でなければ何もしない
    if (!isRecording || !recordingRef.current) return;

    const recording = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    setIsLoading(true);

    try {
      // 録音のステータスを確認
      const status = await recording.getStatusAsync();

      // まだ録音中なら停止
      if (status.isRecording) {
        await recording.stopAndUnloadAsync();
      }

      const uri = recording.getURI();

      if (!uri) {
        throw new Error('Recording URI is null');
      }

      // 音声ファイルをBase64に変換
      const base64Audio = await ExpoFileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // ユーザーメッセージを追加（音声であることを示す）
      const userMessage: ChatMessage = {
        role: 'user',
        content: '🎤 (音声メッセージ)',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);

      // 音声チャットAPIを呼び出し
      const response = await voiceChat(base64Audio, getEventContext(), messages);

      // アシスタントメッセージを追加
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // 音声を再生
      if (response.audioBase64) {
        await playAudio(response.audioBase64);
      }
    } catch (error) {
      console.error('Voice chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'すみません、音声の処理中にエラーが発生しました。もう一度お試しください。',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 音声を再生
  const playAudio = async (base64Audio: string) => {
    // Webプラットフォームでは音声再生機能は使えない
    if (!isVoiceSupported) {
      console.log('Audio playback is not supported on web platform');
      return;
    }

    try {
      // 既存の音声を停止
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Base64をファイルに保存
      const fileUri = ExpoFileSystem.cacheDirectory + 'response.mp3';
      await ExpoFileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: 'base64',
      });

      // 音声を再生
      const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
      soundRef.current = sound;
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });

      await sound.playAsync();
    } catch (error) {
      console.error('Play audio error:', error);
      setIsPlaying(false);
    }
  };

  // テキストメッセージを送信（音声モードの場合は音声レスポンス）
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      if (inputMode === 'voice' && isVoiceSupported) {
        // 音声モード：テキスト入力 → 音声レスポンス（ネイティブのみ）
        const response = await chatWithVoiceResponse(
          userMessage.content,
          getEventContext(),
          messages
        );

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.text,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);

        if (response.audioBase64) {
          await playAudio(response.audioBase64);
        }
      } else {
        // テキストモード：通常のテキストチャット
        const event = getEvent();
        const response = await chatAboutEvent(event, messages, userMessage.content);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'すみません、エラーが発生しました。もう一度お試しください。',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages, getEvent, inputMode, getEventContext]);

  // スクロールを最下部に
  useEffect(() => {
    if (!isConfirmMode) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isConfirmMode]);

  // ストレススコアの色を取得
  const getStressColor = (score: number) => {
    switch (score) {
      case 1: return '#4CAF50';
      case 2: return '#8BC34A';
      case 3: return '#FFC107';
      case 4: return '#FF9800';
      case 5: return '#F44336';
      default: return '#9E9E9E';
    }
  };

  // ストレススコアのラベル
  const getStressLabel = (score: number) => {
    switch (score) {
      case 1: return 'リラックス';
      case 2: return '低ストレス';
      case 3: return '中程度';
      case 4: return 'やや高い';
      case 5: return '高ストレス';
      default: return '';
    }
  };

  // 人数のラベル
  const getParticipantsLabel = (p: Participants) => {
    switch (p) {
      case 'solo': return '一人';
      case 'small': return '少人数 (2-4人)';
      case 'large': return '大人数 (5人以上)';
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)/analysis');
    }
  };

  // 確認画面
  if (isConfirmMode) {
    return (
      <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* ヘッダー */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#4A5568" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {params.eventSummary}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Image
                source={require('@/assets/images/rinawan_tilting_head.gif')}
                style={styles.headerIcon}
              />
            </View>
          </View>

          {/* 確認コンテンツ */}
          <ScrollView style={styles.confirmContainer} contentContainerStyle={styles.confirmContent}>
            <View style={styles.confirmCard}>
              <View style={styles.rinawanContainer}>
                <Image
                  source={require('@/assets/images/rinawan_tilting_head.gif')}
                  style={styles.confirmRinawan}
                />
              </View>
              <Text style={styles.confirmMessage}>
                やっほー、りなわんだよ。{'\n'}
                チャットを始める前に、この{eventWord}の情報を確認させてね。
              </Text>

              {/* ストレススコア選択 */}
              <View style={styles.confirmSection}>
                <Text style={styles.confirmLabel}>ストレス度</Text>
                <View style={styles.stressSelector}>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <TouchableOpacity
                      key={score}
                      style={[
                        styles.stressOption,
                        stressScore === score && styles.stressOptionSelected,
                        { borderColor: getStressColor(score) },
                        stressScore === score && { backgroundColor: getStressColor(score) },
                      ]}
                      onPress={() => setStressScore(score)}
                    >
                      <Text
                        style={[
                          styles.stressOptionText,
                          stressScore === score && styles.stressOptionTextSelected,
                        ]}
                      >
                        {score}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.stressLabelText}>
                  {getStressLabel(stressScore)}
                </Text>
              </View>

              {/* 人数選択 */}
              <View style={styles.confirmSection}>
                <Text style={styles.confirmLabel}>参加人数</Text>
                <View style={styles.participantsSelector}>
                  {(['solo', 'small', 'large'] as Participants[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.participantOption,
                        participants === p && styles.participantOptionSelected,
                      ]}
                      onPress={() => setParticipants(p)}
                    >
                      <Text
                        style={[
                          styles.participantOptionText,
                          participants === p && styles.participantOptionTextSelected,
                        ]}
                      >
                        {getParticipantsLabel(p)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 関係性選択（一人以外の場合のみ） */}
              {participants !== 'solo' && (
                <View style={styles.confirmSection}>
                  <Text style={styles.confirmLabel}>誰と？（複数選択可）</Text>
                  <View style={styles.relationshipSelector}>
                    {(['work', 'family', 'friend', 'stranger'] as Relationship[]).map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.relationshipOption,
                          relationships.includes(r) && styles.relationshipOptionSelected,
                        ]}
                        onPress={() => {
                          if (relationships.includes(r)) {
                            setRelationships(relationships.filter(rel => rel !== r));
                          } else {
                            setRelationships([...relationships, r]);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.relationshipOptionText,
                            relationships.includes(r) && styles.relationshipOptionTextSelected,
                          ]}
                        >
                          {r === 'work' ? '仕事' : r === 'family' ? '家族' : r === 'friend' ? '友人' : '初対面'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* 形式選択 */}
              <View style={styles.confirmSection}>
                <Text style={styles.confirmLabel}>形式</Text>
                <View style={styles.formatSelector}>
                  {(['online', 'onsite'] as Format[]).map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[
                        styles.formatOption,
                        format === f && styles.formatOptionSelected,
                      ]}
                      onPress={() => setFormat(f)}
                    >
                      <Text
                        style={[
                          styles.formatOptionText,
                          format === f && styles.formatOptionTextSelected,
                        ]}
                      >
                        {f === 'online' ? 'オンライン' : '対面'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 確認ボタン */}
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>これでOK！チャットを始める</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // チャット画面
  return (
    <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#4A5568" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {params.eventSummary}
            </Text>
            <View style={styles.headerMeta}>
              <View
                style={[
                  styles.stressBadge,
                  { backgroundColor: getStressColor(stressScore) },
                ]}
              >
                <Text style={styles.stressBadgeText}>
                  {stressScore}/5
                </Text>
              </View>
              <Text style={styles.participantsBadge}>
                {getParticipantsLabel(participants)}
              </Text>
            </View>
          </View>
          {/* モード切替ボタン（ネイティブのみ） */}
          {isVoiceSupported && (
            <TouchableOpacity
              style={[
                styles.modeToggle,
                inputMode === 'voice' && styles.modeToggleActive,
              ]}
              onPress={() => setInputMode(inputMode === 'text' ? 'voice' : 'text')}
            >
              <Ionicons
                name={inputMode === 'voice' ? 'mic' : 'mic-outline'}
                size={20}
                color={inputMode === 'voice' ? '#FFF' : '#805AD5'}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* チャットエリア */}
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message, index) => (
              <View
                key={index}
                style={[
                  styles.messageBubble,
                  message.role === 'user'
                    ? styles.userBubble
                    : styles.assistantBubble,
                ]}
              >
                {message.role === 'assistant' && (
                  <Image
                    source={require('@/assets/images/rinawan_tilting_head.gif')}
                    style={styles.avatarIcon}
                  />
                )}
                <View
                  style={[
                    styles.messageContent,
                    message.role === 'user'
                      ? styles.userContent
                      : styles.assistantContent,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.role === 'user'
                        ? styles.userText
                        : styles.assistantText,
                    ]}
                  >
                    {message.content}
                  </Text>
                </View>
              </View>
            ))}
            {isLoading && (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <Image
                  source={require('@/assets/images/rinawan_tilting_head.gif')}
                  style={styles.avatarIcon}
                />
                <View style={[styles.messageContent, styles.assistantContent]}>
                  <ActivityIndicator size="small" color="#805AD5" />
                </View>
              </View>
            )}
          </ScrollView>

          {/* 入力エリア */}
          <View style={styles.inputContainer}>
            {inputMode === 'voice' ? (
              // 音声入力モード
              <View style={styles.voiceInputContainer}>
                <TouchableOpacity
                  style={[
                    styles.recordButton,
                    isRecording && styles.recordButtonActive,
                  ]}
                  onPressIn={startRecording}
                  onPressOut={stopRecordingAndSend}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={isRecording ? 'radio-button-on' : 'mic'}
                    size={32}
                    color="#FFF"
                  />
                </TouchableOpacity>
                <Text style={styles.voiceHint}>
                  {isRecording ? '話しています...' : isLoading ? '処理中...' : '長押しで話す'}
                </Text>
              </View>
            ) : (
              // テキスト入力モード
              <>
                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="メッセージを入力..."
                  placeholderTextColor="#A0AEC0"
                  multiline
                  maxLength={500}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isLoading}
                >
                  <Ionicons
                    name="send"
                    size={20}
                    color={!inputText.trim() || isLoading ? '#A0AEC0' : '#FFF'}
                  />
                </TouchableOpacity>
              </>
            )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  stressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  stressBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  participantsBadge: {
    fontSize: 12,
    color: '#718096',
  },
  headerRight: {
    marginLeft: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
  },
  modeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#805AD5',
  },
  modeToggleActive: {
    backgroundColor: '#805AD5',
  },
  // 確認画面のスタイル
  confirmContainer: {
    flex: 1,
  },
  confirmContent: {
    padding: 20,
  },
  confirmCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
  },
  rinawanContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmRinawan: {
    width: 80,
    height: 80,
  },
  confirmMessage: {
    fontSize: 15,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  confirmSection: {
    marginBottom: 24,
  },
  confirmLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 12,
  },
  stressSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stressOption: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  stressOptionSelected: {
    borderWidth: 2,
  },
  stressOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
  },
  stressOptionTextSelected: {
    color: '#FFF',
  },
  stressLabelText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#718096',
  },
  participantsSelector: {
    gap: 8,
  },
  participantOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  participantOptionSelected: {
    borderColor: '#805AD5',
    backgroundColor: '#FAF5FF',
  },
  participantOptionText: {
    fontSize: 15,
    color: '#4A5568',
    textAlign: 'center',
  },
  participantOptionTextSelected: {
    color: '#805AD5',
    fontWeight: '600',
  },
  relationshipSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationshipOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  relationshipOptionSelected: {
    borderColor: '#805AD5',
    backgroundColor: '#FAF5FF',
  },
  relationshipOptionText: {
    fontSize: 14,
    color: '#4A5568',
  },
  relationshipOptionTextSelected: {
    color: '#805AD5',
    fontWeight: '600',
  },
  formatSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  formatOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  formatOptionSelected: {
    borderColor: '#805AD5',
    backgroundColor: '#FAF5FF',
  },
  formatOptionText: {
    fontSize: 15,
    color: '#4A5568',
  },
  formatOptionTextSelected: {
    color: '#805AD5',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#805AD5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // チャット画面のスタイル
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  assistantBubble: {
    justifyContent: 'flex-start',
  },
  avatarIcon: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  messageContent: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  userContent: {
    backgroundColor: '#805AD5',
    borderBottomRightRadius: 4,
    marginLeft: 'auto',
  },
  assistantContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFF',
  },
  assistantText: {
    color: '#2D3748',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#F7FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#2D3748',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#805AD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  // 音声入力のスタイル
  voiceInputContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#805AD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: {
    backgroundColor: '#E53E3E',
  },
  voiceHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#718096',
  },
});
