import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  describeSchedule,
  type FlowItem,
  type FlowSchedule,
  type FlowStep,
} from '@/features/wingman/data';
import { useWingman } from '@/features/wingman/provider';
import { IconGlyph, WingmanLabel } from '@/features/wingman/primitives';
import {
  skyShadow,
  stickerShadow,
  withAlpha,
  wingmanFonts,
  wingmanLayout,
} from '@/features/wingman/theme';

// --- The real step catalog -------------------------------------------------
// Every entry maps to an actual server tool the flow runner can execute. The
// runner validates saved steps against these tool names, so this list is the
// single source of truth for "what a flow can do".

type StepArgField = { name: string; label: string; placeholder: string };

type StepCatalogItem = {
  key: string;
  label: string;
  emoji: string;
  description: string;
  tool: string;
  defaultArgs: Record<string, unknown>;
  arg?: StepArgField;
};

const STEP_CATALOG: StepCatalogItem[] = [
  {
    key: 'briefing',
    label: 'Morning briefing',
    emoji: '🌅',
    description: "Summarize today's plan and counts",
    tool: 'briefing_today',
    defaultArgs: {},
  },
  {
    key: 'calendar-today',
    label: "Read today's calendar",
    emoji: '📆',
    description: "List today's events",
    tool: 'calendar_read_today',
    defaultArgs: { offset: 0 },
  },
  {
    key: 'calendar-tomorrow',
    label: "Read tomorrow's calendar",
    emoji: '🌙',
    description: "List tomorrow's events",
    tool: 'calendar_read_today',
    defaultArgs: { offset: 1 },
  },
  {
    key: 'create-event',
    label: 'Create a calendar event',
    emoji: '➕',
    description: 'Add an event from a description',
    tool: 'calendar_create_event',
    defaultArgs: { intent: '' },
    arg: { name: 'intent', label: 'What to schedule', placeholder: 'lunch with Mara tomorrow at noon' },
  },
  {
    key: 'remember',
    label: 'Remember a note',
    emoji: '🧠',
    description: 'Save a fact to long-term memory',
    tool: 'remember',
    defaultArgs: { note: '' },
    arg: { name: 'note', label: 'Note to remember', placeholder: 'Standup is at 9am' },
  },
];

/** Find the catalog entry that best describes a saved step. */
function catalogForStep(step: FlowStep): StepCatalogItem {
  if (step.tool === 'calendar_read_today') {
    const offset = typeof step.args?.offset === 'number' ? step.args.offset : 0;
    return (
      STEP_CATALOG.find((item) => item.tool === step.tool && item.defaultArgs.offset === offset)
      ?? STEP_CATALOG[1]!
    );
  }
  return STEP_CATALOG.find((item) => item.tool === step.tool) ?? {
    key: step.tool,
    label: step.tool,
    emoji: '⚡',
    description: 'Custom step',
    tool: step.tool,
    defaultArgs: {},
  };
}

// --- Schedule helpers (mirror the server's schedule model) -----------------

type SchedulePresetKey = 'manual' | 'daily' | 'weekdays' | 'weekends';

