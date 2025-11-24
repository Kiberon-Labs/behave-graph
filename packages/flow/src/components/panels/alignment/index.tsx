
import type { Node } from 'reactflow';
import {
  AlignHorizontalCenters,
  AlignHorizontalCentersSolid,
  AlignVerticalCenters,
  AlignVerticalCentersSolid,
  CompAlignBottom,
  CompAlignBottomSolid,
  CompAlignLeft,
  CompAlignLeftSolid,
  CompAlignRight,
  CompAlignRightSolid,
  CompAlignTop,
  CompAlignTopSolid,
} from 'iconoir-react';
import { VscodeButton } from '@vscode-elements/react-elements';
import { useSystem } from '@/system/provider';

const partitionSelectedNodes = (nodes: Node[]) => {
  return nodes.reduce(
    (acc, node) => {
      if (node.selected) {
        acc.selectedNodes.push(node);
      } else {
        acc.unselectedNodes.push(node);
      }

      return acc;
    },
    {
      selectedNodes: [] as Node[],
      unselectedNodes: [] as Node[],
    },
  );
};

const handleChange = (graphEditor) => (updater) => {
  const currentFlow = graphEditor?.getFlow();
  if (!currentFlow) return;
  const { selectedNodes, unselectedNodes } = partitionSelectedNodes(
    currentFlow.getNodes(),
  );
  //Assume it changes it directly
  updater(selectedNodes);
  //Make sure unselected nodes are processed first for cases like groups
  currentFlow.setNodes([...unselectedNodes, ...selectedNodes]);
};

export const ALIGNMENT = {
  START: 0,
  CENTER: 1,
  END: 2,
} as const

export type Alignment = typeof ALIGNMENT[keyof typeof ALIGNMENT];

export const align =
  (align: Alignment, prop = 'x') =>
    (selectedNodes) => {
      // Align selected nodes to the left
      let v = 0;
      switch (align) {
        case ALIGNMENT.START:
          v = Math.min(...selectedNodes.map((node) => node.position[prop]));
          break;
        case ALIGNMENT.CENTER: {
          const vmin = Math.min(
            ...selectedNodes.map((node) => node.position[prop]),
          );
          const vmax = Math.max(
            ...selectedNodes.map((node) => node.position[prop]),
          );
          v = (vmin + vmax) / 2;
          break;
        }
        default:
          v = Math.max(...selectedNodes.map((node) => node.position[prop]));
      }
      selectedNodes.forEach((node) => {
        node.position[prop] = v;
      });
    };

export const distribute =
  (align: Alignment, prop = 'x') =>
    (selectedNodes) => {
      if (selectedNodes.length < 3) {
        return;
      }

      //Sort the nodes by position
      selectedNodes = [...selectedNodes].sort(
        (a, b) => a.position[prop] - b.position[prop],
      );

      const getLength = (node) => {
        if (prop === 'x') {
          return node.width;
        }
        return node.height;
      };

      const getPos = (node) => {
        switch (align) {
          case ALIGNMENT.START:
            return node.position[prop];
          case ALIGNMENT.CENTER:
            return node.position[prop] + getLength(node) / 2;
          default:
            return node.position[prop] + getLength(node);
        }
      };

      const startNode = selectedNodes.reduce((acc, node) => {
        return getPos(node) < getPos(acc) ? node : acc;
      }, selectedNodes[0]);

      const endNode = selectedNodes.reduce((acc, node) => {
        return getPos(node) > getPos(acc) ? node : acc;
      }, selectedNodes[0]);

      //Get the total length
      const incrementLength =
        (getPos(endNode) - getPos(startNode)) / (selectedNodes.length - 1);

      selectedNodes.forEach((node, i) => {
        node.position[prop] = startNode.position[prop] + i * incrementLength;
      });
    };

export function AlignmentPanel() {
  const graphEditor = useSystem();
  const updateNodes = handleChange(graphEditor);

  return (
    <div className='flex-col flex-1 h-full w-full p-1'
      style={{
        overflow: 'auto',
      }}
    >
      <div className="flex flex-col">
        <span>Align</span>
        <div className="flex h-full flex-1">
          <VscodeButton
            secondary
            title="Align X Left"
            onClick={() => updateNodes(align(ALIGNMENT.START))}
            icon-only
          >
            <CompAlignLeft />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Align X Center"
            onClick={() => updateNodes(align(ALIGNMENT.CENTER))}
            icon-only
          >
            <AlignHorizontalCenters />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Align X Right"
            onClick={() => updateNodes(align(ALIGNMENT.END))}
            icon-only
          >
            <CompAlignRight />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Align Y Top"
            onClick={() => updateNodes(align(ALIGNMENT.START, 'y'))}
            icon-only
          >
            <CompAlignTop />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Align Y Middle"
            onClick={() => updateNodes(align(ALIGNMENT.CENTER, 'y'))}
            icon-only
          >
            <AlignVerticalCenters />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Align Y Bottom"
            onClick={() => updateNodes(align(ALIGNMENT.END, 'y'))}
            icon-only
          >
            <CompAlignBottom />
          </VscodeButton>
        </div>
        <span >Distribute</span>
        <div className="flex h-full flex-1">
          <VscodeButton
            secondary
            title="Distribute horizontally left"
            icon-only
            onClick={() => updateNodes(distribute(ALIGNMENT.START))}
          >
            <CompAlignLeftSolid />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Distribute horizontally center"
            onClick={() => updateNodes(distribute(ALIGNMENT.CENTER))}
            icon-only
          >
            <AlignHorizontalCentersSolid />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Distribute horizontally right"
            icon-only
            onClick={() => updateNodes(distribute(ALIGNMENT.END))}
          >
            <CompAlignRightSolid />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Distribute vertically top"
            onClick={() => updateNodes(distribute(ALIGNMENT.START, 'y'))}
            icon-only
          >
            <CompAlignTopSolid />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Distribute vertically center"
            onClick={() => updateNodes(distribute(ALIGNMENT.CENTER, 'y'))}
            icon-only
          >
            <AlignVerticalCentersSolid />
          </VscodeButton>
          <VscodeButton
            secondary
            title="Distribute vertically bottom"
            onClick={() => updateNodes(distribute(ALIGNMENT.END, 'y'))}
            icon-only
          >
            <CompAlignBottomSolid />
          </VscodeButton>
        </div >
      </div >
    </div >
  );
}
