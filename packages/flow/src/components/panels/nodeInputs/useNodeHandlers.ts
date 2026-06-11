import { useCallback } from 'react';
import type { IBehaveNode } from '@/types/nodes';
import type { System } from '@/system';

export function useNodeHandlers(
  system: System,
  selectedNode: IBehaveNode | null
) {
  const handleSaveTitle = useCallback(
    (annotationKey: string, rawValue: string) => {
      if (!selectedNode) return;

      const trimmed = rawValue.trim();

      const currentAnnotations = (selectedNode as any)?.data
        ?.annotations as unknown;
      const isPlainObject =
        !!currentAnnotations &&
        typeof currentAnnotations === 'object' &&
        !Array.isArray(currentAnnotations);

      const nextAnnotations: Record<string, any> = isPlainObject
        ? { ...(currentAnnotations as any) }
        : {};
      if (!trimmed) {
        delete nextAnnotations[annotationKey];
      } else {
        nextAnnotations[annotationKey] = trimmed;
      }

      const updatedNode = {
        ...selectedNode,
        data: {
          ...selectedNode.data,
          annotations: nextAnnotations
        }
      };

      system.nodeStore
        .getState()
        .setNodes((prev) =>
          prev.map((n) => (n.id === selectedNode.id ? updatedNode : n))
        );
    },
    [selectedNode, system.nodeStore]
  );

  const handleValueChange = useCallback(
    (inputName: string, newValue: any) => {
      if (!selectedNode) return;

      const updatedNode = {
        ...selectedNode,
        data: {
          ...selectedNode.data,
          ports: {
            ...selectedNode.data.ports,
            [inputName]: newValue
          }
        }
      };

      system.nodeStore
        .getState()
        .setNodes((prev) =>
          prev.map((n) => (n.id === selectedNode.id ? updatedNode : n))
        );
    },
    [selectedNode, system.nodeStore]
  );

  return {
    handleSaveTitle,
    handleValueChange
  };
}
