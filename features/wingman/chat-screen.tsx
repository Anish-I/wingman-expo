import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn, FadeInUp } from 'react-native-reanimated';

import {
  detectReaction,
  quickReplies,
} from '@/features/wingman/data';
import {
  PipCompanion,
  type PipAnchorRect,
} from '@/features/wingman/pip-companion';
import { useWingman } from '@/features/wingman/provider';
import {
  Chip,
  IconGlyph,
  StateNotice,
  StickerCard,
  TypingDots,
} from '@/features/wingman/primitives';
import { wingmanFonts, wingmanLayout } from '@/features/wingman/theme';
import { useVoiceDictation } from '@/features/wingman/voice-input';

const showFloatingPipAnimation = false;

function MessageBubble({
  from,
  text,
  status,
  streaming,
  toolHints,
  oauthCta,
  startsGroup,
}: {
  from: 'pip' | 'user';
  text: string;
  status?: string;
  streaming?: boolean;
  toolHints?: string[];
  oauthCta?: { app: string; url: string };
  startsGroup: boolean;
}) {
  const { colors } = useWingman();
  const isUser = from === 'user';
  const hasText = text.trim().length > 0;
  const hasToolHints = Boolean(toolHints?.length);

  if (!hasText && streaming && !hasToolHints && !oauthCta && !status) {
    return null;
  }

  return (
    <Animated.View
      entering={(isUser ? FadeInUp : FadeInDown).springify().damping(16)}
      style={{
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 5,
      }}>
      {startsGroup && !isUser ? (
        <Text
          style={{
            color: colors.fgMuted,
            fontFamily: wingmanFonts.text,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.6,
            paddingLeft: 2,
            textTransform: 'uppercase',
          }}>
          Pip
        </Text>
      ) : null}
      <View style={{ maxWidth: '86%', gap: 4, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {hasText ? (
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderRadius: 20,
              borderBottomRightRadius: isUser ? 6 : 20,
              borderBottomLeftRadius: isUser ? 20 : 6,
              borderWidth: 1.5,
              borderColor: isUser ? colors.sky700 : colors.border,
              backgroundColor: isUser ? colors.sky500 : colors.card,
              boxShadow: isUser
                ? '0 4px 0 rgba(29, 78, 216, 0.20), 0 10px 24px rgba(59, 130, 246, 0.34)'
                : '0 3px 0 rgba(27, 34, 64, 0.10)',
            }}>
            <Text
              style={{
                color: isUser ? '#FFFFFF' : colors.ink,
                fontFamily: wingmanFonts.text,
                fontSize: 15,
                fontWeight: '500',
                lineHeight: 21,
              }}>
              {text}{streaming ? '▍' : ''}
            </Text>
          </View>
        ) : null}
        {hasToolHints ? (
          <Text
            style={{
              color: colors.fgMuted,
              fontFamily: wingmanFonts.text,
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 0.3,
            }}>
            Used {toolHints?.join(' → ')}
          </Text>
        ) : null}
        {oauthCta ? (
          <Pressable
            onPress={() => {
              WebBrowser.openBrowserAsync(oauthCta.url).catch(() => Linking.openURL(oauthCta.url));
            }}
            style={{
              marginTop: 4,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: colors.sky700,
              backgroundColor: colors.sky500,
            }}>
            <Text style={{ color: '#FFFFFF', fontFamily: wingmanFonts.text, fontSize: 13, fontWeight: '700' }}>
              Connect {oauthCta.app}
            </Text>
          </Pressable>
        ) : null}
        {status ? (
          <Text
            style={{
              color: colors.fgMuted,
              fontFamily: wingmanFonts.text,
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 0.3,
            }}>
            {status}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const router = useRouter();
  const {
    chatMessages,
    colors,
    streamChatMessage,
    clearChatThread,
    setChatMessages,
  } = useWingman();
  const [draft, setDraft] = React.useState('');
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  const voice = useVoiceDictation(() => draftRef.current, setDraft);
  const [isTyping, setIsTyping] = React.useState(false);
  const [isComposerFocused, setIsComposerFocused] = React.useState(false);
  const [sendTick, setSendTick] = React.useState(0);
  const [floorRect, setFloorRect] = React.useState<PipAnchorRect | null>(null);
  const [nestRect, setNestRect] = React.useState<PipAnchorRect | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const handledPromptRef = React.useRef<string | null>(null);
  const rootRef = React.useRef<View>(null);
  const composerAnchorRef = React.useRef<View>(null);
  const nestAnchorRef = React.useRef<View>(null);

  const remeasureAnchors = React.useCallback(() => {
    const root = rootRef.current;
    const composer = composerAnchorRef.current;
    const nestAnchor = nestAnchorRef.current;
    if (!root || !composer || !nestAnchor) return;
    root.measureInWindow((rx, ry) => {
      composer.measureInWindow((cx, cy, cw, ch) => {
        setFloorRect({ x: cx - rx, y: cy - ry, width: cw, height: ch });
      });
      nestAnchor.measureInWindow((nx, ny, nw, nh) => {
        setNestRect({ x: nx - rx, y: ny - ry, width: nw, height: nh });
      });
    });
  }, []);

  React.useEffect(() => {
    if (!prompt || handledPromptRef.current === prompt) {
      return;
    }

    handledPromptRef.current = prompt;
    setDraft(prompt);
  }, [prompt]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timeout);
  }, [chatMessages, isTyping]);

  React.useEffect(() => {
    const id = requestAnimationFrame(remeasureAnchors);
    return () => cancelAnimationFrame(id);
  }, [remeasureAnchors, chatMessages.length, isTyping, draft]);

  const reaction = detectReaction(draft);

  const sendMessage = async (overrideText?: string) => {
    const nextMessage = (overrideText ?? draft).trim();

    if (!nextMessage) {
      return;
    }

    voice.stop();
    await Haptics.selectionAsync();

    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `message-${Date.now()}`,
        from: 'user',
        text: nextMessage,
        status: 'Sent',
      },
    ]);
    setDraft('');
    setIsTyping(true);
    setSendTick((tick) => tick + 1);

    const response = await streamChatMessage(nextMessage);
    setIsTyping(false);
    if (!response.ok && response.error) {
      // Streamed errors are already inlined into the pip bubble; nothing extra to do.
    }
  };

  const copyTranscript = React.useCallback(async () => {
    const text = chatMessages
      .map((m) => `${m.from === 'user' ? 'You' : 'Pip'}: ${m.text}`)
      .join('\n');
    try {
      await Share.share({ message: text || 'Empty thread.' });
    } catch {
      Alert.alert('Could not share transcript.');
    }
    setMenuOpen(false);
  }, [chatMessages]);

  const onClearThread = React.useCallback(() => {
    Alert.alert('Clear thread?', "Pip won't remember this conversation.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearChatThread();
          setMenuOpen(false);
        },
      },
    ]);
  }, [clearChatThread]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgAlt }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <View
        ref={rootRef}
        onLayout={remeasureAnchors}
        style={{ flex: 1 }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: wingmanLayout.screenPadding,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View
          ref={nestAnchorRef}
          onLayout={remeasureAnchors}
          style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.ink,
              fontFamily: wingmanFonts.display,
              fontSize: 18,
              fontWeight: '700',
            }}>
            Pip
          </Text>
          <Text
            style={{
              color: colors.mint500,
              fontFamily: wingmanFonts.text,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 0.3,
            }}>
            Online · ready to wing it
          </Text>
        </View>
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Chat options"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.cardAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <IconGlyph name="ellipsis" color={colors.fgMuted} size={20} />
        </Pressable>
      </View>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          onPress={() => setMenuOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(27, 34, 64, 0.45)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 32,
              borderTopWidth: 1.5,
              borderColor: colors.ink,
              gap: 8,
            }}>
            <View
              style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 8 }}
            />
            <Pressable
              onPress={onClearThread}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: pressed ? colors.cardAlt : 'transparent',
              })}>
              <Text style={{ color: colors.ink, fontFamily: wingmanFonts.text, fontSize: 15, fontWeight: '600' }}>
                Clear thread
              </Text>
              <Text style={{ color: colors.fgMuted, fontFamily: wingmanFonts.text, fontSize: 12, marginTop: 2 }}>
                Pip forgets this conversation
              </Text>
            </Pressable>
            <Pressable
              onPress={copyTranscript}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: pressed ? colors.cardAlt : 'transparent',
              })}>
              <Text style={{ color: colors.ink, fontFamily: wingmanFonts.text, fontSize: 15, fontWeight: '600' }}>
                Share transcript
              </Text>
              <Text style={{ color: colors.fgMuted, fontFamily: wingmanFonts.text, fontSize: 12, marginTop: 2 }}>
                Open the iOS share sheet
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setMenuOpen(false); router.push('/apps'); }}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: pressed ? colors.cardAlt : 'transparent',
              })}>
              <Text style={{ color: colors.ink, fontFamily: wingmanFonts.text, fontSize: 15, fontWeight: '600' }}>
                Manage apps
              </Text>
              <Text style={{ color: colors.fgMuted, fontFamily: wingmanFonts.text, fontSize: 12, marginTop: 2 }}>
                Connect what Pip can act on
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="never"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: wingmanLayout.screenPadding,
          paddingVertical: 14,
          gap: 10,
          paddingBottom: 22,
        }}>
        {chatMessages.length === 0 && !isTyping ? (
          <StateNotice
            pip="wave"
            title="Say hi to Pip"
            body="Ask Pip to draft an email, check your calendar, set a reminder, or run one of your flows."
          />
        ) : null}

        {chatMessages.map((message, index) => {
          const previousMessage = chatMessages[index - 1];

          return (
            <MessageBubble
              key={message.id}
              from={message.from}
              text={message.text}
              status={message.status}
              streaming={message.streaming}
              toolHints={message.toolHints}
              oauthCta={message.oauthCta}
              startsGroup={!previousMessage || previousMessage.from !== message.from}
            />
          );
        })}

        {isTyping ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            style={{ alignItems: 'flex-start', gap: 5 }}>
            <Text
              style={{
                color: colors.fgMuted,
                fontFamily: wingmanFonts.text,
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 0.6,
                paddingLeft: 2,
                textTransform: 'uppercase',
              }}>
              Pip
            </Text>
            <StickerCard
              style={{
                borderColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomLeftRadius: 6,
                alignSelf: 'flex-start',
              }}>
              <TypingDots color={colors.sky500} />
            </StickerCard>
          </Animated.View>
        ) : null}

        {draft && reaction.hint ? (
          <StickerCard
            borderColor={reaction.color}
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 14,
            }}>
            <Text
              style={{
                color: reaction.color,
                fontFamily: wingmanFonts.text,
                fontSize: 12,
                fontWeight: '800',
              }}>
              {reaction.hint}
            </Text>
          </StickerCard>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 8,
            gap: 8,
          }}>
          {quickReplies.map((reply) => (
            <Chip
              key={reply.id}
              label={reply.label}
              icon={reply.icon as 'time'}
              tint={reply.color}
              onPress={() => {
                void Haptics.selectionAsync();
                setDraft(reply.prompt);
              }}
            />
          ))}
        </ScrollView>
      </View>


      <View
        ref={composerAnchorRef}
        onLayout={remeasureAnchors}
        style={{ paddingHorizontal: 14, paddingBottom: 18 }}>
        {voice.error ? (
          <Text
            style={{
              color: colors.error,
              fontFamily: wingmanFonts.text,
              fontSize: 12,
              fontWeight: '500',
              paddingHorizontal: 10,
              paddingBottom: 6,
            }}>
            {voice.error}
          </Text>
        ) : voice.listening ? (
          <Text
            style={{
              color: colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 12,
              fontWeight: '500',
              paddingHorizontal: 10,
              paddingBottom: 6,
            }}>
            Listening… speak now, tap ■ to stop.
          </Text>
        ) : null}
        <StickerCard
          borderColor={draft ? reaction.color : colors.border}
          style={{
            borderRadius: 28,
            paddingLeft: 6,
            paddingRight: 6,
            paddingVertical: 5,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
          <Pressable
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <IconGlyph name="sparkles" color={colors.sky500} size={18} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Text Pip..."
            placeholderTextColor={colors.fgMuted}
            onFocus={() => setIsComposerFocused(true)}
            onBlur={() => setIsComposerFocused(false)}
            onSubmitEditing={() => {
              void sendMessage();
            }}
            style={{
              flex: 1,
              minHeight: 44,
              color: colors.ink,
              fontFamily: wingmanFonts.text,
              fontSize: 15,
              fontWeight: '500',
              paddingHorizontal: 4,
            }}
          />
          <Pressable
            onPress={() => {
              if (draft) {
                void sendMessage();
                return;
              }
              if (voice.supported) {
                voice.toggle();
                return;
              }
              Alert.alert(
                'Voice input',
                "Speech recognition isn't available on this device. Make sure the system speech/voice service is enabled, or type your message instead.",
              );
            }}
            accessibilityLabel={
              draft ? 'Send message' : voice.listening ? 'Stop dictation' : 'Dictate message'
            }
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: draft
                ? reaction.color
                : voice.listening
                ? colors.error
                : colors.section,
            }}>
            <IconGlyph
              name={draft ? 'arrow-up' : voice.listening ? 'stop' : 'mic'}
              color={draft || voice.listening ? '#FFFFFF' : colors.fgSecondary}
              size={18}
            />
          </Pressable>
        </StickerCard>
      </View>

      {showFloatingPipAnimation ? (
        <PipCompanion
          floor={floorRect}
          nest={nestRect}
          focused={isComposerFocused}
          sendTick={sendTick}
        />
      ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
