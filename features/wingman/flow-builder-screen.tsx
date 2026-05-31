import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appLibrary, type AppIntegration, type FlowItem } from '@/features/wingman/data';
import { useWingman } from '@/features/wingman/provider';
import {
  IconGlyph,
  PipCircle,
  WingmanLabel,
} from '@/features/wingman/primitives';
import {
  skyShadow,
  stickerShadow,
  withAlpha,
  wingmanFonts,
  wingmanLayout,
} from '@/features/wingman/theme';

type BuilderNodeId = string;
type WorkflowEdgeId = string;
type WorkflowNodeKind = 'timer' | 'connector' | 'logic' | 'action';
type CreateNodeKind = 'timer' | 'connector' | 'action';

type WorkflowNode = {
  id: BuilderNodeId;
  kind: WorkflowNodeKind;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  emoji: string;
  color: string;
};

type WorkflowEdge = {
  id: WorkflowEdgeId;
  from: BuilderNodeId;
  to: BuilderNodeId;
  label: string;
};

type CanvasPoint = {
  x: number;
  y: number;
};

type NodePositions = Record<string, CanvasPoint>;

type BuilderMessage = {
  id: string;
  from: 'pip' | 'user';
  text: string;
};

const fallbackFlow: FlowItem = {
  id: 'new-flow',
  emoji: '✨',
  title: 'Untitled workflow',
  description: 'Draft automation',
  trigger: 'Manual trigger',
  runs: 0,
  color: '#3B82F6',
  active: false,
};

const promptChips = [
  'Build this from my apps',
  'Add approval before sending',
  'Only run on weekdays',
  'Test with sample data',
] as const;

const createNodeOptions = [
  { kind: 'timer', label: 'Timer', emoji: '⏱️' },
  { kind: 'connector', label: 'Connector', emoji: '🔌' },
  { kind: 'action', label: 'Action', emoji: '⚡' },
] satisfies { kind: CreateNodeKind; label: string; emoji: string }[];

const workflowEdges: WorkflowEdge[] = [
  { id: 'trigger-context', from: 'trigger', to: 'context', label: 'schedule' },
  { id: 'context-reasoning', from: 'context', to: 'reasoning', label: 'context' },
  { id: 'reasoning-delivery', from: 'reasoning', to: 'delivery', label: 'action' },
];

const defaultCanvasHeight = 330;
const nodeWidth = 204;
const nodeHeight = 78;
const canvasPadding = 12;
const edgeHitHeight = 24;

function defaultConnectionIdsFor(flow: FlowItem) {
  const text = `${flow.title} ${flow.description} ${flow.trigger}`.toLowerCase();
  const ids = new Set<string>(['composio']);

  if (text.includes('calendar') || text.includes('meeting') || text.includes('birthday')) {
    ids.add('calendar');
  }

  if (text.includes('email') || text.includes('inbox') || text.includes('digest')) {
    ids.add('gmail');
  }

  if (text.includes('standup') || text.includes('ping') || text.includes('nudge')) {
    ids.add('slack');
  }

  if (text.includes('github') || text.includes('pr') || text.includes('merged')) {
    ids.add('github');
  }

  if (text.includes('digest') || text.includes('brief')) {
    ids.add('notion');
  }

  return [...ids];
}

function defaultNodePositionsFor(canvasWidth: number, canvasHeight: number): NodePositions {
  const usableWidth = Math.max(canvasWidth, 330);
  const usableHeight = Math.max(canvasHeight, 280);
  const centerColumn = Math.max(canvasPadding, Math.round((usableWidth - nodeWidth) / 2));
  const maxY = Math.max(canvasPadding, usableHeight - nodeHeight - canvasPadding);
  const top = canvasPadding + 4;
  const rowGap = Math.max(72, Math.min(108, Math.floor((maxY - top) / 3)));
  const offset = (value: number) => (
    Math.min(Math.max(centerColumn + value, canvasPadding), usableWidth - nodeWidth - canvasPadding)
  );
  const y = (index: number) => Math.min(top + rowGap * index, maxY);

  return {
    trigger: { x: offset(-38), y: y(0) },
    context: { x: offset(38), y: y(1) },
    reasoning: { x: offset(-14), y: y(2) },
    delivery: { x: offset(28), y: y(3) },
  };
}

