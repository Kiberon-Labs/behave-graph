import React, { useState, useEffect } from 'react';
import { VscodeDivider, VscodeTextarea } from '@vscode-elements/react-elements';
import { description } from '@/annotations';
import type { IBehaveNode } from '@/types/nodes.js';
import styles from './index.module.css';

interface NodeSettingsProps {
  selectedNode: IBehaveNode;
  onSave: (annotationKey: string, value: string) => void;
}

export const NodeSettings: React.FC<NodeSettingsProps> = ({
  selectedNode,
  onSave
}) => {
  const annotations = selectedNode.data?.annotations;
  const currentDescription = annotations?.[description] ?? '';
  const [descriptionDraft, setDescriptionDraft] = useState(currentDescription);

  useEffect(() => {
    setDescriptionDraft(currentDescription);
  }, [currentDescription]);

  const handleSaveDescription = (rawDescription: string) => {
    onSave(description, rawDescription);
  };

  return (
    <div className={styles.stackGap2}>
      <div className={styles.stackGap2Padded}>
        <div className={styles.settingsRow}>
          <div>Type</div>
          <div>{selectedNode.data.type}</div>
        </div>
        <div className={styles.settingsRow}>
          <div>ID</div>
          <div>{selectedNode.id}</div>
        </div>

        <VscodeDivider />

        <div className={styles.descriptionSection}>
          <div className={styles.descriptionTitle}>Description</div>
          <VscodeTextarea
            placeholder="No description provided."
            className={styles.descriptionTextarea}
            value={descriptionDraft}
            onInput={(e: any) => setDescriptionDraft(e?.target?.value ?? '')}
            onBlur={() => {
              handleSaveDescription(descriptionDraft);
            }}
            onKeyDown={(e: any) => {
              if (e?.key === 'Escape') {
                e?.preventDefault?.();
                setDescriptionDraft('');
              }
            }}
            rows={4}
          />
        </div>

        <VscodeDivider />

        <div className={styles.annotationsSection}>
          <div className={styles.annotationsTitle}>Annotations</div>
          {annotations == null ? (
            <div className={styles.annotationsEmpty}>No annotations.</div>
          ) : typeof annotations === 'string' ||
            typeof annotations === 'number' ||
            typeof annotations === 'boolean' ? (
            <div className={styles.annotationsValue}>{String(annotations)}</div>
          ) : Array.isArray(annotations) &&
            annotations.every(
              (x) => typeof x === 'string' || typeof x === 'number'
            ) ? (
            <ul className={styles.annotationsList}>
              {annotations.map((x, i) => (
                <li key={i} className={styles.annotationsListItem}>
                  {String(x)}
                </li>
              ))}
            </ul>
          ) : (
            <pre className={styles.annotationsPre}>
              {JSON.stringify(annotations, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
