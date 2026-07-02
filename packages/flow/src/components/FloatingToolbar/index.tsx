import React, { useCallback, useState, useRef } from 'react';
import { Panel, useViewport } from 'reactflow';
import {
  VscodeButton,
  VscodeContextMenu
} from '@vscode-elements/react-elements';
import { ZoomIn, ZoomOut, AlignLeft, LayoutRight } from 'iconoir-react';
import { useGraph } from '@/system/provider';
import { useStore } from 'zustand';
import styles from './index.module.css';
import { useRefFromStore } from '@/system';
import type { ToolbarButton } from '@/store/toolbar';
import type { AlignmentAxis, AlignmentType } from '@/plugin/alignment';

export const FloatingToolbar: React.FC = () => {
  const session = useGraph();
  const visible = useStore(session.editor.toolbarStore, (x) => x.visible);
  const customGroups = useStore(session.editor.toolbarStore, (x) => x.groups);
  const reactFlowInstance = useRefFromStore(session.refStore, 'reactflow');
  const { zoom } = useViewport();
  const currentZoom = Math.round(zoom * 100);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [distributeMenuOpen, setDistributeMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const alignBtnRef = useRef<any>(null);
  const distributeBtnRef = useRef<any>(null);

  const publishAlignment = useCallback(
    (type: AlignmentType, axis: AlignmentAxis) => {
      session.pubsub.publishSync('alignment:align', { type, axis });
    },
    [session]
  );

  const publishDistribution = useCallback(
    (type: AlignmentType, axis: AlignmentAxis) => {
      session.pubsub.publishSync('alignment:distribute', { type, axis });
    },
    [session]
  );

  const handleZoomIn = useCallback(() => {
    reactFlowInstance?.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance?.zoomOut();
  }, [reactFlowInstance]);

  const handleAlignSelect = useCallback(
    (e: any) => {
      setAlignMenuOpen(false);
      const value = e.detail?.value;
      switch (value) {
        case 'left':
          publishAlignment('start', 'x');
          break;
        case 'center-h':
          publishAlignment('center', 'x');
          break;
        case 'right':
          publishAlignment('end', 'x');
          break;
        case 'top':
          publishAlignment('start', 'y');
          break;
        case 'center-v':
          publishAlignment('center', 'y');
          break;
        case 'bottom':
          publishAlignment('end', 'y');
          break;
      }
    },
    [publishAlignment]
  );

  const handleDistributeSelect = useCallback(
    (e: any) => {
      setDistributeMenuOpen(false);
      const value = e.detail?.value;
      switch (value) {
        case 'left':
          publishDistribution('start', 'x');
          break;
        case 'center-h':
          publishDistribution('center', 'x');
          break;
        case 'right':
          publishDistribution('end', 'x');
          break;
        case 'top':
          publishDistribution('start', 'y');
          break;
        case 'center-v':
          publishDistribution('center', 'y');
          break;
        case 'bottom':
          publishDistribution('end', 'y');
          break;
      }
    },
    [publishDistribution]
  );

  if (!visible) return null;

  return (
    <>
      <Panel position="top-center" className={styles.panel}>
        <div className={styles.toolbar}>
          {/* Zoom Controls */}
          <div className={styles.buttonGroup}>
            <VscodeButton
              secondary
              iconOnly
              title="Zoom In"
              onClick={handleZoomIn}
            >
              <ZoomIn />
            </VscodeButton>
            <span className={styles.zoomLevel}>{currentZoom}%</span>
            <VscodeButton
              secondary
              iconOnly
              title="Zoom Out"
              onClick={handleZoomOut}
            >
              <ZoomOut />
            </VscodeButton>
          </div>

          {/* Align Button */}
          <div className={styles.buttonGroup}>
            <VscodeButton
              ref={alignBtnRef}
              secondary
              iconOnly
              title="Align"
              onClick={() => {
                const rect = alignBtnRef.current?.getBoundingClientRect();
                if (rect) {
                  setMenuPosition({ top: rect.bottom, left: rect.left });
                  setAlignMenuOpen(!alignMenuOpen);
                }
              }}
            >
              <AlignLeft />
            </VscodeButton>
          </div>

          {/* Distribute Button */}
          <div className={styles.buttonGroup}>
            <VscodeButton
              ref={distributeBtnRef}
              secondary
              iconOnly
              title="Distribute"
              onClick={() => {
                const rect = distributeBtnRef.current?.getBoundingClientRect();
                if (rect) {
                  setMenuPosition({ top: rect.bottom, left: rect.left });
                  setDistributeMenuOpen(!distributeMenuOpen);
                }
              }}
            >
              <LayoutRight />
            </VscodeButton>
          </div>

          {/* Custom Groups */}
          {customGroups.map((group) => (
            <div key={group.id} className={styles.buttonGroup}>
              {(Array.isArray(group.buttons) ? group.buttons : []).map(
                (button: ToolbarButton | React.ReactNode, index: number) => {
                  // Support custom ReactNode buttons
                  if (React.isValidElement(button)) {
                    return (
                      <React.Fragment key={index}>{button}</React.Fragment>
                    );
                  }

                  // Standard button definition
                  const typedButton = button as ToolbarButton;
                  const isDisabled =
                    typeof typedButton.disabled === 'function'
                      ? typedButton.disabled()
                      : typedButton.disabled;

                  return (
                    <VscodeButton
                      key={typedButton.id}
                      secondary
                      iconOnly
                      title={typedButton.label}
                      onClick={typedButton.onClick}
                      disabled={isDisabled}
                    >
                      {typedButton.icon}
                    </VscodeButton>
                  );
                }
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Align Context Menu */}
      {alignMenuOpen && (
        <VscodeContextMenu
          show
          onVscContextMenuSelect={handleAlignSelect}
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            zIndex: 2000
          }}
          data={[
            { label: 'Align Left', value: 'left' },
            { label: 'Align Center Horizontal', value: 'center-h' },
            { label: 'Align Right', value: 'right' },
            { separator: true },
            { label: 'Align Top', value: 'top' },
            { label: 'Align Center Vertical', value: 'center-v' },
            { label: 'Align Bottom', value: 'bottom' }
          ]}
        />
      )}

      {/* Distribute Context Menu */}
      {distributeMenuOpen && (
        <VscodeContextMenu
          show
          onVscContextMenuSelect={handleDistributeSelect}
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            zIndex: 2000
          }}
          data={[
            { label: 'Distribute Horizontal Left', value: 'left' },
            { label: 'Distribute Horizontal Center', value: 'center-h' },
            { label: 'Distribute Horizontal Right', value: 'right' },
            { separator: true },
            { label: 'Distribute Vertical Top', value: 'top' },
            { label: 'Distribute Vertical Center', value: 'center-v' },
            { label: 'Distribute Vertical Bottom', value: 'bottom' }
          ]}
        />
      )}
    </>
  );
};
