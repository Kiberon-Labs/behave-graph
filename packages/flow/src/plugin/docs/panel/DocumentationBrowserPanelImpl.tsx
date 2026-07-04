import { useMemo, useCallback, type ComponentType } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useSystem } from '@/system/provider';
import { Markdown } from 'tiptap-markdown';
import { useStore } from 'zustand';
import type { ExtendedNodeSpecJSON } from '@/components/contextMenus/NodePicker';
import { useOnPressKey } from '@/hooks/useOnPressKey';
import { removeTabFromLayout } from '@/components/layoutController/utils';
import styles from './styles.module.css';

/** One named socket (name + value type) rendered in a documentation section. */
interface DocSocket {
  name: string;
  valueType: string;
}

interface SocketSectionProps {
  title: string;
  sockets: DocSocket[] | undefined;
  getIconForType: (valueType: string) => ComponentType;
  getColorForType: (valueType: string) => string;
}

/**
 * A titled list of node sockets (Inputs / Outputs / Configuration). Renders
 * nothing when the socket list is empty so callers can drop it in
 * unconditionally.
 */
function SocketSection({
  title,
  sockets,
  getIconForType,
  getColorForType
}: SocketSectionProps) {
  if (!sockets || sockets.length === 0) return null;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.socketList}>
        {sockets.map((socket, index) => {
          const IconComponent = getIconForType(socket.valueType);
          const color = getColorForType(socket.valueType);
          return (
            <div key={index} className={styles.socketItem}>
              <div className={styles.socketIcon} style={{ color }}>
                <IconComponent />
              </div>
              <div className={styles.socketName}>{socket.name}</div>
              <div className={styles.socketType} style={{ color }}>
                {socket.valueType}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
    (valueType: string): ComponentType => {
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
            <SocketSection
              title="Inputs"
              sockets={nodeSpec.inputs}
              getIconForType={getIconForType}
              getColorForType={getColorForType}
            />
            <SocketSection
              title="Outputs"
              sockets={nodeSpec.outputs}
              getIconForType={getIconForType}
              getColorForType={getColorForType}
            />
            <SocketSection
              title="Configuration"
              sockets={nodeSpec.configuration}
              getIconForType={getIconForType}
              getColorForType={getColorForType}
            />
          </>
        )}
      </div>
    </div>
  );
}
