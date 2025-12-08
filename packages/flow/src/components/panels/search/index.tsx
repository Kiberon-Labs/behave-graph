import { annotatedTitle } from '@/annotations/index.js';
import React from 'react';
import {
  VscodeButton,
  VscodeTextfield,
  VscodeSingleSelect,
  VscodeOption,
  VscodeLabel
} from '@vscode-elements/react-elements';
import { useRefFromStore, useSystem } from '@/system';
import type { Node } from 'reactflow';
import { Search } from 'iconoir-react';
import Fuse from 'fuse.js';

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

  const sys = useSystem();
  const reactflow = useRefFromStore(sys.refStore, 'reactflow');

  // Get available node types from the registry
  const availableNodeTypes = React.useMemo(() => {
    return Object.keys(sys.registry.nodes).sort();
  }, [sys.registry.nodes]);

  const zoomToNode = (nodeId: string) => {
    if (!reactflow) {
      return;
    }

    const node = reactflow.getNodes().find((n: Node) => n.id === nodeId);

    if (node) {
      reactflow.fitView({
        padding: 0.2,
        includeHiddenNodes: true,
        nodes: [node]
      });
    }
  };

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

  return (
    <div className="flex flex-col p-4 gap-2">
      <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>Find Node</span>

      <div className="flex flex-col gap-1">
        <VscodeLabel>Find by ID</VscodeLabel>
        <div className="flex gap-1">
          <VscodeTextfield
            className="w-full"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
          <VscodeButton iconOnly onClick={onClick}>
            <Search />
          </VscodeButton>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <VscodeLabel>Find by Title</VscodeLabel>
        <div className="flex gap-1">
          <VscodeTextfield
            className="w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <VscodeButton iconOnly onClick={onClickTitle}>
            <Search />
          </VscodeButton>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <VscodeLabel>Find by Type</VscodeLabel>

        <VscodeSingleSelect
          className="w-full"
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
        <div className="flex flex-col gap-1 mt-2">
          <VscodeLabel>Results ({searchResults.length})</VscodeLabel>
          <div
            className="flex flex-col gap-1"
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid var(--color-neutral-stroke-subtle)',
              borderRadius: 'var(--component-radii-sm)',
              padding: 'var(--component-spacing-xs)'
            }}
          >
            {searchResults.map((result) => (
              <div
                className="flex gap-1"
                key={result.id}
                onClick={() => zoomToNode(result.id)}
                style={{
                  cursor: 'pointer',
                  border: '1px solid var(--color-neutral-stroke-subtle)',
                  borderRadius: 'var(--component-radii-sm)',
                  backgroundColor: 'var(--vscode-list-hoverBackground)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--vscode-list-activeSelectionBackground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--vscode-list-hoverBackground)';
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.9em' }}>
                  # {result.id} / {result.title}
                </div>
                <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                  Type: {result.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