const schedulePresets: { key: SchedulePresetKey; label: string; days: number[] | null }[] = [
  { key: 'manual', label: 'Manual', days: null },
  { key: 'daily', label: 'Daily', days: [] },
  { key: 'weekdays', label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { key: 'weekends', label: 'Weekends', days: [0, 6] },
];

const SCHEDULE_STEP_MINUTES = 30;

function sameDaySet(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((value) => set.has(value));
}

function presetKeyFromSchedule(schedule: FlowSchedule | null): SchedulePresetKey {
  if (!schedule) return 'manual';
  const days = [...schedule.days].sort((a, b) => a - b);
  if (days.length === 0) return 'daily';
  if (sameDaySet(days, [1, 2, 3, 4, 5])) return 'weekdays';
  if (sameDaySet(days, [0, 6])) return 'weekends';
  return 'daily';
}

function scheduleFor(key: SchedulePresetKey, hour: number, minute: number): FlowSchedule | null {
  const preset = schedulePresets.find((entry) => entry.key === key);
  if (!preset || preset.days === null) return null;
  return { hour, minute, days: preset.days };
}

function clockLabel(hour: number, minute: number) {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function stepClock(hour: number, minute: number, deltaMinutes: number) {
  const total = (hour * 60 + minute + deltaMinutes + 24 * 60) % (24 * 60);
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

function newStepId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type StatusTone = 'info' | 'ok' | 'error';
type BuilderStatus = { tone: StatusTone; text: string };

const fallbackFlow: FlowItem = {
  id: 'new-flow',
  emoji: '✨',
  title: 'New workflow',
  description: 'Draft automation',
  trigger: 'Manual trigger',
  runs: 0,
  color: '#3B82F6',
  active: false,
};

// --- UI sections -----------------------------------------------------------

function PipelineConnector({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', height: 18 }}>
      <View style={{ width: 2, flex: 1, backgroundColor: withAlpha(color, 0.35) }} />
    </View>
  );
}

function TriggerCard({
  color,
  hour,
  minute,
  presetKey,
  onSelectPreset,
  onShiftTime,
}: {
  color: string;
  hour: number;
  minute: number;
  presetKey: SchedulePresetKey;
  onSelectPreset: (key: SchedulePresetKey) => void;
  onShiftTime: (deltaMinutes: number) => void;
}) {
  const { colors } = useWingman();

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: withAlpha(color, 0.5),
        backgroundColor: colors.card,
        padding: 12,
        gap: 10,
        borderCurve: 'continuous',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: withAlpha(color, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 16 }}>⏱️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color, fontFamily: wingmanFonts.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' }}>
            Trigger
          </Text>
          <Text style={{ color: colors.ink, fontFamily: wingmanFonts.display, fontSize: 15, fontWeight: '700' }}>
            {presetKey === 'manual' ? 'Run manually' : `Runs ${describeSchedule(scheduleFor(presetKey, hour, minute))}`}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 5 }}>
        {schedulePresets.map((preset) => {
          const active = preset.key === presetKey;
          return (
            <Pressable
              key={preset.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Trigger ${preset.label}`}
              onPress={() => onSelectPreset(preset.key)}
              style={{
                flex: 1,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: active ? colors.sky500 : colors.border,
                backgroundColor: active ? colors.sky500 : colors.cardAlt,
                alignItems: 'center',
                borderCurve: 'continuous',
              }}>
              <Text
                numberOfLines={1}
                style={{ color: active ? '#FFFFFF' : colors.fgSecondary, fontFamily: wingmanFonts.text, fontSize: 10, fontWeight: '900' }}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {presetKey !== 'manual' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Earlier"
            onPress={() => onShiftTime(-SCHEDULE_STEP_MINUTES)}
            style={({ pressed }) => ({
              width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border,
              backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
            })}>
            <IconGlyph name="chevron-left" color={colors.ink} size={15} />
          </Pressable>
          <Text style={{ minWidth: 92, textAlign: 'center', color: colors.ink, fontFamily: wingmanFonts.display, fontSize: 16, fontWeight: '700' }}>
            {clockLabel(hour, minute)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Later"
            onPress={() => onShiftTime(SCHEDULE_STEP_MINUTES)}
            style={({ pressed }) => ({
              width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border,
              backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
            })}>
            <IconGlyph name="chevron-left" color={colors.ink} size={15} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function StepCard({
  step,
  index,
  total,
  onChangeArg,
  onMove,
  onRemove,
}: {
  step: FlowStep;
  index: number;
  total: number;
  onChangeArg: (id: string, argName: string, value: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const { colors } = useWingman();
  const item = catalogForStep(step);

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: 12,
        gap: 10,
        borderCurve: 'continuous',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View
          style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: withAlpha(colors.lav500, 0.16),
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.fgMuted, fontFamily: wingmanFonts.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' }}>
            Step {index + 1}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.ink, fontFamily: wingmanFonts.display, fontSize: 14, fontWeight: '700' }}>
            {item.label}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.fgSecondary, fontFamily: wingmanFonts.text, fontSize: 10, fontWeight: '600' }}>
            {item.description}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move step up"
            disabled={index === 0}
            onPress={() => onMove(step.id, -1)}
            style={({ pressed }) => ({
              width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
              backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center',
              opacity: index === 0 ? 0.35 : pressed ? 0.7 : 1,
            })}>
            <IconGlyph name="chevron-left" color={colors.ink} size={13} style={{ transform: [{ rotate: '90deg' }] }} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move step down"
            disabled={index === total - 1}
            onPress={() => onMove(step.id, 1)}
            style={({ pressed }) => ({
              width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
              backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center',
              opacity: index === total - 1 ? 0.35 : pressed ? 0.7 : 1,
            })}>
            <IconGlyph name="chevron-left" color={colors.ink} size={13} style={{ transform: [{ rotate: '270deg' }] }} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove step"
            onPress={() => onRemove(step.id)}
            style={({ pressed }) => ({
              width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: withAlpha(colors.coral500, 0.4),
              backgroundColor: withAlpha(colors.coral500, 0.12), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
            })}>
            <IconGlyph name="trash" color={colors.coral500} size={13} />
          </Pressable>
        </View>
      </View>

      {item.arg ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.fgSecondary, fontFamily: wingmanFonts.text, fontSize: 11, fontWeight: '800' }}>
            {item.arg.label}
          </Text>
          <TextInput
            value={typeof step.args[item.arg.name] === 'string' ? (step.args[item.arg.name] as string) : ''}
            onChangeText={(value) => onChangeArg(step.id, item.arg!.name, value)}
            placeholder={item.arg.placeholder}
            placeholderTextColor={colors.fgMuted}
            style={{
              minHeight: 42, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
              backgroundColor: colors.bg, paddingHorizontal: 12, color: colors.ink,
              fontFamily: wingmanFonts.text, fontSize: 13, fontWeight: '600',
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function AddStepSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (item: StepCatalogItem) => void;
}) {
  const { colors } = useWingman();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(27,34,64,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1.5, borderColor: colors.border, gap: 8,
          }}>
          <View style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 6 }} />
          <Text style={{ color: colors.ink, fontFamily: wingmanFonts.display, fontSize: 18, fontWeight: '700', paddingHorizontal: 4 }}>
            Add a step
          </Text>
          {STEP_CATALOG.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onPick(item)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
                backgroundColor: pressed ? colors.cardAlt : 'transparent',
                borderWidth: 1.5, borderColor: colors.border, borderCurve: 'continuous',
              })}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: withAlpha(colors.lav500, 0.14), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontFamily: wingmanFonts.text, fontSize: 14, fontWeight: '700' }}>{item.label}</Text>
                <Text style={{ color: colors.fgMuted, fontFamily: wingmanFonts.text, fontSize: 12, fontWeight: '600' }}>{item.description}</Text>
              </View>
              <IconGlyph name="plus" color={colors.sky500} size={18} />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StatusStrip({ status }: { status: BuilderStatus }) {
  const { colors } = useWingman();
  const tone = status.tone === 'ok' ? colors.mint500 : status.tone === 'error' ? colors.coral500 : colors.sky500;

  return (
    <View
      style={{
        marginHorizontal: wingmanLayout.screenPadding, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 8,
        borderRadius: 14, borderWidth: 1.5, borderColor: withAlpha(tone, 0.45), backgroundColor: withAlpha(tone, 0.1),
        flexDirection: 'row', alignItems: 'center', gap: 8, borderCurve: 'continuous',
      }}>
      <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: tone }} />
      <Text style={{ flex: 1, color: colors.ink, fontFamily: wingmanFonts.text, fontSize: 11, fontWeight: '700', lineHeight: 15 }}>
        {status.text}
      </Text>
    </View>
  );
}

export function FlowBuilderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { flowId } = useLocalSearchParams<{ flowId?: string }>();
  const { colors, deleteFlow, flows, getFlowDetail, runFlow, updateFlow } = useWingman();

  const flow = React.useMemo(
    () => flows.find((item) => item.id === flowId) ?? flows[0] ?? fallbackFlow,
    [flowId, flows],
  );

  const [title, setTitle] = React.useState(flow.title);
  const [schedulePresetKey, setSchedulePresetKey] = React.useState<SchedulePresetKey>('manual');
  const [scheduleHour, setScheduleHour] = React.useState(8);
  const [scheduleMinute, setScheduleMinute] = React.useState(0);
  const [steps, setSteps] = React.useState<FlowStep[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [status, setStatus] = React.useState<BuilderStatus | null>(null);

  const schedule = React.useMemo(
    () => scheduleFor(schedulePresetKey, scheduleHour, scheduleMinute),
    [schedulePresetKey, scheduleHour, scheduleMinute],
  );

  // Hydrate the real definition (title + schedule + steps) when the flow opens.
  const getFlowDetailRef = React.useRef(getFlowDetail);
  React.useEffect(() => {
    getFlowDetailRef.current = getFlowDetail;
  }, [getFlowDetail]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const detail = await getFlowDetailRef.current(flow.id);
      if (cancelled) return;
      const loadedSchedule = detail?.definition?.schedule ?? null;
      setTitle(detail?.title ?? flow.title);
      setSchedulePresetKey(presetKeyFromSchedule(loadedSchedule));
      if (loadedSchedule) {
        setScheduleHour(loadedSchedule.hour);
        setScheduleMinute(loadedSchedule.minute);
      } else {
        setScheduleHour(8);
        setScheduleMinute(0);
      }
      setSteps((detail?.definition?.steps ?? []).map((step) => ({ ...step, args: { ...step.args } })));
      setStatus(null);
      setSaved(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [flow.id, flow.title]);

  const markDirty = React.useCallback(() => {
    setSaved(false);
    setStatus(null);
  }, []);

  const selectPreset = React.useCallback((key: SchedulePresetKey) => {
    void Haptics.selectionAsync();
    markDirty();
    setSchedulePresetKey(key);
  }, [markDirty]);

  const shiftTime = React.useCallback((deltaMinutes: number) => {
    void Haptics.selectionAsync();
    markDirty();
    setScheduleHour((h) => {
      const next = stepClock(h, scheduleMinute, deltaMinutes);
      setScheduleMinute(next.minute);
      return next.hour;
    });
  }, [markDirty, scheduleMinute]);

  const addStep = React.useCallback((item: StepCatalogItem) => {
    void Haptics.selectionAsync();
    markDirty();
    setSteps((current) => [...current, { id: newStepId(), tool: item.tool, args: { ...item.defaultArgs } }]);
    setPickerOpen(false);
  }, [markDirty]);

  const changeArg = React.useCallback((id: string, argName: string, value: string) => {
    markDirty();
    setSteps((current) => current.map((step) => (
      step.id === id ? { ...step, args: { ...step.args, [argName]: value } } : step
    )));
  }, [markDirty]);

  const moveStep = React.useCallback((id: string, direction: -1 | 1) => {
    void Haptics.selectionAsync();
    markDirty();
    setSteps((current) => {
      const index = current.findIndex((step) => step.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }, [markDirty]);

  const removeStep = React.useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markDirty();
    setSteps((current) => current.filter((step) => step.id !== id));
  }, [markDirty]);

  // A step that needs a text arg but has none isn't runnable — guard saving/testing.
  const incompleteStep = React.useMemo(
    () => steps.find((step) => {
      const item = catalogForStep(step);
      return item.arg && !String(step.args[item.arg.name] ?? '').trim();
    }),
    [steps],
  );

  const persist = React.useCallback(async (): Promise<boolean> => {
    const cleanTitle = title.trim() || 'New workflow';
    const result = await updateFlow(flow.id, { title: cleanTitle, schedule, steps });
    if (!result) {
      setStatus({ tone: 'error', text: 'Could not save — please sign in again.' });
      return false;
    }
    return true;
  }, [flow.id, schedule, steps, title, updateFlow]);

  const handleSave = React.useCallback(async () => {
    if (saving) return;
    if (incompleteStep) {
      const item = catalogForStep(incompleteStep);
      setStatus({ tone: 'error', text: `Fill in "${item.arg?.label}" for ${item.label}.` });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const ok = await persist();
      if (!ok) return;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      const stepLabel = steps.length ? ` · ${steps.length} step${steps.length === 1 ? '' : 's'}` : ' · no steps yet';
      setStatus({ tone: 'ok', text: `Saved · ${describeSchedule(schedule)}${stepLabel}` });
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }, [incompleteStep, persist, saving, schedule, steps.length]);

  const handleTest = React.useCallback(async () => {
    if (running) return;
    if (steps.length === 0) {
      setStatus({ tone: 'info', text: 'Add at least one step for Pip to run.' });
      return;
    }
    if (incompleteStep) {
      const item = catalogForStep(incompleteStep);
      setStatus({ tone: 'error', text: `Fill in "${item.arg?.label}" for ${item.label}.` });
      return;
    }
    setRunning(true);
    setStatus({ tone: 'info', text: 'Running this flow now…' });
    try {
      const ok = await persist();
      if (!ok) return;
      setSaved(true);
      const result = await runFlow(flow.id);
      if (!result) {
        setStatus({ tone: 'error', text: 'Could not run — please sign in again.' });
        return;
      }
      await Haptics.notificationAsync(
        result.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      );
      if (result.ok) {
        setStatus({ tone: 'ok', text: result.outputs.length ? result.outputs.join(' · ') : 'Flow ran — nothing to report.' });
      } else {
        setStatus({ tone: 'error', text: result.error ? `Flow failed: ${result.error}` : 'Flow failed.' });
      }
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Run failed.' });
    } finally {
      setRunning(false);
    }
  }, [flow.id, incompleteStep, persist, running, runFlow, steps.length]);

  const canTest = steps.length > 0 && !running;
  // `flow` falls back to a placeholder when the list is empty; only offer delete
  // for a flow that actually exists server-side.
  const isRealFlow = flows.some((item) => item.id === flow.id);

  const handleDelete = React.useCallback(() => {
    Alert.alert(
      'Delete this flow?',
      `“${title || flow.title}” will be removed and stop running. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {
              // Haptics are best-effort.
            }
            const ok = await deleteFlow(flow.id);
            if (ok) {
              router.back();
            } else {
              setStatus({ tone: 'error', text: 'Could not delete this flow. Try again.' });
            }
          },
        },
      ],
    );
  }, [deleteFlow, flow.id, flow.title, router, title]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ paddingTop: Math.max(insets.top + 14, 18), paddingHorizontal: wingmanLayout.screenPadding, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border,
              backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.72 : 1,
            })}>
            <IconGlyph name="chevron-left" color={colors.ink} size={19} />
          </Pressable>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: flow.color, fontFamily: wingmanFonts.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Edit flow
            </Text>
            <TextInput
              value={title}
              onChangeText={(value) => { markDirty(); setTitle(value); }}
              placeholder="Name this workflow"
              placeholderTextColor={colors.fgMuted}
              style={{ color: colors.ink, fontFamily: wingmanFonts.display, fontSize: 22, fontWeight: '700', padding: 0 }}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Workflow saved' : 'Save workflow'}
            onPress={() => void handleSave()}
            style={({ pressed }) => ({
              minHeight: 36, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1.5,
              borderColor: saved && !saving ? colors.mint500 : colors.sky700,
              backgroundColor: saved && !saving ? colors.mint500 : colors.sky500,
              flexDirection: 'row', alignItems: 'center', gap: 5, opacity: pressed ? 0.76 : 1,
              boxShadow: saved && !saving ? stickerShadow('light') : skyShadow(),
            })}>
            <IconGlyph name="checkmark" color="#FFFFFF" size={14} />
            <Text style={{ color: '#FFFFFF', fontFamily: wingmanFonts.text, fontSize: 12, fontWeight: '900' }}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingHorizontal: wingmanLayout.screenPadding, paddingBottom: 16, gap: 0 }}>
        <View style={{ paddingVertical: 6, gap: 0 }}>
          <WingmanLabel color={flow.color}>Pipeline</WingmanLabel>
          <Text style={{ color: colors.fgMuted, fontFamily: wingmanFonts.text, fontSize: 11, fontWeight: '700', marginTop: 4, marginBottom: 8 }}>
            Pip runs these steps in order, top to bottom.
          </Text>
        </View>

        <TriggerCard
          color={flow.color}
          hour={scheduleHour}
          minute={scheduleMinute}
          presetKey={schedulePresetKey}
          onSelectPreset={selectPreset}
          onShiftTime={shiftTime}
        />

        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <PipelineConnector color={flow.color} />
            <StepCard
              step={step}
              index={index}
              total={steps.length}
              onChangeArg={changeArg}
              onMove={moveStep}
              onRemove={removeStep}
            />
          </React.Fragment>
        ))}

        <PipelineConnector color={flow.color} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a step"
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => ({
            minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.sky500,
            backgroundColor: withAlpha(colors.sky500, 0.07), flexDirection: 'row', alignItems: 'center',
            justifyContent: 'center', gap: 8, opacity: pressed ? 0.76 : 1, borderCurve: 'continuous',
          })}>
          <IconGlyph name="plus" color={colors.sky500} size={18} />
          <Text style={{ color: colors.sky500, fontFamily: wingmanFonts.text, fontSize: 13, fontWeight: '900' }}>
            Add step
          </Text>
        </Pressable>

        {steps.length > 0 ? (
          <>
            <PipelineConnector color={flow.color} />
            <View
              style={{
                borderRadius: 16, borderWidth: 1.5, borderColor: withAlpha(colors.mint500, 0.5),
                backgroundColor: withAlpha(colors.mint500, 0.08), padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9,
              }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: withAlpha(colors.mint500, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                <IconGlyph name="checkmark" color={colors.mint500} size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mint500, fontFamily: wingmanFonts.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' }}>
                  Finish
                </Text>
                <Text style={{ color: colors.ink, fontFamily: wingmanFonts.display, fontSize: 14, fontWeight: '700' }}>
                  Logs the result to Activity
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Test run this flow now"
          disabled={!canTest}
          onPress={() => void handleTest()}
          style={({ pressed }) => ({
            marginTop: 16, minHeight: 46, borderRadius: 14, borderWidth: 1.5,
            borderColor: canTest ? colors.lav500 : colors.border,
            backgroundColor: canTest ? withAlpha(colors.lav500, 0.14) : colors.cardAlt,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
            opacity: pressed ? 0.76 : 1, borderCurve: 'continuous',
          })}>
          <IconGlyph name="flows" color={canTest ? colors.lav500 : colors.fgMuted} size={16} />
          <Text style={{ color: canTest ? colors.lav500 : colors.fgMuted, fontFamily: wingmanFonts.text, fontSize: 13, fontWeight: '900' }}>
            {running ? 'Running…' : 'Test run now'}
          </Text>
        </Pressable>

        {isRealFlow ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete this flow"
            onPress={handleDelete}
            style={({ pressed }) => ({
              marginTop: 10, minHeight: 46, borderRadius: 14, borderWidth: 1.5,
              borderColor: withAlpha(colors.error, 0.5), backgroundColor: withAlpha(colors.error, 0.08),
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
              opacity: pressed ? 0.76 : 1, borderCurve: 'continuous',
            })}>
            <IconGlyph name="trash" color={colors.error} size={16} />
            <Text style={{ color: colors.error, fontFamily: wingmanFonts.text, fontSize: 13, fontWeight: '900' }}>
              Delete flow
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {status ? <StatusStrip status={status} /> : null}

      <AddStepSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addStep} />
    </View>
  );
}
