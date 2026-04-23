import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  detectReaction,
  quickReplies,
  replyPool,
} from '@/features/wingman/data';
import {
  PipCompanion,
  type PipAnchorRect,
} from '@/features/wingman/pip-companion';
import { useWingman } from '@/features/wingman/provider';
import {
  Chip,
  IconGlyph,
  PipCircle,
  StickerCard,
  TypingDots,
} from '@/features/wingman/primitives';
import { wingmanFonts, wingmanLayout } from '@/features/wingman/theme';

function MessageBubble({
  from,
  text,
  status,
}: {
  from: 'pip' | 'user';
  text: string;
  status?: string;
}) {
  const { colors } = useWingman();
  const isUser = from === 'user';

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        gap: 8,
      }}>
      {!isUser ? <PipCircle variant="happy" size={28} ring={false} /> : null}
      <View style={{ maxWidth: '78%', gap: 4, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderRadius: 20,
            borderBottomRightRadius: isUser ? 6 : 20,
            borderBottomLeftRadius: isUser ? 20 : 6,
            borderWidth: 1.5,
            borderColor: isUser ? colors.sky700 : colors.ink,
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
            {text}
          </Text>
        </View>
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
    </View>
  );
}

export function ChatScreen() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const {
    chatMessages,
    colors,
    sendChatMessage,
    setChatMessages,
  } = useWingman();
  const [draft, setDraft] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const [isComposerFocused, setIsComposerFocused] = React.useState(false);
  const [sendTick, setSendTick] = React.useState(0);
  const [floorRect, setFloorRect] = React.useState<PipAnchorRect | null>(null);
  const [nestRect, setNestRect] = React.useState<PipAnchorRect | null>(null);
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

    setTimeout(async () => {
      const response = await sendChatMessage(nextMessage);
      setIsTyping(false);
      setChatMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `message-${Date.now() + 1}`,
          from: 'pip',
          text: response.ok ? (response.assistantMessage ?? replyPool[Math.floor(Math.random() * replyPool.length)]) : (response.error ?? 'I hit a snag. Try again.'),
        },
      ]);
    }, 650 + Math.floor(Math.random() * 250));
  };

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
          paddingTop: 18,
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

      <ScrollView
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: wingmanLayout.screenPadding,
          paddingVertical: 14,
          gap: 10,
          paddingBottom: 22,
        }}>
        {chatMessages.map((message) => (
          <MessageBubble
            key={message.id}
            from={message.from}
            text={message.text}
            status={message.status}
          />
        ))}

        {isTyping ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <PipCircle variant="thinking" size={28} ring={false} />
            <StickerCard
              style={{
                borderColor: colors.ink,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomLeftRadius: 6,
                alignSelf: 'flex-start',
              }}>
              <TypingDots color={colors.sky500} />
            </StickerCard>
          </View>
        ) : null}

        <View style={{ paddingTop: 2 }}>
          <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <PipCircle variant={reaction.pip} size={46} ring={false} backgroundColor={colors.card} />
            {draft && reaction.hint ? (
              <StickerCard
                borderColor={reaction.color}
                style={{
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
          </View>
        </View>
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
              }
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: draft ? reaction.color : colors.section,
            }}>
            <IconGlyph
              name={draft ? 'arrow-up' : 'mic'}
              color={draft ? '#FFFFFF' : colors.fgSecondary}
              size={18}
            />
          </Pressable>
        </StickerCard>
      </View>

      <PipCompanion
        floor={floorRect}
        nest={nestRect}
        focused={isComposerFocused}
        sendTick={sendTick}
      />
      </View>
    </KeyboardAvoidingView>
  );
}
