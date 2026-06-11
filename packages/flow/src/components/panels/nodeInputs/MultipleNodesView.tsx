import React from 'react';
import { VscodeDivider } from '@vscode-elements/react-elements';
import type { Node } from 'reactflow';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import styles from './index.module.css';

interface MultipleNodesViewProps {
  selectedNodes: Node[];
  allSpecsJson: NodeSpecJSON[];
}

export const MultipleNodesView: React.FC<MultipleNodesViewProps> = ({
  selectedNodes,
  allSpecsJson
}) => {
  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>
        Multiple Nodes Selected ({selectedNodes.length})
      </div>
      <VscodeDivider />
      <div className={styles.listGap1}>
        {selectedNodes.map((node) => {
          const spec = allSpecsJson.find((s) => s.type === node.type);
          return (
            <div key={node.id} className={styles.nodeCard}>
              <div className={styles.nodeCardTitle}>
                {spec?.label || node.type}
              </div>
              <div className={styles.nodeCardMeta}>ID: {node.id}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
