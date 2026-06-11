import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { XYPosition } from 'reactflow';

import {
  VscodeBadge,
  VscodeButton,
  VscodeCollapsible,
  VscodeTextfield
} from '@vscode-elements/react-elements';
import { List, ViewGrid, ViewStructureUp, InfoCircle } from 'iconoir-react';

import { useOnPressKey } from '../../hooks/useOnPressKey.js';
import type { NodeDocumentation } from '../../store/documentation.js';
import styles from './NodePicker.module.css';

export type NodePickerFilters = {
  handleType: 'source' | 'target';
  valueType: string;
};

export type NodePickerViewMode = 'list' | 'grid' | 'tree';

export type ExtendedNodeSpecJSON = NodeSpecJSON & {
  nodeType?: string;
  description?: string;
  icon?: React.ReactNode;
  tags?: string[];
  markdownDescription?: string;
};

export type NodePickerProps = {
  position: XYPosition;
  filters?: NodePickerFilters;
  onPickNode: (node: ExtendedNodeSpecJSON, position: XYPosition) => void;
  onClose: () => void;
  specJSON: ExtendedNodeSpecJSON[];
  documentation?: Map<string, NodeDocumentation>;
  onShowDocumentation?: (nodeType: string) => void;
  defaultViewMode?: NodePickerViewMode;
};

function normalizeCategory(category: unknown): string {
  if (typeof category === 'string' && category.trim().length > 0) {
    return category.trim();
  }
  return 'Other';
}

function normalizeLabel(spec: ExtendedNodeSpecJSON): string {
  // Most specs have `label`, but keep it defensive.
  const label = typeof spec.label === 'string' ? spec.label : '';
  return label.trim().length > 0 ? label.trim() : spec.type;
}

