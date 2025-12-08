import type { NodeSpecJSON } from '@kinforge/behave-graph';
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useState
} from 'react';
import type {
  Connection,
  ConnectionStatus,
  Node,
  OnConnectStartParams,
  XYPosition
} from 'reactflow';
import { v4 as uuidv4 } from 'uuid';

import { calculateNewEdge } from '../util/calculateNewEdge.js';
import { getNodePickerFilters } from '../util/getPickerFilters.js';
import { useBehaveGraphFlow } from './useBehaveGraphFlow.js';
import { useSystem } from '@/system/provider.js';
import type { AnyNode, CommentNode, IBehaveNode } from '@/types.js';

type BehaveGraphFlow = ReturnType<typeof useBehaveGraphFlow>;

const useNodePickFilters = ({
  nodes,
  lastConnectStart,
  specJSON
}: {
  nodes: Node[];
  lastConnectStart: OnConnectStartParams | undefined;
  specJSON: NodeSpecJSON[] | undefined;
}) => {
  const [nodePickFilters, setNodePickFilters] = useState(
    getNodePickerFilters(nodes, lastConnectStart, specJSON)
  );

  useEffect(() => {
    setNodePickFilters(getNodePickerFilters(nodes, lastConnectStart, specJSON));
  }, [nodes, lastConnectStart, specJSON]);

  return nodePickFilters;
};

export const useFlowHandlers = ({
  onEdgesChange,
  onNodesChange,
  nodes,
  specJSON
}: Pick<BehaveGraphFlow, 'onEdgesChange' | 'onNodesChange'> & {
  nodes: Node[];
  specJSON: NodeSpecJSON[] | undefined;
}) => {
  const sys = useSystem();
  const [lastConnectStart, setLastConnectStart] =
    useState<OnConnectStartParams>();
  const [nodePickerVisibility, setNodePickerVisibility] =
    useState<XYPosition>();

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === null) return;
      if (connection.target === null) return;

      const newEdge = {
        id: uuidv4(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle
      };
      console.log('onConnect', newEdge);
      sys.pubsub.publish('newEdge', newEdge);
      onEdgesChange([
        {
          type: 'add',
          item: newEdge
        }
      ]);
    },
    [onEdgesChange]
  );

  const closeNodePicker = useCallback(() => {
    setLastConnectStart(undefined);
    setNodePickerVisibility(undefined);
  }, []);

  const handleAddNode = useCallback(
    (nodeType: string, position: XYPosition) => {
      closeNodePicker();
      const newNode: IBehaveNode = {
        id: uuidv4(),
        type: 'behaveNode',
        position,
        data: {
          configuration: {},
          type: nodeType,
          ports: {}
        }
      };

      sys.undoManager.execute({
        execute: () => {
          sys.nodeStore.getState().addNode(newNode);
        },
        undo: () => {
          sys.nodeStore
            .getState()
            .setNodes((existing) =>
              existing.filter((n) => n.id !== newNode.id)
            );
        }
      });

      if (lastConnectStart === undefined) return;

      // add an edge if we started on a socket
      const originNode = nodes.find(
        (node) => node.id === lastConnectStart.nodeId
      );
      if (originNode === undefined) return;
      if (!specJSON) return;
      onEdgesChange([
        {
          type: 'add',
          item: calculateNewEdge(
            originNode,
            nodeType,
            newNode.id,
            lastConnectStart,
            specJSON
          )
        }
      ]);
    },
    [
      closeNodePicker,
      lastConnectStart,
      nodes,
      onEdgesChange,
      onNodesChange,
      specJSON
    ]
  );

  const handleStartConnect = useCallback(
    (e: ReactMouseEvent, params: OnConnectStartParams) => {
      setLastConnectStart(params);
    },
    []
  );

  const handleStopConnect = useCallback(
    (e: MouseEvent, connectionState: ConnectionStatus) => {
      const element = e.target as HTMLElement;
      if (element.classList.contains('react-flow__pane')) {
        setNodePickerVisibility({ x: e.clientX, y: e.clientY });
      } else {
        setLastConnectStart(undefined);
      }
    },
    []
  );

  const handlePaneClick = useCallback(
    () => closeNodePicker(),
    [closeNodePicker]
  );

  const handlePaneContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setNodePickerVisibility({ x: e.clientX, y: e.clientY });
  }, []);

  const nodePickFilters = useNodePickFilters({
    nodes,
    lastConnectStart,
    specJSON
  });

  return {
    onConnect,
    handleStartConnect,
    handleStopConnect,
    handlePaneClick,
    handlePaneContextMenu,
    lastConnectStart,
    nodePickerVisibility,
    handleAddNode,
    closeNodePicker,
    nodePickFilters
  };
};
