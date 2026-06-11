import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
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
import type { ExtendedNodeSpecJSON } from '@/components/contextMenus/NodePicker.js';
import {
  addFloatingTab,
  findTabInLayout,
  removeTabFromLayout
} from '@/components/layoutController/utils.js';

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
      sys.pubsub.publish('edge:added', newEdge);
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

    // Close the nodepicker panel from rc-dock
    const currentLayout = sys.tabStore.getState().layout;
    const newLayout = removeTabFromLayout(currentLayout, 'nodepicker');
    sys.tabStore.getState().setLayout(newLayout);
  }, [sys]);

  const handleAddNode = useCallback(
    (spec: ExtendedNodeSpecJSON, position: XYPosition) => {
      closeNodePicker();
      const newNode = {
        id: uuidv4(),
        type: spec.nodeType ?? 'behaveNode',
        position,
        data: {
          configuration: {},
          type: spec.type,
          ports: {}
        }
      };

      sys.undoManager.execute({
        name: `Add node (${spec.type})`,
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
            spec.type,
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
    (e: MouseEvent, _connectionState: ConnectionStatus) => {
      const element = e.target as HTMLElement;
      if (element.classList.contains('react-flow__pane')) {
        const screenPos = { x: e.clientX, y: e.clientY };
        setNodePickerVisibility(screenPos);

        // Store screen position for NodePickerPanel to use
        sys.refStore.getState().setRef('nodePickerPosition', screenPos);

        // Open as floating rc-dock panel
        const currentLayout = sys.tabStore.getState().layout;

        // Close existing nodepicker if open
        const existingPanel = findTabInLayout(currentLayout, 'nodepicker');
        let layoutToUse = currentLayout;
        if (existingPanel) {
          layoutToUse = removeTabFromLayout(currentLayout, 'nodepicker');
        }

        // Create new floating panel with minimal tab data
        // The actual content will be loaded by tabLoader
        const tabData = {
          id: 'nodepicker',
          group: 'headless'
        };

        const newLayout = addFloatingTab(layoutToUse, tabData, {
          left: e.clientX,
          top: e.clientY,
          width: 600,
          height: 500
        });

        sys.tabStore.getState().setLayout(newLayout);
      } else {
        setLastConnectStart(undefined);
      }
    },
    [sys]
  );

  const handlePaneClick = useCallback(
    () => closeNodePicker(),
    [closeNodePicker]
  );

  const handlePaneContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      const screenPos = { x: e.clientX, y: e.clientY };
      setNodePickerVisibility(screenPos);

      // Store screen position for NodePickerPanel to use
      sys.refStore.getState().setRef('nodePickerPosition', screenPos);

      // Open as floating rc-dock panel
      const currentLayout = sys.tabStore.getState().layout;

      // Close existing nodepicker if open
      const existingPanel = findTabInLayout(currentLayout, 'nodepicker');
      let layoutToUse = currentLayout;
      if (existingPanel) {
        layoutToUse = removeTabFromLayout(currentLayout, 'nodepicker');
      }

      // Create new floating panel with minimal tab data
      // The actual content will be loaded by tabLoader
      const tabData = {
        id: 'nodepicker',
        group: 'headless'
      };

      const newLayout = addFloatingTab(layoutToUse, tabData, {
        left: e.clientX,
        top: e.clientY,
        width: 600,
        height: 500
      });

      sys.tabStore.getState().setLayout(newLayout);
    },
    [sys]
  );

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