export const NodePicker: React.FC<NodePickerProps> = ({
  position,
  onPickNode,
  onClose,
  filters,
  specJSON,
  onShowDocumentation,
  documentation,
  defaultViewMode = 'list'
}: NodePickerProps) => {
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<NodePickerViewMode>(defaultViewMode);

  useOnPressKey('Escape', onClose);

  // Merge documentation with specs
  const enrichedSpecs = useMemo(() => {
    if (!documentation) return specJSON;

    return specJSON.map((spec) => {
      const doc = documentation.get(spec.type);
      if (!doc) return spec;

      return {
        ...spec,
        icon: doc.icon ?? spec.icon,
        description: doc.shortDescription ?? spec.description,
        tags: doc.tags ?? spec.tags,
        markdownDescription: doc.markdownDescription ?? spec.markdownDescription
      };
    });
  }, [specJSON, documentation]);

  useEffect(() => {
    const focusSearch = () => {
      const host = searchContainerRef.current?.querySelector(
        'vscode-textfield'
      ) as HTMLInputElement | null;
      if (!host) return;

      if (typeof host.focus === 'function') {
        host.focus();
      }

      const input = host.shadowRoot?.querySelector('input, textarea') as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      input?.focus();
    };

    const timeoutId = window.setTimeout(focusSearch, 0);
    const rafId = window.requestAnimationFrame(focusSearch);

    return () => {
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const filteredSpecs = useMemo(() => {
    if (!enrichedSpecs) return [];

    let next: ExtendedNodeSpecJSON[] = enrichedSpecs;

    if (filters) {
      next = next.filter((node) => {
        const sockets =
          filters.handleType === 'source' ? node.outputs : node.inputs;
        return sockets.some((socket) => socket.valueType === filters.valueType);
      });
    }

    const term = search.trim().toLowerCase();
    if (term.length > 0) {
      next = next.filter((node) => {
        const label = normalizeLabel(node).toLowerCase();
        const type = node.type.toLowerCase();
        const description = (node.description || '').toLowerCase();
        const tags = node.tags?.map((t) => t.toLowerCase()) || [];

        return (
          label.includes(term) ||
          type.includes(term) ||
          description.includes(term) ||
          tags.some((tag) => tag.includes(term))
        );
      });
    }

    return next;
  }, [filters, search, enrichedSpecs]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const spec of filteredSpecs) {
      set.add(normalizeCategory(spec.category));
    }
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [filteredSpecs]);

  const visibleSpecs = useMemo(() => {
    if (activeCategory === 'All') return filteredSpecs;
    return filteredSpecs.filter(
      (spec) => normalizeCategory(spec.category) === activeCategory
    );
  }, [activeCategory, filteredSpecs]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExtendedNodeSpecJSON[]>();
    for (const spec of visibleSpecs) {
      const cat = normalizeCategory(spec.category);
      const arr = map.get(cat) ?? [];
      arr.push(spec);
      map.set(cat, arr);
    }

    for (const [cat, arr] of map.entries()) {
      arr.sort((a, b) => normalizeLabel(a).localeCompare(normalizeLabel(b)));
      map.set(cat, arr);
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleSpecs]);

  const groupsToRender: Array<[string, ExtendedNodeSpecJSON[]]> =
    useMemo(() => {
      if (activeCategory === 'All') {
        return grouped;
      }
      return [[activeCategory, visibleSpecs]];
    }, [activeCategory, grouped, visibleSpecs]);

  const resultsCount = visibleSpecs.length;

  const pick = useCallback(
    (type: ExtendedNodeSpecJSON) => {
      onPickNode(type, position);
    },
    [onPickNode, position]
  );

  const onPressEnterQuickPick = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (resultsCount < 1) return;

      e.preventDefault();
      pick(visibleSpecs[0]!);
    },
    [pick, resultsCount, visibleSpecs]
  );

  useOnPressKey('Enter', onPressEnterQuickPick);
  useOnPressKey('NumpadEnter', onPressEnterQuickPick);

  if (!specJSON) return null;

  const renderThumb = (spec: ExtendedNodeSpecJSON, size: 'small' | 'large') => {
    if (spec.icon) {
      return <div className={styles.icon}>{spec.icon}</div>;
    }

    const label = normalizeLabel(spec);
    const letter = label.slice(0, 1).toUpperCase();

    return (
      <div
        style={{
          fontSize: size === 'large' ? 18 : 12,
          opacity: 0.85,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {letter}
      </div>
    );
  };

  const renderTags = (spec: ExtendedNodeSpecJSON) => {
    if (!spec.tags || spec.tags.length === 0) return null;
    return (
      <div className={styles.tags}>
        {spec.tags.map((tag, index) => (
          <span key={index} className={styles.tag}>
            {tag}
          </span>
        ))}
      </div>
    );
  };

  const handleShowDocs = useCallback(
    (e: React.MouseEvent, nodeType: string) => {
      e.stopPropagation();
      if (onShowDocumentation) {
        onShowDocumentation(nodeType);
      }
    },
    [onShowDocumentation]
  );

  const hasDocumentation = useCallback(
    (spec: ExtendedNodeSpecJSON) => {
      const doc = documentation?.get(spec.type);
      return !!(
        doc?.markdownDescription ||
        doc?.shortDescription ||
        spec.description
      );
    },
    [documentation]
  );

  return (
    <div className={styles.container} role="dialog" aria-label="Add Node">
      <div className={styles.topbar}>
        <div className={styles.search} ref={searchContainerRef}>
          <VscodeTextfield
            style={{ width: '100%' }}
            type="text"
            placeholder="Search nodes"
            value={search}
            onInput={(e: any) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.viewToggles}>
          <VscodeButton
            iconOnly
            secondary
            title="List view"
            onClick={() => setViewMode('list')}
          >
            <List />
          </VscodeButton>
          <VscodeButton
            iconOnly
            secondary
            title="Grid view"
            onClick={() => setViewMode('grid')}
          >
            <ViewGrid />
          </VscodeButton>
          <VscodeButton
            iconOnly
            secondary
            title="Tree view"
            onClick={() => setViewMode('tree')}
          >
            <ViewStructureUp />
          </VscodeButton>
        </div>
      </div>
      <div className={styles.grid}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarList}>
            {categories.map((cat) => (
              <div
                key={cat}
                className={
                  cat === activeCategory
                    ? `${styles.sidebarItem} ${styles.sidebarItemActive}`
                    : styles.sidebarItem
                }
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.main}>
          <div className={styles.content}>
            {resultsCount === 0 ? (
              <div className={styles.empty}>No nodes match your search.</div>
            ) : viewMode === 'grid' ? (
              <div className={styles.gridView}>
                {visibleSpecs.map((spec) => (
                  <div
                    key={spec.type}
                    className={styles.card}
                    onClick={() => pick(spec)}
                    title={
                      spec.markdownDescription || spec.description || spec.type
                    }
                  >
                    <div className={styles.cardInner}>
                      <div title={spec.type} className={styles.cardThumb}>
                        {renderThumb(spec, 'large')}
                      </div>
                      <div className={styles.nodeText}>
                        <div className={styles.nodeTitle}>
                          {normalizeLabel(spec)}
                        </div>
                        {spec.description ? (
                          <div className={styles.nodeSub}>
                            {spec.description}
                          </div>
                        ) : null}
                        {renderTags(spec)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'tree' ? (
              <div>
                {groupsToRender.map(([cat, specs]) => (
                  <VscodeCollapsible
                    key={cat}
                    title={`${cat} (${specs.length})`}
                    open
                  >
                    <div className={styles.list}>
                      {specs.map((spec) => (
                        <div
                          key={spec.type}
                          title={spec.markdownDescription || spec.type}
                          className={styles.nodeRow}
                          onClick={() => pick(spec)}
                        >
                          <div className={styles.thumb}>
                            {renderThumb(spec, 'small')}
                          </div>
                          <div className={styles.nodeText}>
                            <div className={styles.nodeTitle}>
                              {normalizeLabel(spec)}
                            </div>
                            {spec.description ? (
                              <div className={styles.nodeSub}>
                                {spec.description}
                              </div>
                            ) : null}
                            {renderTags(spec)}
                          </div>
                          {hasDocumentation(spec) && (
                            <button
                              className={styles.infoButton}
                              onClick={(e) => handleShowDocs(e, spec.type)}
                              title="Show documentation"
                            >
                              <InfoCircle />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </VscodeCollapsible>
                ))}
              </div>
            ) : (
              // list view
              <div>
                {groupsToRender.map(([cat, specs]) => (
                  <div key={cat}>
                    {activeCategory === 'All' && (
                      <div className={styles.groupTitle}>{cat}</div>
                    )}

                    <div className={styles.list}>
                      {specs.map((spec) => (
                        <div
                          key={spec.type}
                          title={spec.markdownDescription || spec.type}
                          className={styles.nodeRow}
                          onClick={() => pick(spec)}
                        >
                          <div className={styles.thumb}>
                            {renderThumb(spec, 'small')}
                          </div>
                          <div className={styles.nodeText}>
                            <div className={styles.nodeTitle}>
                              {normalizeLabel(spec)}
                            </div>
                            {spec.description ? (
                              <div className={styles.nodeSub}>
                                {spec.description}
                              </div>
                            ) : null}
                            {renderTags(spec)}
                          </div>
                          {hasDocumentation(spec) && (
                            <button
                              className={styles.infoButton}
                              onClick={(e) => handleShowDocs(e, spec.type)}
                              title="Show documentation"
                            >
                              <InfoCircle />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <div>
              <VscodeBadge>
                {resultsCount} result{resultsCount === 1 ? '' : 's'}
              </VscodeBadge>
            </div>
            <div>Esc to close</div>
          </div>
        </div>
      </div>
    </div>
  );
};
