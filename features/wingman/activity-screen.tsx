import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { ActivityEvent, FlowItem } from '@/features/wingman/data';
import { useWingman } from '@/features/wingman/provider';
import { IconGlyph, PipCircle, StateNotice, WingmanLabel } from '@/features/wingman/primitives';
import {
  withAlpha,
  wingmanFonts,
  wingmanLayout,
} from '@/features/wingman/theme';

function actionLabelFor(event: ActivityEvent) {
  const haystack = `${event.title} ${event.subtitle}`.toLowerCase();

  if (haystack.includes('email') || haystack.includes('digest')) return 'Open';
  if (haystack.includes('scheduled') || haystack.includes('meeting') || haystack.includes('lunch')) return 'View';
  if (haystack.includes('reminder')) return 'Done';
  if (haystack.includes('pr') || haystack.includes('merged')) return 'Review';
  if (haystack.includes('flow')) return 'Edit';
  return 'View';
}

function sectionFor(event: ActivityEvent) {
  return event.when.toLowerCase().includes('yesterday') ? 'Earlier' : 'Today';
}

/**
 * Where tapping an activity (row or action button) should take you. Flow events
 * jump straight into that flow's builder (matched by title, since activities
 * store the flow title as their subtitle); everything else routes to the screen
 * where you'd act on it.
 */
function destinationFor(event: ActivityEvent, flows: FlowItem[]): string {
  const haystack = `${event.title} ${event.subtitle}`.toLowerCase();

  if (haystack.includes('flow')) {
    const match = flows.find((flow) => flow.title.trim().toLowerCase() === event.subtitle.trim().toLowerCase());
    return match ? `/flow-builder?flowId=${encodeURIComponent(match.id)}` : '/(tabs)/flows';
  }
  if (haystack.includes('connected') || haystack.includes('connect')) return '/apps';
  if (
    haystack.includes('calendar') || haystack.includes('meeting') || haystack.includes('event')
    || haystack.includes('lunch') || haystack.includes('scheduled')
  ) {
    return '/(tabs)';
  }
  if (haystack.includes('email') || haystack.includes('digest') || haystack.includes('reminder') || haystack.includes('remember')) {
    return '/(tabs)/chat';
  }
  return '/(tabs)';
}

function ActivityRow({
  event,
  index,
  isLast,
}: {
  event: ActivityEvent;
  index: number;
  isLast: boolean;
}) {
  const { colors, flows } = useWingman();
  const router = useRouter();
  const unread = sectionFor(event) === 'Today';
  const actionLabel = actionLabelFor(event);

  const goToDestination = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    router.push(destinationFor(event, flows) as never);
  }, [event, flows, router]);

  return (
    <Animated.View
      entering={FadeInDown.delay(45 + index * 35).duration(300).springify().damping(18)}
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}>
      {/* Row tap and the action button are siblings, not nested — nested
          <Pressable> renders as nested <button> on web (invalid HTML). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${event.title}. ${event.subtitle}. ${event.when}`}
        onPress={goToDestination}
        style={({ pressed }) => ({
          flex: 1,
          minWidth: 0,
          minHeight: 72,
          paddingVertical: 11,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.72 : 1,
        })}>
        <View style={{ position: 'relative' }}>
          <PipCircle
            variant={event.pip}
            size={44}
            ring={false}
            backgroundColor={withAlpha(event.color, unread ? 0.18 : 0.1)}
          />
          {unread ? (
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: colors.sky500,
                borderWidth: 2,
                borderColor: colors.bg,
              }}
            />
          ) : null}
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            numberOfLines={2}
            style={{
              color: unread ? colors.ink : colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 13,
              fontWeight: '600',
              lineHeight: 18,
              letterSpacing: 0,
            }}>
            <Text style={{ fontWeight: '900' }}>{event.title}</Text>
            {` ${event.subtitle}`}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.fgMuted,
              fontFamily: wingmanFonts.text,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0,
            }}>
            {event.when}
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} ${event.title}`}
        onPress={goToDestination}
          style={({ pressed }) => ({
            minWidth: 56,
            height: 30,
            paddingHorizontal: 10,
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: unread ? colors.sky500 : colors.cardAlt,
            borderWidth: 1,
            borderColor: unread ? colors.sky700 : colors.border,
            opacity: pressed ? 0.78 : 1,
            borderCurve: 'continuous',
          })}>
          <Text
            style={{
              color: unread ? '#FFFFFF' : colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 0,
            }}>
            {actionLabel}
          </Text>
      </Pressable>
    </Animated.View>
  );
}

function ActivitySection({
  title,
  events,
  offset,
}: {
  title: string;
  events: ActivityEvent[];
  offset: number;
}) {
  const { colors } = useWingman();

  if (!events.length) return null;

  return (
    <View style={{ gap: 8 }}>
      <WingmanLabel color={title === 'Today' ? colors.sky500 : colors.fgMuted}>{title}</WingmanLabel>
      <View
        style={{
          paddingHorizontal: 2,
        }}>
        {events.map((event, index) => (
          <ActivityRow
            key={event.id}
            event={event}
            index={offset + index}
            isLast={index === events.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

export function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { colors, dataError, dataLoading, events, refreshData } = useWingman();
  const todayEvents = events.filter((event) => sectionFor(event) === 'Today');
  const earlierEvents = events.filter((event) => sectionFor(event) === 'Earlier');

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: Math.max(insets.top + 14, 18),
        paddingHorizontal: wingmanLayout.screenPadding,
        paddingBottom: Math.max(insets.bottom, 16) + 112,
        gap: 18,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
        }}>
        <View style={{ gap: 5 }}>
          <WingmanLabel>Notifications</WingmanLabel>
          <Text
            style={{
              color: colors.fgPrimary,
              fontFamily: wingmanFonts.display,
              fontSize: 32,
              fontWeight: '700',
              lineHeight: 34,
              letterSpacing: 0,
            }}>
            Activity
          </Text>
          <Text
            style={{
              color: colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 13,
              fontWeight: '700',
              lineHeight: 18,
            }}>
            Recent actions and updates
          </Text>
        </View>
        <View
          style={{
            height: 32,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: withAlpha(colors.sky500, 0.12),
            borderWidth: 1,
            borderColor: withAlpha(colors.sky500, 0.22),
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderCurve: 'continuous',
          }}>
          <IconGlyph name="notifications" color={colors.sky600} size={15} />
          <Text
            style={{
              color: colors.sky600,
              fontFamily: wingmanFonts.text,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 0,
            }}>
            {todayEvents.length} new
          </Text>
        </View>
      </View>

      <ActivitySection title="Today" events={todayEvents} offset={0} />
      <ActivitySection title="Earlier" events={earlierEvents} offset={todayEvents.length} />

      {events.length === 0 ? (
        dataError ? (
          <StateNotice
            tone="error"
            title="Couldn't load activity"
            body={dataError}
            actionLabel="Try again"
            onAction={() => void refreshData()}
          />
        ) : dataLoading ? (
          <StateNotice tone="loading" title="Loading activity…" />
        ) : (
          <StateNotice
            pip="sleeping"
            title="Nothing here yet"
            body="When Pip runs a flow or takes an action, it shows up here."
          />
        )
      ) : null}
    </ScrollView>
  );
}