function clampNodePosition(point: CanvasPoint, canvasWidth: number, canvasHeight: number) {
  const maxX = Math.max(canvasPadding, canvasWidth - nodeWidth - canvasPadding);
  const maxY = Math.max(canvasPadding, canvasHeight - nodeHeight - canvasPadding);

  return {
    x: Math.min(Math.max(point.x, canvasPadding), maxX),
    y: Math.min(Math.max(point.y, canvasPadding), maxY),
  };
}

function centerFor(point: CanvasPoint) {
  return {
    x: point.x + nodeWidth / 2,
    y: point.y + nodeHeight / 2,
  };
}

function canvasSubtitleFor(node: WorkflowNode) {
  if (node.kind === 'timer') return 'Starts the run';
  if (node.kind === 'connector') return 'Routes app data';
  if (node.kind === 'logic') return 'Chooses next step';
  return 'Runs and logs it';
}

function workflowNodesFor(flow: FlowItem, colors: ReturnType<typeof useWingman>['colors']) {
  return [
    {
      id: 'trigger',
      kind: 'timer',
      eyebrow: 'Trigger',
      title: flow.trigger,
      description: 'Starts the workflow on schedule, activity, or manual run.',
      detail: flow.active ? 'Live' : 'Paused',
      emoji: '⏱️',
      color: flow.color,
    },
    {
      id: 'context',
      kind: 'connector',
      eyebrow: 'Connections',
      title: 'Composio router',
      description: 'Pulls the right app data and handles tool calls safely.',
      detail: 'Apps',
      emoji: '🔌',
      color: colors.lav500,
    },
    {
      id: 'reasoning',
      kind: 'logic',
      eyebrow: 'Pip',
      title: 'Plan and decide',
      description: `Turns app context into the next step for ${flow.title.toLowerCase()}.`,
      detail: 'LLM',
      emoji: '✨',
      color: colors.mint500,
    },
    {
      id: 'delivery',
      kind: 'action',
      eyebrow: 'Action',
      title: 'Queue delivery',
      description: 'Runs the action, stores the result, and records activity.',
      detail: 'BullMQ',
      emoji: flow.emoji,
      color: colors.coral500,
    },
  ] satisfies WorkflowNode[];
}

function createNodeForKind(
  kind: CreateNodeKind,
  count: number,
  colors: ReturnType<typeof useWingman>['colors'],
) {
  if (kind === 'timer') {
    return {
      kind,
      eyebrow: 'Timer',
      title: `Timer ${count}`,
      description: 'Runs this branch on a schedule, delay, or wait condition.',
      detail: 'Time',
      emoji: '⏱️',
      color: colors.sun500,
    } satisfies Omit<WorkflowNode, 'id'>;
  }

  if (kind === 'connector') {
    return {
      kind,
      eyebrow: 'Connector',
      title: `Connector ${count}`,
      description: 'Routes data through Composio or a connected app.',
      detail: 'Apps',
      emoji: '🔌',
      color: colors.lav500,
    } satisfies Omit<WorkflowNode, 'id'>;
  }

  return {
    kind,
    eyebrow: 'Action',
    title: `Action ${count}`,
    description: 'Performs a workflow step, sends a message, or writes a result.',
    detail: 'Run',
    emoji: '⚡',
    color: colors.coral500,
  } satisfies Omit<WorkflowNode, 'id'>;
}

function replyForPrompt(prompt: string, flow: FlowItem, selectedNode: WorkflowNode) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes('approval')) {
    return `Added an approval branch before "${selectedNode.title}" so ${flow.title.toLowerCase()} waits before taking action.`;
  }

  if (normalized.includes('weekday')) {
    return `Set the trigger rules to weekdays and kept the current ${flow.trigger.toLowerCase()} timing.`;
  }

  if (normalized.includes('test')) {
    return `Prepared a dry run with sample app data and no live sends for ${flow.title.toLowerCase()}.`;
  }

  return `Drafted the workflow shape for ${flow.title.toLowerCase()} with trigger, app context, Pip reasoning, and delivery nodes.`;
}

