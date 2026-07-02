import { annotatedTitle } from '@/annotations/index.js';
import React from 'react';
import {
  VscodeButton,
  VscodeTextfield,
  VscodeSingleSelect,
  VscodeOption,
  VscodeLabel,
  VscodeTreeItem,
  VscodeTree,
  VscodeCollapsible,
  VscodeBadge
} from '@vscode-elements/react-elements';
import { useRefFromStore, useActiveGraph } from '@/system';
import type { Node } from 'reactflow';
import { Search } from 'iconoir-react';
import Fuse from 'fuse.js';
import { useStore } from 'zustand';
import { BasePanel } from '../base';
import styles from './index.module.css';
import { Icon } from '@/components/primitives/icon';

type AnnotatedNode = Node & {
  annotations: Record<string, string>;
};

type SearchResult = {
  id: string;
  type: string;
  title?: string;
};

export const SearchPanel = () => {
  const [id, setId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [nodeType, setNodeType] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);

  const sys = useActiveGraph()!;
  const graphNodes = useStore(sys.nodeStore, (s) => s.nodes);
  const reactflow = useRefFromStore(sys.refStore, 'reactflow');

  // Get available node types from the current graph
  const availableNodeTypes = React.useMemo(() => {
    const types = new Set<string>();

    for (const node of graphNodes) {
      const type = node?.data?.type;
      if (typeof type === 'string' && type.length > 0) {
        types.add(type);
      }
    }

    return [...types].sort();
  }, [graphNodes]);

  const onClick = () => {
    if (!reactflow) {
      return;
    }

    const nodes = sys.nodeStore.getState().nodes;
    const graphNodes = Object.values(nodes);

    // Find all nodes matching the ID (partial match)
    const matchingNodes = graphNodes.filter((n) =>
      n.id.toLowerCase().includes(id.toLowerCase())
    );

    const results: SearchResult[] = matchingNodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      title: (n as AnnotatedNode).annotations?.[annotatedTitle]
    }));

    setSearchResults(results);
  };

  const onClickTitle = () => {
    if (!reactflow) {
      return;
    }

    const nodes = sys.nodeStore.getState().nodes;
    const graphNodes = Object.values(nodes);

    // Filter nodes that have titles
    const nodesWithTitles = graphNodes.map((n) => ({
      node: n,
      title: (n as AnnotatedNode).data.type
    }));

    // Use Fuse.js for fuzzy search
    const fuse = new Fuse(nodesWithTitles, {
      keys: ['title'],
      threshold: 0.4, // Lower = more strict, Higher = more fuzzy (0.0 = exact, 1.0 = match anything)
      includeScore: true,
      ignoreLocation: true
    });

    const fuseResults = fuse.search(title);
    const matchingNodes = fuseResults.map((result) => result.item.node);

    const results: SearchResult[] = matchingNodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      title: (n as AnnotatedNode).annotations?.[annotatedTitle]
    }));

    setSearchResults(results);
  };

  const onClickType = () => {
    if (!reactflow || !nodeType) {
      return;
    }

    const nodes = sys.nodeStore.getState().nodes;
    const graphNodes = Object.values(nodes);

    // Find all nodes matching the selected type
    const matchingNodes = graphNodes.filter((n) => n.data.type === nodeType);

    const results: SearchResult[] = matchingNodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      title: (n as AnnotatedNode).annotations?.[annotatedTitle]
    }));

    setSearchResults(results);
  };

  const handleTreeSelect = (ev: unknown) => {
    const detail = (ev as CustomEvent<any>)?.detail;
    const selectedItems = Array.isArray(detail)
      ? detail
      : detail?.selectedItems;
    const firstSelected = selectedItems?.[0] as HTMLElement | undefined;
    const key = firstSelected?.dataset?.varKey;

    if (key) {
      sys.actionStore.getState().actions.focusNode(key);
    }
  };

  return (
    <BasePanel>
      <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Find Node</span>

      <div className={styles.searchGroup}>
        <VscodeLabel>Find by ID</VscodeLabel>
        <div className={styles.searchRow}>
          <VscodeTextfield
            className={styles.fullWidth}
            value={id}
            onChange={(e: any) => setId(e.target.value)}
          />
          <Icon onClick={onClick}>
            <Search />
          </Icon>
        </div>
      </div>

      <div className={styles.searchGroup}>
        <VscodeLabel>Find by Title</VscodeLabel>
        <div className={styles.searchRow}>
          <VscodeTextfield
            className={styles.fullWidth}
            value={title}
            onChange={(e: any) => setTitle(e.target.value)}
          />
          <Icon onClick={onClickTitle}>
            <Search />
          </Icon>
        </div>
      </div>

      <div className={styles.searchGroup}>
        <VscodeLabel>Find by Type</VscodeLabel>

        <VscodeSingleSelect
          className={styles.fullWidth}
          value={nodeType}
          onChange={(e: any) => setNodeType(e.target.value)}
        >
          <VscodeOption value="">Select a type...</VscodeOption>
          {availableNodeTypes.map((type) => (
            <VscodeOption key={type} value={type}>
              {type}
            </VscodeOption>
          ))}
        </VscodeSingleSelect>
        <VscodeButton onClick={onClickType} disabled={!nodeType}>
          Search
        </VscodeButton>
      </div>

      {searchResults.length > 0 && (
        <VscodeCollapsible title="Results" open>
          <VscodeBadge slot="decorations">{searchResults.length}</VscodeBadge>
          <VscodeTree onVscTreeSelect={handleTreeSelect}>
            {searchResults.map((result) => (
              <VscodeTreeItem key={result.id} data-var-key={result.id}>
                <span>
                  # {result.id} / {result.title}
                </span>
                <span slot="description">{result.type}</span>
              </VscodeTreeItem>
            ))}
          </VscodeTree>
        </VscodeCollapsible>
      )}
    </BasePanel>
  );
};
