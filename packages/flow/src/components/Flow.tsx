import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Background,
  BackgroundVariant,
  type Edge as ReactFlowEdge,
  MiniMap,
  ReactFlow,
  type Node as ReactFlowNode,
  type ReactFlowInstance
} from 'reactflow';

import { useBehaveGraphFlow } from '../hooks/useBehaveGraphFlow.js';
import { useFlowHandlers } from '../hooks/useFlowHandlers.js';
import { useWasdPan } from '../hooks/useWasdPan.js';
import { useSystem } from '@/system/provider.js';
import { useStore } from 'zustand';
import {
  NodeContextMenu,
  type INodeContextMenuProps
} from './contextMenus/node.js';
import {
  EdgeContextMenu,
  type IEdgeContextMenuProps
} from './contextMenus/edge.js';
import {
  SelectionContextMenu,
  type ISelectionContextMenuProps
} from './contextMenus/selection.js';
import { registerDefaultSocketGenerators } from '@/generators/registerDefaultGenerators';
import { FloatingToolbar } from './FloatingToolbar';
import { layerId } from '@/annotations';

const REACTFLOW_NODE = 'react-flow__node';

const getAnnotatedLayerId = (node: ReactFlowNode): string | undefined => {
  if (!node.data || typeof node.data !== 'object') return undefined;
  const record = node.data as { annotations?: Record<string, unknown> };
  const value = record.annotations?.[layerId];
  return typeof value === 'string' ? value : undefined;
};

const isNodeVisibleInLayers = (
  node: ReactFlowNode,
  params: {
    layers: Record<string, { visible: boolean }>;
    nodeLayers: Record<string, string>;
    defaultLayerId: string;
  }
): boolean => {
  const mappedLayerId =
    params.nodeLayers[node.id] ??
    getAnnotatedLayerId(node) ??
    params.defaultLayerId;
  const layer =
    params.layers[mappedLayerId] ?? params.layers[params.defaultLayerId];
  return layer?.visible !== false;
};