function CanvasEdge({
  color,
  edge,
  from,
  selected,
  to,
  onSelect,
}: {
  color: string;
  edge: WorkflowEdge;
  from: CanvasPoint;
  selected: boolean;
  to: CanvasPoint;
  onSelect: (edgeId: WorkflowEdgeId) => void;
}) {
  const { colors } = useWingman();
  const start = centerFor(from);
  const end = centerFor(to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const midX = start.x + dx / 2;
  const midY = start.y + dy / 2;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select connector ${edge.label}`}
        onPress={(event: GestureResponderEvent) => {
          event.stopPropagation();
          onSelect(edge.id);
        }}
        style={{
          position: 'absolute',
          left: midX - length / 2,
          top: midY - edgeHitHeight / 2,
          width: length,
          height: edgeHitHeight,
          justifyContent: 'center',
          zIndex: selected ? 2 : 1,
          transform: [{ rotate: `${angle}rad` }],
        }}>
        <View
          style={{
            height: selected ? 5 : 3,
            borderRadius: 999,
            backgroundColor: selected ? color : withAlpha(color, 0.52),
            boxShadow: selected ? `0 0 0 5px ${withAlpha(color, 0.13)}` : 'none',
          }}
        />
      </Pressable>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: end.x - 7,
          top: end.y - 7,
          width: 14,
          height: 14,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: selected ? color : withAlpha(color, 0.7),
          backgroundColor: colors.card,
          zIndex: selected ? 2 : 1,
        }}
      />
    </>
  );
}

function CanvasNode({
  canvasHeight,
  canvasWidth,
  node,
  position,
  selected,
  onMove,
  onSelect,
}: {
  canvasHeight: number;
  canvasWidth: number;
  node: WorkflowNode;
  position: CanvasPoint;
  selected: boolean;
  onMove: (id: BuilderNodeId, position: CanvasPoint) => void;
  onSelect: (id: BuilderNodeId) => void;
}) {
  const { colors, resolvedTheme } = useWingman();
  const latestPositionRef = React.useRef(position);
  const dragStartRef = React.useRef(position);

  React.useEffect(() => {
    latestPositionRef.current = position;
  }, [position]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => {
      dragStartRef.current = latestPositionRef.current;
      onSelect(node.id);
    },
    onPanResponderMove: (_, gesture) => {
      onMove(node.id, clampNodePosition({
        x: dragStartRef.current.x + gesture.dx,
        y: dragStartRef.current.y + gesture.dy,
      }, canvasWidth, canvasHeight));
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 3 && Math.abs(gesture.dy) < 3) {
        onSelect(node.id);
      }
    },
  }), [canvasHeight, canvasWidth, node.id, onMove, onSelect]);

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={`${node.eyebrow} node: ${node.title}`}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: nodeWidth,
        minHeight: nodeHeight,
        zIndex: selected ? 5 : 4,
      }}>
      <View
        style={{
          minHeight: nodeHeight,
          padding: 8,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: selected ? withAlpha(node.color, 0.92) : colors.border,
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          boxShadow: selected
            ? `0 2px 0 ${withAlpha(node.color, 0.18)}, 0 8px 18px ${withAlpha(node.color, 0.14)}`
            : stickerShadow(resolvedTheme),
          borderCurve: 'continuous',
        }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: withAlpha(node.color, 0.45),
            backgroundColor: withAlpha(node.color, 0.15),
            alignItems: 'center',
            justifyContent: 'center',
            borderCurve: 'continuous',
          }}>
          <Text style={{ fontSize: 17 }}>{node.emoji}</Text>
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{
              color: node.color,
              fontFamily: wingmanFonts.text,
              fontSize: 9,
              fontWeight: '900',
              letterSpacing: 0.7,
              textTransform: 'uppercase',
            }}>
            {node.eyebrow}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.ink,
              fontFamily: wingmanFonts.display,
              fontSize: 13,
              fontWeight: '700',
              letterSpacing: 0,
            }}>
            {node.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 9,
              fontWeight: '600',
              lineHeight: 13,
            }}>
            {canvasSubtitleFor(node)}
          </Text>
        </View>

        <View
          style={{
            position: 'absolute',
            right: -6,
            top: nodeHeight / 2 - 6,
            width: 12,
            height: 12,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: node.color,
            backgroundColor: colors.card,
          }}
        />
      </View>
    </View>
  );
}

function WorkflowCanvas({
  canDeleteSelectedNode,
  canvasHeight,
  canvasWidth,
  edges,
  nodes,
  nodePositions,
  selectedEdgeId,
  selectedNodeId,
  onCanvasSizeChange,
  onDeleteSelectedNode,
  onDeleteSelectedEdge,
  onMoveNode,
  onSelectEdge,
  onSelectNode,
}: {
  canDeleteSelectedNode: boolean;
  canvasHeight: number;
  canvasWidth: number;
  edges: WorkflowEdge[];
  nodes: WorkflowNode[];
  nodePositions: NodePositions;
  selectedEdgeId: WorkflowEdgeId | null;
  selectedNodeId: BuilderNodeId;
  onCanvasSizeChange: (size: { width: number; height: number }) => void;
  onDeleteSelectedNode: () => void;
  onDeleteSelectedEdge: () => void;
  onMoveNode: (id: BuilderNodeId, position: CanvasPoint) => void;
  onSelectEdge: (id: WorkflowEdgeId) => void;
  onSelectNode: (id: BuilderNodeId) => void;
}) {
  const { colors } = useWingman();
  const nodeMap = React.useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  return (
    <View
      onLayout={(event) => onCanvasSizeChange({
        width: event.nativeEvent.layout.width,
        height: event.nativeEvent.layout.height,
      })}
      style={{
        flex: 1,
        minHeight: 268,
        borderRadius: wingmanLayout.radiusLg,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.cardAlt,
        overflow: 'hidden',
        borderCurve: 'continuous',
      }}>
      <Pressable
        onPress={() => onSelectNode(selectedNodeId)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 0,
        }}
      />

      {edges.map((edge) => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        const fromPosition = nodePositions[edge.from];
        const toPosition = nodePositions[edge.to];
        if (!fromNode || !toNode || !fromPosition || !toPosition) return null;

        return (
          <CanvasEdge
            key={edge.id}
            color={fromNode.color}
            edge={edge}
            from={fromPosition}
            selected={selectedEdgeId === edge.id}
            to={toPosition}
            onSelect={onSelectEdge}
          />
        );
      })}

      {nodes.map((node) => {
        const position = nodePositions[node.id];
        if (!position) return null;

        return (
          <CanvasNode
            key={node.id}
            canvasHeight={canvasHeight}
            canvasWidth={canvasWidth}
            node={node}
            position={position}
            selected={selectedNodeId === node.id && selectedEdgeId == null}
            onMove={onMoveNode}
            onSelect={onSelectNode}
          />
        );
      })}

      {canDeleteSelectedNode && selectedEdgeId == null && nodePositions[selectedNodeId] ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete selected node"
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            onDeleteSelectedNode();
          }}
          style={({ pressed }) => {
            const selectedPosition = nodePositions[selectedNodeId]!;
            return {
              position: 'absolute',
              left: selectedPosition.x + nodeWidth - 16,
              top: selectedPosition.y - 14,
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: colors.card,
              backgroundColor: colors.coral500,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.78 : 1,
              zIndex: 10,
              boxShadow: `0 4px 12px ${withAlpha(colors.coral500, 0.32)}`,
            };
          }}>
          <IconGlyph name="trash" color="#FFFFFF" size={14} />
        </Pressable>
      ) : null}

      {selectedEdgeId ? (
        <View
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            zIndex: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: colors.card,
              borderWidth: 1.5,
              borderColor: colors.border,
              boxShadow: stickerShadow('light'),
            }}>
            <Text
              style={{
                color: colors.fgMuted,
                fontFamily: wingmanFonts.text,
                fontSize: 11,
                fontWeight: '900',
              }}>
              Line selected
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete selected connector"
            onPress={onDeleteSelectedEdge}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: colors.coral500,
              borderWidth: 1.5,
              borderColor: colors.coral500,
              opacity: pressed ? 0.76 : 1,
            })}>
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: wingmanFonts.text,
                fontSize: 11,
                fontWeight: '900',
              }}>
              Delete line
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function BuilderHeader({
  flow,
  saved,
  onBack,
  onSave,
}: {
  flow: FlowItem;
  saved: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, resolvedTheme } = useWingman();

  return (
    <View
      style={{
        paddingTop: Math.max(insets.top + 14, 18),
        paddingHorizontal: wingmanLayout.screenPadding,
        paddingBottom: 8,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.72 : 1,
          })}>
          <IconGlyph name="chevron-left" color={colors.ink} size={19} />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: flow.color,
              fontFamily: wingmanFonts.text,
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
            Edit flow
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.ink,
              fontFamily: wingmanFonts.display,
              fontSize: 23,
              fontWeight: '700',
              lineHeight: 26,
              letterSpacing: 0,
            }}>
            {flow.title}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Workflow saved' : 'Save workflow'}
          onPress={onSave}
          style={({ pressed }) => ({
            minHeight: 36,
            paddingHorizontal: 13,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: saved ? colors.mint500 : colors.sky700,
            backgroundColor: saved ? colors.mint500 : colors.sky500,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            opacity: pressed ? 0.76 : 1,
            boxShadow: saved ? stickerShadow(resolvedTheme) : skyShadow(),
          })}>
          <IconGlyph name="checkmark" color="#FFFFFF" size={14} />
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: wingmanFonts.text,
              fontSize: 12,
              fontWeight: '900',
            }}>
            {saved ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function NodeToolbar({
  createNode,
}: {
  createNode: (kind: CreateNodeKind) => void;
}) {
  const { colors } = useWingman();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {createNodeOptions.map((option) => (
        <Pressable
          key={option.kind}
          accessibilityRole="button"
          accessibilityLabel={`Create ${option.label} node`}
          onPress={() => createNode(option.kind)}
          style={({ pressed }) => ({
            minHeight: 34,
            paddingHorizontal: 8,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.sky100 : colors.card,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            borderCurve: 'continuous',
          })}>
          <Text style={{ fontSize: 12 }}>{option.emoji}</Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.ink,
              fontFamily: wingmanFonts.text,
              fontSize: 10,
              fontWeight: '900',
            }}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SelectionInspector({
  enabledConnectionCount,
  flow,
  nodes,
  selectedEdge,
  selectedNode,
  onDeleteSelectedEdge,
}: {
  enabledConnectionCount: number;
  flow: FlowItem;
  nodes: WorkflowNode[];
  selectedEdge: WorkflowEdge | undefined;
  selectedNode: WorkflowNode;
  onDeleteSelectedEdge: () => void;
}) {
  const { colors } = useWingman();

  if (selectedEdge) {
    const fromTitle = nodes.find((node) => node.id === selectedEdge.from)?.title ?? selectedEdge.from;
    const toTitle = nodes.find((node) => node.id === selectedEdge.to)?.title ?? selectedEdge.to;

    return (
      <View
        style={{
          minHeight: 60,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          borderCurve: 'continuous',
        }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            backgroundColor: withAlpha(flow.color, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <IconGlyph name="flows" color={flow.color} size={18} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: colors.fgMuted,
              fontFamily: wingmanFonts.text,
              fontSize: 9,
              fontWeight: '900',
              letterSpacing: 0.7,
              textTransform: 'uppercase',
            }}>
            Selected line
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.ink,
              fontFamily: wingmanFonts.display,
              fontSize: 14,
              fontWeight: '700',
              lineHeight: 18,
              letterSpacing: 0,
            }}>
            {fromTitle} → {toTitle}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.fgSecondary,
              fontFamily: wingmanFonts.text,
              fontSize: 10,
              fontWeight: '700',
            }}>
            Tap the canvas or delete this connector.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete selected connector"
          onPress={onDeleteSelectedEdge}
          style={({ pressed }) => ({
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: colors.coral500,
            opacity: pressed ? 0.72 : 1,
          })}>
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: wingmanFonts.text,
              fontSize: 10,
              fontWeight: '900',
            }}>
            Delete line
          </Text>
        </Pressable>
      </View>
    );
  }

  const input = selectedNode.id === 'context'
    ? `${enabledConnectionCount} connections`
    : selectedNode.detail;
  const output = selectedNode.id === 'delivery' ? 'Logs activity' : 'Passes result forward';

  return (
    <View
      style={{
        minHeight: 62,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.card,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        borderCurve: 'continuous',
      }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          backgroundColor: withAlpha(selectedNode.color, 0.14),
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontSize: 17 }}>{selectedNode.emoji}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: colors.fgMuted,
            fontFamily: wingmanFonts.text,
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 0.7,
            textTransform: 'uppercase',
          }}>
          Selected node
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.ink,
            fontFamily: wingmanFonts.display,
            fontSize: 14,
            fontWeight: '700',
            lineHeight: 18,
            letterSpacing: 0,
          }}>
          {selectedNode.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.fgSecondary,
            fontFamily: wingmanFonts.text,
            fontSize: 10,
            fontWeight: '700',
          }}>
          {canvasSubtitleFor(selectedNode)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: 112 }}>
        <Text
          numberOfLines={1}
          style={{
            color: selectedNode.color,
            fontFamily: wingmanFonts.text,
            fontSize: 9,
            fontWeight: '900',
          }}>
          {input}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.fgMuted,
            fontFamily: wingmanFonts.text,
            fontSize: 9,
            fontWeight: '800',
          }}>
          {output}
        </Text>
      </View>
    </View>
  );
}

function PipChatDock({
  bottomInset,
  draftPrompt,
  onChangeDraft,
  onSendPrompt,
}: {
  bottomInset: number;
  draftPrompt: string;
  onChangeDraft: (value: string) => void;
  onSendPrompt: (prompt: string) => void;
}) {
  const { colors, resolvedTheme } = useWingman();

  return (
    <View
      style={{
        paddingHorizontal: wingmanLayout.screenPadding,
        paddingTop: 8,
        paddingBottom: Math.max(bottomInset, 10),
        borderTopWidth: 1.5,
        borderTopColor: colors.border,
        backgroundColor: colors.card,
        gap: 7,
        boxShadow: resolvedTheme === 'dark'
          ? '0 -10px 24px rgba(0, 0, 0, 0.25)'
          : '0 -10px 24px rgba(27, 34, 64, 0.10)',
      }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 7, paddingRight: 4 }}>
        {promptChips.map((prompt) => (
          <Pressable
            key={prompt}
            onPress={() => onSendPrompt(prompt)}
            style={({ pressed }) => ({
              paddingHorizontal: 9,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.sky100 : colors.cardAlt,
              borderCurve: 'continuous',
            })}>
            <Text
              style={{
                color: colors.ink,
                fontFamily: wingmanFonts.text,
                fontSize: 10,
                fontWeight: '800',
              }}>
              {prompt}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View
        style={{
          minHeight: 44,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 8,
          paddingRight: 6,
          borderCurve: 'continuous',
          boxShadow: stickerShadow(resolvedTheme),
        }}>
        <PipCircle variant="coding" size={28} />
        <TextInput
          value={draftPrompt}
          onChangeText={onChangeDraft}
          placeholder="Tell Pip what to change..."
          placeholderTextColor={colors.fgMuted}
          onSubmitEditing={() => onSendPrompt(draftPrompt)}
          style={{
            flex: 1,
            color: colors.ink,
            fontFamily: wingmanFonts.text,
            fontSize: 12,
            fontWeight: '700',
            minHeight: 40,
          }}
        />
        <Pressable
          onPress={() => onSendPrompt(draftPrompt)}
          accessibilityRole="button"
          accessibilityLabel="Send workflow prompt"
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.sky500,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.72 : 1,
          })}>
          <IconGlyph name="arrow-up" color="#FFFFFF" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

export function FlowBuilderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { flowId } = useLocalSearchParams<{ flowId?: string }>();
  const { apps, colors, flows } = useWingman();
  const [selectedNodeId, setSelectedNodeId] = React.useState<BuilderNodeId>('trigger');
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<WorkflowEdgeId | null>(null);
  const [canvasSize, setCanvasSize] = React.useState({ width: 360, height: defaultCanvasHeight });
  const [nodes, setNodes] = React.useState<WorkflowNode[]>([]);
  const [nodePositions, setNodePositions] = React.useState<NodePositions>(() => (
    defaultNodePositionsFor(360, defaultCanvasHeight)
  ));
  const [edges, setEdges] = React.useState<WorkflowEdge[]>(workflowEdges);
  const [enabledConnectionIds, setEnabledConnectionIds] = React.useState<string[]>([]);
  const [, setMessages] = React.useState<BuilderMessage[]>([]);
  const [draftPrompt, setDraftPrompt] = React.useState('');
  const [saved, setSaved] = React.useState(false);

  const flow = React.useMemo(() => {
    return flows.find((item) => item.id === flowId) ?? flows[0] ?? fallbackFlow;
  }, [flowId, flows]);

  const initialNodes = React.useMemo(() => workflowNodesFor(flow, colors), [colors, flow]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? initialNodes[0]!;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const canDeleteSelectedNode = selectedEdgeId == null
    && nodes.length > 1
    && nodes.some((node) => node.id === selectedNodeId);

  const availableConnections = React.useMemo(() => {
    const sourceApps = apps.length > 0 ? apps : appLibrary;
    const byId = new Map(sourceApps.map((app) => [app.id, app]));
    const wantedIds = new Set([
      ...defaultConnectionIdsFor(flow),
      ...sourceApps.filter((app) => app.connected).map((app) => app.id),
    ]);

    const composio: AppIntegration = {
      id: 'composio',
      name: 'Composio',
      category: 'Tool router',
      emoji: '🔌',
      color: colors.lav500,
      connected: true,
    };

    return [...wantedIds]
      .map((id) => (id === 'composio' ? composio : byId.get(id) ?? appLibrary.find((app) => app.id === id)))
      .filter((connection): connection is AppIntegration => Boolean(connection))
      .slice(0, 7);
  }, [apps, colors.lav500, flow]);

  const defaultEnabledConnectionIds = React.useMemo(() => {
    return availableConnections
      .filter((connection) => connection.connected || defaultConnectionIdsFor(flow).includes(connection.id))
      .map((connection) => connection.id);
  }, [availableConnections, flow]);

  React.useEffect(() => {
    setSelectedNodeId('trigger');
    setSelectedEdgeId(null);
    setNodes(initialNodes);
    setNodePositions(defaultNodePositionsFor(canvasSize.width, canvasSize.height));
    setEdges(workflowEdges);
    setEnabledConnectionIds(defaultEnabledConnectionIds);
    setMessages([
      {
        id: `pip-${flow.id}`,
        from: 'pip',
        text: `I can build ${flow.title.toLowerCase()} from a plain-English prompt, then wire the apps and nodes here.`,
      },
    ]);
    setDraftPrompt('');
    setSaved(false);
  }, [canvasSize.height, canvasSize.width, defaultEnabledConnectionIds, flow.id, flow.title, initialNodes]);

  const handleCanvasSizeChange = React.useCallback((size: { width: number; height: number }) => {
    setCanvasSize((currentSize) => {
      const nextSize = {
        width: Math.round(size.width),
        height: Math.round(size.height),
      };
      return Math.abs(currentSize.width - nextSize.width) > 2
        || Math.abs(currentSize.height - nextSize.height) > 2
        ? nextSize
        : currentSize;
    });
  }, []);

  const handleSelectNode = React.useCallback((id: BuilderNodeId) => {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }, []);

  const handleMoveNode = React.useCallback((id: BuilderNodeId, position: CanvasPoint) => {
    setSaved(false);
    setSelectedEdgeId(null);
    setSelectedNodeId(id);
    setNodePositions((currentPositions) => ({
      ...currentPositions,
      [id]: position,
    }));
  }, []);

  const handleSelectEdge = React.useCallback((id: WorkflowEdgeId) => {
    void Haptics.selectionAsync();
    setSelectedEdgeId(id);
  }, []);

  const deleteSelectedEdge = React.useCallback(() => {
    if (!selectedEdgeId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    setSaved(false);
  }, [selectedEdgeId]);

  const createNode = React.useCallback((kind: CreateNodeKind) => {
    const timestamp = Date.now();
    const nextId = `${kind}-${timestamp}`;
    const sourceNodeId = selectedEdgeId ? null : selectedNodeId;
    const count = nodes.filter((node) => node.kind === kind).length + 1;
    const node = {
      id: nextId,
      ...createNodeForKind(kind, count, colors),
    };
    const nextPosition = clampNodePosition({
      x: canvasPadding + ((nodes.length * 38) % Math.max(1, canvasSize.width - nodeWidth - canvasPadding * 2)),
      y: 54 + ((nodes.length * 52) % Math.max(1, canvasSize.height - nodeHeight - 70)),
    }, canvasSize.width, canvasSize.height);

    void Haptics.selectionAsync();
    setNodes((currentNodes) => [...currentNodes, node]);
    setNodePositions((currentPositions) => ({
      ...currentPositions,
      [nextId]: nextPosition,
    }));
    setEdges((currentEdges) => (
      sourceNodeId && nodes.some((currentNode) => currentNode.id === sourceNodeId)
        ? [
            ...currentEdges,
            {
              id: `${sourceNodeId}-${nextId}`,
              from: sourceNodeId,
              to: nextId,
              label: kind,
            },
          ]
        : currentEdges
    ));
    setSelectedNodeId(nextId);
    setSelectedEdgeId(null);
    setSaved(false);
  }, [canvasSize.height, canvasSize.width, colors, nodes, selectedEdgeId, selectedNodeId]);

  const deleteSelectedNode = React.useCallback(() => {
    if (selectedEdgeId || nodes.length <= 1) return;

    const nodeIdToDelete = selectedNodeId;
    const remainingNodes = nodes.filter((node) => node.id !== nodeIdToDelete);
    if (remainingNodes.length === nodes.length) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNodes(remainingNodes);
    setNodePositions((currentPositions) => {
      const nextPositions = { ...currentPositions };
      delete nextPositions[nodeIdToDelete];
      return nextPositions;
    });
    setEdges((currentEdges) => currentEdges.filter(
      (edge) => edge.from !== nodeIdToDelete && edge.to !== nodeIdToDelete,
    ));
    setSelectedNodeId(remainingNodes[0]?.id ?? 'trigger');
    setSelectedEdgeId(null);
    setSaved(false);
  }, [nodes, selectedEdgeId, selectedNodeId]);

  const sendPrompt = React.useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    await Haptics.selectionAsync();
    setSaved(false);
    setDraftPrompt('');

    const normalized = trimmed.toLowerCase();
    const connectionHints = [
      ['slack', 'slack'],
      ['calendar', 'calendar'],
      ['gmail', 'gmail'],
      ['email', 'gmail'],
      ['github', 'github'],
      ['notion', 'notion'],
    ] as const;

    setEnabledConnectionIds((currentIds) => {
      const nextIds = new Set(currentIds);
      connectionHints.forEach(([keyword, id]) => {
        if (normalized.includes(keyword)) nextIds.add(id);
      });
      return [...nextIds];
    });

    setMessages((currentMessages) => [
      ...currentMessages,
      { id: `user-${Date.now()}`, from: 'user', text: trimmed },
      {
        id: `pip-${Date.now()}`,
        from: 'pip',
        text: replyForPrompt(trimmed, flow, selectedNode),
      },
    ]);
  }, [flow, selectedNode]);

  const markSaved = React.useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BuilderHeader
        flow={flow}
        saved={saved}
        onBack={() => router.back()}
        onSave={() => void markSaved()}
      />

      <View
        style={{
          flex: 1,
          minHeight: 0,
          paddingHorizontal: wingmanLayout.screenPadding,
          paddingBottom: 8,
          gap: 7,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <WingmanLabel color={flow.color}>Canvas</WingmanLabel>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              color: colors.fgMuted,
              fontFamily: wingmanFonts.text,
              fontSize: 10,
              fontWeight: '800',
            }}>
            Drag nodes · tap lines
          </Text>
        </View>

        <NodeToolbar
          createNode={createNode}
        />

        <View style={{ flex: 1, minHeight: 0 }}>
          <WorkflowCanvas
            canDeleteSelectedNode={canDeleteSelectedNode}
            canvasHeight={canvasSize.height}
            canvasWidth={canvasSize.width}
            edges={edges}
            nodes={nodes}
            nodePositions={nodePositions}
            selectedEdgeId={selectedEdgeId}
            selectedNodeId={selectedNodeId}
            onCanvasSizeChange={handleCanvasSizeChange}
            onDeleteSelectedNode={deleteSelectedNode}
            onDeleteSelectedEdge={deleteSelectedEdge}
            onMoveNode={handleMoveNode}
            onSelectEdge={handleSelectEdge}
            onSelectNode={handleSelectNode}
          />
        </View>

        <SelectionInspector
          enabledConnectionCount={enabledConnectionIds.length}
          flow={flow}
          nodes={nodes}
          selectedEdge={selectedEdge}
          selectedNode={selectedNode}
          onDeleteSelectedEdge={deleteSelectedEdge}
        />
      </View>

      <PipChatDock
        bottomInset={insets.bottom}
        draftPrompt={draftPrompt}
        onChangeDraft={setDraftPrompt}
        onSendPrompt={(prompt) => {
          void sendPrompt(prompt);
        }}
      />
    </View>
  );
}
