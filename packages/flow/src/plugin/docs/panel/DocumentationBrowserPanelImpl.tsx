import { useMemo, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useSystem } from '@/system/provider';
import { Markdown } from 'tiptap-markdown';
import { useStore } from 'zustand';
import type { ExtendedNodeSpecJSON } from '@/components/contextMenus/NodePicker';
import { useOnPressKey } from '@/hooks/useOnPressKey';
import { removeTabFromLayout } from '@/components/layoutController/utils';
import styles from './styles.module.css';

export function DocumentationBrowserPanelImpl() {
  const sys = useSystem();
  const selectedNodeType = useStore(
    sys.refStore,
    (x) => x.refs.selectedDocumentationType
  );
  const documentation = useStore(sys.documentationStore, (x) => x.docs);
  const specs = useStore(sys.specStore, (x) => x.specs);
  const icons = useStore(sys.legendStore, (x) => x.icons);
  const defaultIcon = useStore(sys.legendStore, (x) => x.defaultIcon);
  const valueTypeColors = useStore(sys.legendStore, (x) => x.valueTypeColors);

  const nodeSpec = useMemo((): ExtendedNodeSpecJSON | null => {
    if (!selectedNodeType) return null;
    return specs.find((s) => s.type === selectedNodeType) ?? null;
  }, [selectedNodeType, specs]);

  const getIconForType = useCallback(
    (valueType: string) => {
      const IconComponent = icons[valueType] || defaultIcon;
      return IconComponent;
    },
    [icons, defaultIcon]
  );

  const getColorForType = useCallback(
    (valueType: string) => {
      return valueTypeColors[valueType] || '#6c727e';
    },
    [valueTypeColors]
  );

  const nodeDoc = useMemo(() => {
    if (!selectedNodeType) return null;
    return documentation.get(selectedNodeType);
  }, [selectedNodeType, documentation]);

  const editor = useEditor(
    {
      extensions: [StarterKit, Markdown],
      content: nodeDoc?.markdownDescription || '',
      editable: false
    },
    [nodeDoc?.markdownDescription]
  );

  const closePanel = useCallback(() => {
    const currentLayout = sys.tabStore.getState().layout;
    const newLayout = removeTabFromLayout(currentLayout, 'docbrowser');
    sys.tabStore.getState().setLayout(newLayout);
  }, [sys]);

  useOnPressKey('Escape', closePanel);

  if (!selectedNodeType) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📚</div>
          <div className={styles.emptyText}>No documentation selected</div>
          <div className={styles.emptySub}>
            Click the info icon on a node to view its documentation
          </div>
        </div>
      </div>
    );
  }

  const hasMarkdown = nodeDoc?.markdownDescription;
  const hasShortDescription =
    nodeDoc?.shortDescription || nodeSpec?.description;
  const hasTags = nodeDoc?.tags && nodeDoc.tags.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          {nodeDoc?.icon && (
            <div className={styles.iconLarge}>{nodeDoc.icon}</div>
          )}
          <div>
            <h2 className={styles.title}>
              {nodeSpec?.label || selectedNodeType}
            </h2>
            <div className={styles.nodeType}>{selectedNodeType}</div>
          </div>
        </div>
        {hasTags && nodeDoc?.tags && (
          <div className={styles.tags}>
            {nodeDoc.tags.map((tag, index) => (
              <span key={index} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.content}>
        {hasShortDescription && (
          <div className={styles.description}>
            {nodeDoc?.shortDescription || nodeSpec?.description}
          </div>
        )}

        {hasMarkdown && nodeDoc?.markdownDescription ? (
          <EditorContent editor={editor} />
        ) : (
          <div className={styles.noContent}>
            <p>No detailed documentation available for this node.</p>
          </div>
        )}

        {nodeSpec && (
          <>
            {nodeSpec.inputs && nodeSpec.inputs.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Inputs</h3>
                <div className={styles.socketList}>
                  {nodeSpec.inputs.map((input, index) => {
                    const IconComponent = getIconForType(input.valueType);
                    const color = getColorForType(input.valueType);
                    return (
                      <div key={index} className={styles.socketItem}>
                        <div className={styles.socketIcon} style={{ color }}>
                          <IconComponent />
                        </div>
                        <div className={styles.socketName}>{input.name}</div>
                        <div className={styles.socketType} style={{ color }}>
                          {input.valueType}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {nodeSpec.outputs && nodeSpec.outputs.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Outputs</h3>
                <div className={styles.socketList}>
                  {nodeSpec.outputs.map((output, index) => {
                    const IconComponent = getIconForType(output.valueType);
                    const color = getColorForType(output.valueType);
                    return (
                      <div key={index} className={styles.socketItem}>
                        <div className={styles.socketIcon} style={{ color }}>
                          <IconComponent />
                        </div>
                        <div className={styles.socketName}>{output.name}</div>
                        <div className={styles.socketType} style={{ color }}>
                          {output.valueType}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {nodeSpec.configuration && nodeSpec.configuration.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Configuration</h3>
                <div className={styles.socketList}>
                  {nodeSpec.configuration.map((config, index) => {
                    const IconComponent = getIconForType(config.valueType);
                    const color = getColorForType(config.valueType);
                    return (
                      <div key={index} className={styles.socketItem}>
                        <div className={styles.socketIcon} style={{ color }}>
                          <IconComponent />
                        </div>
                        <div className={styles.socketName}>{config.name}</div>
                        <div className={styles.socketType} style={{ color }}>
                          {config.valueType}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