export const Flow: React.FC = () => {
  const system = useSystem();
  const getGraphJson = useStore(system.flowStore, (x) => x.getGraph);
  const specJson = useStore(system.specStore, (x) => x.specs);
  const showGrid = useStore(system.systemSettings, (x) => x.showGrid);
  const showMinimap = useStore(system.systemSettings, (x) => x.showMinimap);
  const snapToGrid = useStore(system.systemSettings, (x) => x.snapGrid);
  const gridSize = useStore(system.systemSettings, (x) => x.gridSize);
  const edgeTypes = useStore(system.flowStore, (x) => x.edgeTypes);
  const nodeTypes = useStore(system.flowStore, (x) => x.nodeTypes);
  const layers = useStore(system.layerStore, (x) => x.layers);
  const nodeLayers = useStore(system.layerStore, (x) => x.nodeLayers);
  const defaultLayerId = useStore(system.layerStore, (x) => x.defaultLayerId);

  const ref = useRef<HTMLDivElement>(null);
  const setRef = useStore(system.refStore, (x) => x.setRef);

  const getReactFlowInstance = useCallback(
    () => system.refStore.getState().getRef('reactflow'),
    [system.refStore]
  );

  useWasdPan({ getReactFlowInstance });

  // Set reactflow ref
  const setReactflowRef = React.useCallback(
    (reactFlowInstance: ReactFlowInstance) => {
      if (reactFlowInstance) {
        setRef('reactflow', reactFlowInstance);
      }
    },
    [setRef]
  );

  const graph = useMemo(() => getGraphJson(), []);

  useEffect(() => {
    const cleanupGenerators = registerDefaultSocketGenerators(system);

    return () => {
      cleanupGenerators();
    };
  }, [system]);

  const { nodes, edges, onNodesChange, onEdgesChange } = useBehaveGraphFlow({
    initialGraphJson: graph,
    specJson
  });

  const {
    onConnect,
    handleStartConnect,
    handleStopConnect,
    handlePaneClick,
    handlePaneContextMenu
  } = useFlowHandlers({
    nodes,
    onEdgesChange,
    onNodesChange,
    specJSON: specJson
  });

  const [menu, setMenu] = useState<INodeContextMenuProps | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<IEdgeContextMenuProps | null>(null);
  const [selectionMenu, setSelectionMenu] =
    useState<ISelectionContextMenuProps | null>(null);
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent<Element, MouseEvent>) => {
      // Prevent native context menu from showing
      event.preventDefault();
      setEdgeMenu(null);
      setSelectionMenu(null);
      const offset = ref.current?.getBoundingClientRect();
      //Keep ascending till we find the .react-flow__node
      let target = event.target as HTMLElement | null;
      let nodeID = null;
      while (target && !target.classList.contains(REACTFLOW_NODE)) {
        target = target.parentElement;
      }
      if (target) {
        nodeID = target.getAttribute('data-id');
      }
      setMenu({
        //We should be safe here as reactflow only triggers this on nodes
        nodeID: nodeID!,
        top: event.clientY - (offset?.top ?? 0),
        left: event.clientX - (offset?.left ?? 0)
      });
    },
    [setMenu, setEdgeMenu]
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: any) => {
      event.preventDefault();
      event.stopPropagation();
      setMenu(null);
      setSelectionMenu(null);
      const offset = ref.current?.getBoundingClientRect();
      setEdgeMenu({
        edgeID: edge.id,
        sourceID: edge.source,
        targetID: edge.target,
        top: event.clientY - (offset?.top ?? 0),
        left: event.clientX - (offset?.left ?? 0)
      });
    },
    [setEdgeMenu, setMenu]
  );

  const onSelectionContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setMenu(null);
      setEdgeMenu(null);
      const offset = ref.current?.getBoundingClientRect();
      setSelectionMenu({
        top: event.clientY - (offset?.top ?? 0),
        left: event.clientX - (offset?.left ?? 0)
      });
    },
    [setMenu, setEdgeMenu, setSelectionMenu]
  );

  const snapGrid = useMemo(() => {
    return [gridSize, gridSize] as [number, number];
  }, [gridSize]);

  const onPaneClick = useCallback(() => {
    setMenu(null);
    setEdgeMenu(null);
    setSelectionMenu(null);
    handlePaneClick();
  }, [setMenu, setEdgeMenu, setSelectionMenu, handlePaneClick]);

  const renderedNodes = useMemo(() => {
    return nodes.map((node) => {
      const mappedLayerId =
        nodeLayers[node.id] ?? getAnnotatedLayerId(node) ?? defaultLayerId;
      const layer = layers[mappedLayerId] ?? layers[defaultLayerId];
      if (!layer) return node;

      return {
        ...node,
        hidden: !layer.visible,
        style: {
          ...(node.style ?? {}),
          opacity: layer.opacity
        }
      };
    });
  }, [defaultLayerId, layers, nodeLayers, nodes]);

  const renderedEdges = useMemo(() => {
    const nodesById = new Map<string, ReactFlowNode>();
    nodes.forEach((node) => {
      nodesById.set(node.id, node);
    });

    return edges.map((edge: ReactFlowEdge) => {
      const sourceNode = nodesById.get(edge.source);
      const targetNode = nodesById.get(edge.target);

      // If either endpoint is missing just leave the edge as-is
      if (!sourceNode || !targetNode) return edge;

      const sourceVisible = isNodeVisibleInLayers(sourceNode, {
        layers,
        nodeLayers,
        defaultLayerId
      });
      const targetVisible = isNodeVisibleInLayers(targetNode, {
        layers,
        nodeLayers,
        defaultLayerId
      });

      const shouldHide = !sourceVisible || !targetVisible;

      // Return as hidden when an endpoint node is in a hidden layer.
      // Using `hidden` rather than filtering so ReactFlow still tracks the
      // connection and handles continue to render as connected.
      if (shouldHide === edge.hidden) return edge;
      return { ...edge, hidden: shouldHide };
    });
  }, [defaultLayerId, edges, layers, nodeLayers, nodes]);

  return (
    <>
      <ReactFlow
        style={{ flex: 1 }}
        ref={ref}
        onInit={setReactflowRef}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        elevateEdgesOnSelect={true}
        nodes={renderedNodes}
        edges={renderedEdges}
        onSelectionContextMenu={onSelectionContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        // @ts-ignore
        onEdgeContextMenu={onEdgeContextMenu}
        maxZoom={Infinity}
        minZoom={-Infinity}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        // @ts-ignore
        onConnectStart={handleStartConnect}
        // @ts-ignore
        onConnectEnd={handleStopConnect}
        snapToGrid={snapToGrid}
        snapGrid={snapGrid}
        fitView
        //TODO. Reconsier this prop for performance
        onlyRenderVisibleElements={true}
        onPaneClick={onPaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        proOptions={{ hideAttribution: true }}
      >
        {showGrid && (
          <Background
            variant={BackgroundVariant.Lines}
            gap={90}
            color="#373737"
            style={{ backgroundColor: 'var(--colors-bgCanvas)' }}
          />
        )}
        {showMinimap && <MiniMap />}
        {menu && <NodeContextMenu {...menu} />}
        {edgeMenu && <EdgeContextMenu {...edgeMenu} />}
        {selectionMenu && <SelectionContextMenu {...selectionMenu} />}
        <FloatingToolbar />
      </ReactFlow>
    </>
  );
};
