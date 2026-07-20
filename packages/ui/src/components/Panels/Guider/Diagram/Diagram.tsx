import '@xyflow/react/dist/style.css';

import { useConfiguration } from '@gql/configs/Configuration';
import type { WfsType } from '@gql/configs/gen/graphql';
import type { GuideProbe } from '@gql/server/gen/graphql';
import {
  Background,
  BaseEdge,
  BezierEdge,
  Controls,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  MarkerType,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { useEffect, useMemo } from 'react';

import { useThemeValue } from '@/components/atoms/theme';

import { useGetGuideState } from './useGetGuideState';

const initialNodes: Node[] = [
  {
    id: 'tiptilt',
    data: { label: 'Tip/Tilt' },
    position: { x: 0, y: 100 },
    className: 'active', // "active", "idle", "inactive"
  },
  {
    id: 'focus',
    data: { label: 'Focus' },
    position: { x: 100, y: 100 },
    className: 'active',
    type: 'output',
  },
  {
    id: 'coma',
    data: { label: 'Coma' },
    position: { x: 200, y: 100 },
    className: 'active',
    type: 'output',
  },
  {
    id: 'higho',
    data: { label: 'High O' },
    position: { x: 300, y: 100 },
    className: 'active',
    type: 'output',
  },
  {
    id: 'mount',
    data: { label: 'Mount' },
    position: { x: 0, y: 200 },
    className: 'active',
    type: 'output',
  },
];

const initialEdges: Edge[] = [
  {
    id: 'tiptilt-mount',
    source: 'tiptilt',
    target: 'mount',
    animated: true,
    className: 'active',
  },
];

const edgeTypes = {
  selfconnecting: SelfConnecting,
} satisfies EdgeTypes;

const WFS_LIST: string[] = ['OIWFS', 'PWFS1', 'PWFS2'] satisfies WfsType[];

function Flow() {
  const { setNodes, setEdges, fitView } = useReactFlow();
  const theme = useThemeValue();
  const state = useGetGuideState();
  const configuration = useConfiguration().data?.configuration;

  const [sourceNodes, sourceEdges] = useMemo<[Node[], Edge[]]>(() => {
    function isSourceActive(source: string | undefined | null): boolean {
      switch (source) {
        case 'OIWFS':
          return state.oiIntegrating ?? false;
        case 'PWFS1':
          return state.p1Integrating ?? false;
        case 'PWFS2':
          return state.p2Integrating ?? false;
        default:
          return false;
      }
    }

    // Get active sources first
    const sourceNodes: Node[] = [];
    const sourceEdges: Edge[] = [];

    const probeSource = guideProbeName(state.probeGuide?.from);
    const probeTarget = guideProbeName(state.probeGuide?.to);
    if (probeSource && probeTarget) {
      sourceEdges.push({
        id: 'edge-self',
        source: probeSource,
        target: probeTarget,
        type: 'selfconnecting',
        className: 'inactive',
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }

    function changeSourceState(source: string | undefined | null, state: boolean) {
      const node = sourceNodes.find((s) => s.id === source);
      if (!node) return;
      node.className = state ? 'active' : 'inactive';
    }

    // Create missing source nodes depending on the configuration
    if (configuration?.selectedOiTarget) {
      sourceNodes.push({
        id: 'OIWFS',
        data: { label: 'OIWFS' },
        position: { x: sourceNodes.length * 100, y: 0 },
        className: 'inactive',
        type: probeTarget === 'OIWFS' ? 'default' : 'input',
      });
    }

    if (configuration?.selectedP1Target) {
      sourceNodes.push({
        id: 'PWFS1',
        data: { label: 'PWFS1' },
        position: { x: sourceNodes.length * 100, y: 0 },
        className: 'inactive',
        type: probeTarget === 'PWFS1' ? 'default' : 'input',
      });
    }

    if (configuration?.selectedP2Target) {
      sourceNodes.push({
        id: 'PWFS2',
        data: { label: 'PWFS2' },
        position: { x: sourceNodes.length * 100, y: 0 },
        className: 'inactive',
        type: probeTarget === 'PWFS2' ? 'default' : 'input',
      });
    }

    // Create node if not present
    const wfsFromDevices = state.m2TipTiltSource.split(',');
    if (
      state.m2FocusSource &&
      WFS_LIST.includes(state.m2FocusSource) &&
      !wfsFromDevices.includes(state.m2FocusSource)
    ) {
      wfsFromDevices.push(state.m2FocusSource);
    }
    if (
      state.m2ComaM1CorrectionsSource &&
      WFS_LIST.includes(state.m2ComaM1CorrectionsSource) &&
      !wfsFromDevices.includes(state.m2ComaM1CorrectionsSource)
    ) {
      wfsFromDevices.push(state.m2ComaM1CorrectionsSource);
    }

    for (const source of wfsFromDevices) {
      if (!sourceNodes.some((n) => n.id === source) && WFS_LIST.includes(source)) {
        sourceNodes.push({
          id: source,
          data: { label: source },
          position: { x: sourceNodes.length * 100, y: 0 },
          className: 'inactive',
          type: 'input',
        });
      }
    }

    // Change state of source depending on the configuration
    for (const source of WFS_LIST) {
      const isActive = isSourceActive(source);
      changeSourceState(source, isActive);
    }

    if (state.m2TipTiltEnable && state.m2TipTiltSource) {
      state.m2TipTiltSource.split(',').forEach((source: string) => {
        const isActive = isSourceActive(source);
        sourceEdges.push({
          id: `${source}-tiptilt`,
          source: source,
          target: 'tiptilt',
          animated: isActive,
          className: isActive ? 'active' : 'inactive',
        });
      });
    }

    if (state.m2TipTiltFocusLink) {
      sourceNodes.forEach((n) => {
        const isActive = isSourceActive(n.id);
        sourceEdges.push({
          id: `${n.id}-focus`,
          source: n.id,
          target: 'focus',
          animated: isActive,
          className: isActive ? 'active' : 'inactive',
        });
      });
    } else {
      if (state.m2FocusEnable && state.m2FocusSource) {
        state.m2FocusSource.split(',').forEach((s) => {
          const isActive = isSourceActive(s);
          sourceEdges.push({
            id: `${s}-focus`,
            source: s,
            target: 'focus',
            animated: isActive,
            className: isActive ? 'active' : 'inactive',
          });
        });
      }
    }

    if (state.m2ComaEnable) {
      const pos = sourceNodes.findIndex((n) => n.id === state.m2ComaM1CorrectionsSource);
      const isActive = isSourceActive(state.m2ComaM1CorrectionsSource);
      if (pos !== -1 && pos !== sourceNodes.length - 1) {
        sourceNodes.splice(sourceNodes.length - 1, 0, sourceNodes.splice(pos, 1)[0]!);
      }
      sourceEdges.push({
        id: `${state.m2ComaM1CorrectionsSource ?? ''}-coma`,
        source: state.m2ComaM1CorrectionsSource ?? '',
        target: 'coma',
        animated: isActive,
        className: isActive ? 'active' : 'inactive',
      });
    }

    if (state.m1CorrectionsEnable) {
      const pos = sourceNodes.findIndex((n) => n.id === state.m2ComaM1CorrectionsSource);
      const isActive = isSourceActive(state.m2ComaM1CorrectionsSource);
      if (pos !== -1 && pos !== sourceNodes.length - 1) {
        sourceNodes.splice(sourceNodes.length - 1, 0, sourceNodes.splice(pos, 1)[0]!);
      }
      sourceEdges.push({
        id: `${state.m2ComaM1CorrectionsSource ?? ''}-higho`,
        source: state.m2ComaM1CorrectionsSource ?? '',
        target: 'higho',
        animated: isActive,
        className: isActive ? 'active' : 'inactive',
      });
    }

    // Check static boxes state
    // active: Enabled and receiving input
    // idle: Enabled and waiting for input
    // inacive: Disabled

    // Tip/Tilt
    let tiptiltState: string;
    if (state.m2TipTiltEnable) {
      // Check if any source is active
      const tipTiltActive = sourceEdges.some((n) => n.target === 'tiptilt' && isSourceActive(n.source));
      if (sourceEdges.find((n) => n.target === 'tiptilt')) {
        if (tipTiltActive) {
          tiptiltState = 'active';
        } else {
          tiptiltState = 'idle';
        }
      } else {
        tiptiltState = 'idle';
      }
    } else {
      tiptiltState = 'inactive';
    }
    initialNodes.find((n) => n.id === 'tiptilt')!.className = tiptiltState;

    // Mount
    let mountState: string;
    if (state.mountOffload) {
      if (tiptiltState === 'active') {
        mountState = 'active';
      } else {
        mountState = 'idle';
      }
    } else {
      mountState = 'inactive';
    }
    initialNodes.find((n) => n.id === 'mount')!.className = mountState;
    initialEdges.find((n) => n.id === 'tiptilt-mount')!.className = mountState;

    // Focus
    let focusState: string;
    if (state.m2FocusEnable) {
      // Check if any source is active
      const focusActive = sourceEdges.some((n) => n.target === 'focus' && isSourceActive(n.source));
      if (sourceEdges.find((n) => n.target === 'focus')) {
        if (focusActive) {
          focusState = 'active';
        } else {
          focusState = 'idle';
        }
      } else {
        focusState = 'idle';
      }
    } else {
      focusState = 'inactive';
    }
    initialNodes.find((n) => n.id === 'focus')!.className = focusState;

    // Coma
    let comaState: string;
    if (state.m2ComaEnable) {
      // Check if any source is active
      const comaActive = sourceEdges.some((n) => n.target === 'coma' && isSourceActive(n.source));
      if (sourceEdges.find((n) => n.target === 'coma')) {
        if (comaActive) {
          comaState = 'active';
        } else {
          comaState = 'idle';
        }
      } else {
        comaState = 'idle';
      }
    } else {
      comaState = 'inactive';
    }
    initialNodes.find((n) => n.id === 'coma')!.className = comaState;

    // High-O
    let highoState: string;
    if (state.m1CorrectionsEnable) {
      // Check if any source is active
      const highoActive = sourceEdges.some((n) => n.target === 'higho' && isSourceActive(n.source));
      if (sourceEdges.find((n) => n.target === 'higho')) {
        if (highoActive) {
          highoState = 'active';
        } else {
          highoState = 'idle';
        }
      } else {
        highoState = 'idle';
      }
    } else {
      highoState = 'inactive';
    }
    initialNodes.find((n) => n.id === 'higho')!.className = highoState;

    // Check probe tracking

    const sourceN = sourceNodes.length;
    if (sourceN) {
      sourceNodes.forEach((n, i) => (n.position.x = i * 100));
    }

    return [
      [...sourceNodes, ...initialNodes],
      [...sourceEdges, ...initialEdges],
    ];
  }, [state, configuration]);

  useEffect(() => {
    setNodes(sourceNodes);
    setEdges(sourceEdges);

    const timeout = setTimeout(() => void fitView({ padding: '30px', duration: 1000 }), 20);

    return () => clearTimeout(timeout);
  }, [sourceNodes, sourceEdges, setNodes, setEdges, fitView]);

  return (
    <div className="diagram">
      <ReactFlow
        edgeTypes={edgeTypes}
        defaultNodes={initialNodes}
        defaultEdges={initialEdges}
        proOptions={{ hideAttribution: true }}
        colorMode={theme}
        fitViewOptions={{ padding: '30px' }}
        fitView
      >
        <Background />
        <Controls showZoom={false} showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}

export default function Diagram() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}

// ref: https://reactflow.dev/examples/edges/custom-edges
function SelfConnecting(props: EdgeProps) {
  // we are using the default bezier edge when source and target ids are different
  if (props.source !== props.target) {
    return <BezierEdge {...props} />;
  }

  const { targetX, targetY, markerEnd } = props;
  const radiusX = 20;
  const radiusY = 10;
  const edgePath = `M ${targetX + 6} ${targetY} A ${radiusX} ${radiusY} 0 1 0 ${targetX} ${targetY}`;

  return <BaseEdge path={edgePath} markerEnd={markerEnd} />;
}

function guideProbeName(probe: GuideProbe | null | undefined) {
  switch (probe) {
    case 'GMOS_OIWFS':
    case 'FLAMINGOS2_OIWFS':
      return 'OIWFS';

    default:
      return probe;
  }
}
