import React, { useCallback, useMemo } from 'react';
import { useActiveGraph, GraphProvider } from '@/system/provider';
import {
  VscodeTabHeader,
  VscodeTabPanel,
  VscodeTabs,
  VscodeToolbarContainer
} from '@vscode-elements/react-elements';
import { useStore } from 'zustand';
import {
  findTabInLayout,
  removeTabFromLayout,
  addFloatingTab
} from '@/components/layoutController/utils';

import styles from './index.module.css';
import { BasePanel } from '../base';
import { NodeTitleEditor } from './NodeTitleEditor';
import { MultipleNodesView } from './MultipleNodesView';
import { SocketGenerators } from './SocketGenerators';
import { InputsGroup } from './InputsGroup';
import { OutputsGroup } from './OutputsGroup';
import { NodeSettings } from './NodeSettings';
import { useNodeInputsData } from './useNodeInputsData';
import { useNodeHandlers } from './useNodeHandlers';
import { EyeClosed, EyeSolid } from 'iconoir-react';
import { Icon } from '@/components/primitives/icon';

export function NodeInputsPanel() {
  const system = useActiveGraph()!;
  const documentation = useStore(system.editor.documentationStore, (x) => x.docs);

  const {
    allSpecsJson,
    selectedNodes,
    selectedNode,
    nodeSpec,
    inputsWithControls,
    outputsWithInfo,
    matchingGenerators,
    generatorNode,
    controls,
    defaultControl
  } = useNodeInputsData(system);

  const { handleSaveTitle, handleValueChange } = useNodeHandlers(
    system,
    selectedNode
  );

  const hiddenInputs = useMemo(() => {
    return selectedNode?.data.annotations?.hiddenInputs ?? {};
  }, [selectedNode]);

  const hiddenOutputs = useMemo(() => {
    return selectedNode?.data.annotations?.hiddenOutputs ?? {};
  }, [selectedNode]);

  const handleToggleInput = useCallback(
    (inputName: string) => {
      if (!selectedNode) return;

      const currentHidden = hiddenInputs[inputName] ?? false;
      const newHiddenInputs = {
        ...hiddenInputs,
        [inputName]: !currentHidden
      };

      system.nodeStore.getState().setNodes((prev) =>
        prev.map((n) =>
          n.id === selectedNode.id
            ? {
                ...n,
                data: {
                  ...(n as any).data,
                  annotations: {
                    ...(n as any).data.annotations,
                    hiddenInputs: newHiddenInputs
                  }
                }
              }
            : n
        )
      );
    },
    [selectedNode, hiddenInputs, system]
  );

  const handleToggleOutput = useCallback(
    (outputName: string) => {
      if (!selectedNode) return;

      const currentHidden = hiddenOutputs[outputName] ?? false;
      const newHiddenOutputs = {
        ...hiddenOutputs,
        [outputName]: !currentHidden
      };

      system.nodeStore.getState().setNodes((prev) =>
        prev.map((n) =>
          n.id === selectedNode.id
            ? {
                ...n,
                data: {
                  ...(n as any).data,
                  annotations: {
                    ...(n as any).data.annotations,
                    hiddenOutputs: newHiddenOutputs
                  }
                }
              }
            : n
        )
      );
    },
    [selectedNode, hiddenOutputs, system]
  );

  const handleToggleAllInputs = useCallback(() => {
    if (!selectedNode) return;

    const allHidden = inputsWithControls.every(
      (input) => hiddenInputs[input.name]
    );
    const newHiddenInputs: Record<string, boolean> = {};

    inputsWithControls.forEach((input) => {
      newHiddenInputs[input.name] = !allHidden;
    });

    system.nodeStore.getState().setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...(n as any).data,
                annotations: {
                  ...(n as any).data.annotations,
                  hiddenInputs: newHiddenInputs
                }
              }
            }
          : n
      )
    );
  }, [selectedNode, inputsWithControls, hiddenInputs, system]);

  const handleToggleAllOutputs = useCallback(() => {
    if (!selectedNode) return;

    const allHidden = outputsWithInfo.every(
      (output) => hiddenOutputs[output.name]
    );
    const newHiddenOutputs: Record<string, boolean> = {};

    outputsWithInfo.forEach((output) => {
      newHiddenOutputs[output.name] = !allHidden;
    });

    system.nodeStore.getState().setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...(n as any).data,
                annotations: {
                  ...(n as any).data.annotations,
                  hiddenOutputs: newHiddenOutputs
                }
              }
            }
          : n
      )
    );
  }, [selectedNode, outputsWithInfo, hiddenOutputs, system]);

  const handleShowDocumentation = useCallback(
    (nodeType: string) => {
      // Set the selected documentation type
      system.refStore.getState().setRef('selectedDocumentationType', nodeType);

      // Open documentation browser panel
      const currentLayout = system.editor.tabStore.getState().layout;

      // Close existing doc browser if open
      const existingPanel = findTabInLayout(currentLayout, 'docbrowser');
      let layoutToUse = currentLayout;
      if (existingPanel) {
        layoutToUse = removeTabFromLayout(currentLayout, 'docbrowser');
      }

      // Create new floating panel
      const tabData = {
        id: 'docbrowser'
      };

      const newLayout = addFloatingTab(layoutToUse, tabData, {
        left: 100,
        top: 100,
        width: 600,
        height: 700
      });

      system.editor.tabStore.getState().setLayout(newLayout);
    },
    [system]
  );

  const hasDocumentation = useCallback(
    (nodeType: string) => {
      const doc = documentation?.get(nodeType);
      return !!(doc?.markdownDescription || doc?.shortDescription);
    },
    [documentation]
  );

  const getNodeIcon = useCallback(
    (nodeType: string) => {
      const doc = documentation?.get(nodeType);
      return doc?.icon;
    },
    [documentation]
  );

  // Handle multiple node selection
  if (selectedNodes.length > 1) {
    return (
      <MultipleNodesView
        selectedNodes={selectedNodes}
        allSpecsJson={allSpecsJson}
      />
    );
  }

  if (!selectedNode || !nodeSpec) {
    return (
      <BasePanel>
        <div className={styles.emptyState}>
          No node selected. Select a node to edit its inputs.
        </div>
      </BasePanel>
    );
  }

  return (
    <BasePanel>
      <NodeTitleEditor
        selectedNode={selectedNode}
        nodeLabel={nodeSpec?.label ?? ''}
        onSave={handleSaveTitle}
        nodeType={selectedNode.data.type}
        nodeIcon={getNodeIcon(selectedNode.data.type)}
        hasDocumentation={hasDocumentation(selectedNode.data.type)}
        onShowDocumentation={handleShowDocumentation}
      />

      <VscodeToolbarContainer className={styles.toolbar}>
        <VscodeTabs className={styles.tabs}>
          <VscodeTabHeader>Properties</VscodeTabHeader>
          <VscodeTabPanel>
            {inputsWithControls.length > 0 && (
              <div className={styles.panelHeader}>
                <span className={styles.panelHeaderLabel}>Inputs</span>
                <Icon
                  onClick={handleToggleAllInputs}
                  title="Toggle all input visibility"
                >
                  {inputsWithControls.every(
                    (input) => hiddenInputs[input.name]
                  ) ? (
                    <EyeSolid />
                  ) : (
                    <EyeClosed />
                  )}
                </Icon>
              </div>
            )}

            {generatorNode && (
              // Generators read per-graph state via useGraph(); bind them to the
              // active session since this panel lives outside the graph tab.
              <GraphProvider value={system}>
                <SocketGenerators
                  generators={matchingGenerators}
                  generatorNode={generatorNode}
                />
              </GraphProvider>
            )}
            {inputsWithControls.length === 0 &&
              matchingGenerators.length === 0 && (
                <div className={styles.noInputs}>
                  This node has no editable inputs.
                </div>
              )}
            <InputsGroup
              inputs={inputsWithControls}
              controls={controls}
              defaultControl={defaultControl}
              onValueChange={handleValueChange}
              hiddenInputs={hiddenInputs}
              onToggleInput={handleToggleInput}
            />
          </VscodeTabPanel>
          <VscodeTabHeader>Outputs</VscodeTabHeader>
          <VscodeTabPanel>
            {outputsWithInfo.length > 0 && (
              <div className={styles.panelHeader}>
                <span className={styles.panelHeaderLabel}>Outputs</span>
                <Icon
                  onClick={handleToggleAllOutputs}
                  title="Toggle all output visibility"
                >
                  {outputsWithInfo.every(
                    (output) => hiddenOutputs[output.name]
                  ) ? (
                    <EyeSolid />
                  ) : (
                    <EyeClosed />
                  )}
                </Icon>
              </div>
            )}
            {outputsWithInfo.length === 0 && (
              <div className={styles.noInputs}>This node has no outputs.</div>
            )}
            <OutputsGroup
              outputs={outputsWithInfo}
              hiddenOutputs={hiddenOutputs}
              onToggleOutput={handleToggleOutput}
            />
          </VscodeTabPanel>
          <VscodeTabHeader>Settings</VscodeTabHeader>
          <VscodeTabPanel>
            <NodeSettings
              selectedNode={selectedNode}
              onSave={handleSaveTitle}
            />
          </VscodeTabPanel>
        </VscodeTabs>
      </VscodeToolbarContainer>
    </BasePanel>
  );
}
