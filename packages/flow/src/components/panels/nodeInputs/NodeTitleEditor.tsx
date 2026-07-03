import React, { useState, useEffect, useCallback } from 'react';
import { VscodeTextfield } from '@vscode-elements/react-elements';
import { InfoCircle } from 'iconoir-react';
import { annotatedTitle } from '@/annotations';
import type { IBehaveNode } from '@/types/nodes.js';
import styles from './index.module.css';

interface NodeTitleEditorProps {
  selectedNode: IBehaveNode;
  nodeLabel: string;
  onSave: (annotationKey: string, value: string) => void;
  nodeType?: string;
  nodeIcon?: React.ReactNode;
  hasDocumentation?: boolean;
  onShowDocumentation?: (nodeType: string) => void;
}

export const NodeTitleEditor: React.FC<NodeTitleEditorProps> = ({
  selectedNode,
  nodeLabel,
  onSave,
  nodeType,
  nodeIcon,
  hasDocumentation,
  onShowDocumentation
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const annotations = (selectedNode as any)?.data?.annotations;

  const annotationTitle = React.useMemo(() => {
    if (
      !annotations ||
      typeof annotations !== 'object' ||
      Array.isArray(annotations)
    )
      return undefined;
    const title = annotations?.[annotatedTitle];
    return typeof title === 'string' ? title : undefined;
  }, [annotations]);

  const displayedTitle = React.useMemo(() => {
    const trimmed = annotationTitle?.trim();
    return trimmed ? trimmed : nodeLabel;
  }, [annotationTitle, nodeLabel]);

  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft('');
  }, [selectedNode.id]);

  const handleSaveTitle = (rawTitle: string) => {
    onSave(annotatedTitle, rawTitle);
    setIsEditingTitle(false);
  };

  const handleShowDocs = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onShowDocumentation && nodeType) {
        onShowDocumentation(nodeType);
      }
    },
    [onShowDocumentation, nodeType]
  );

  if (!isEditingTitle) {
    return (
      <>
        <div className={styles.panelTitleContainer}>
          {nodeIcon && <div className={styles.nodeTitleIcon}>{nodeIcon}</div>}
          <div
            className={styles.panelTitle}
            onDoubleClick={() => {
              setTitleDraft(displayedTitle);
              setIsEditingTitle(true);
            }}
            title="Double-click to rename"
          >
            {displayedTitle}
          </div>
          {hasDocumentation && onShowDocumentation && (
            <button
              className={styles.infoButton}
              onClick={handleShowDocs}
              title="Show documentation"
            >
              <InfoCircle />
            </button>
          )}
        </div>
        <div className={styles.panelId}>#{selectedNode.id}</div>
      </>
    );
  }

  return (
    <>
      <div className={styles.panelTitleEdit}>
        <VscodeTextfield
          className={styles.panelTitleTextfield}
          value={titleDraft}
          onInput={(e: any) => setTitleDraft(e?.target?.value ?? '')}
          onBlur={() => {
            handleSaveTitle(titleDraft);
          }}
          onKeyDown={(e: any) => {
            if (e?.key === 'Enter') {
              e?.preventDefault?.();
              handleSaveTitle(titleDraft);
            }

            if (e?.key === 'Escape') {
              e?.preventDefault?.();
              setIsEditingTitle(false);
              setTitleDraft('');
            }
          }}
        />
      </div>
      <div className={styles.panelId}>{selectedNode.id}</div>
    </>
  );
};
