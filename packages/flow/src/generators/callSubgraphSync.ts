import type { System } from '@/system/system';
import type { GraphSession } from '@/system/graphSession';
import type { IBehaveNode } from '@/types/nodes';
import {
  CALL_SUBGRAPH_TYPE,
  contractToParams,
  deriveContract,
  paramsToSockets,
  type ContractParam
} from '@/transformers/contract';

/**
 * Stable string key for a session's contract (its graph/input + graph/output
 * params). Used to detect *contract* changes and ignore unrelated node edits
 * (e.g. dragging), so we only repropagate when the boundary actually changes.
 */
const contractKey = (session: GraphSession): string =>
  JSON.stringify(deriveContract(session.nodeStore.getState().nodes));

/**
 * Reconcile every Call Subgraph node in every open graph with the *current*
 * contract of the subgraph it references. Idempotent: a node is only rewritten
 * when its stored contract/ports actually differ, so this converges and never
 * loops (rewriting a call node does not change its host graph's contract).
 */
const resyncAllCallNodes = (editor: System): void => {
  const sessions = editor.activeGraph.getState().sessions;

  for (const target of Object.values(sessions)) {
    let mutated = false;

    const nextNodes = target.nodeStore.getState().nodes.map((node) => {
      if (node.data?.type !== CALL_SUBGRAPH_TYPE) return node;

      const subgraphId = String(node.data?.configuration?.subgraphId ?? '');
      const subgraph = subgraphId ? sessions[subgraphId] : undefined;
      // Referenced graph not open (e.g. its tab was closed): leave the last
      // known contract in place rather than wiping the node's ports.
      if (!subgraph) return node;

      const contract = deriveContract(subgraph.nodeStore.getState().nodes);
      const inputs: ContractParam[] = contractToParams(contract.graphInputs);
      const outputs: ContractParam[] = contractToParams(contract.graphOutputs);
      const inputSockets = paramsToSockets(inputs);
      const outputSockets = paramsToSockets(outputs);

      const currentConfig = {
        inputs: node.data?.configuration?.inputs ?? [],
        outputs: node.data?.configuration?.outputs ?? []
      };
      const currentPorts = {
        inputs: node.data?.dynamicPorts?.inputs ?? [],
        outputs: node.data?.dynamicPorts?.outputs ?? []
      };

      if (
        JSON.stringify(currentConfig) === JSON.stringify({ inputs, outputs }) &&
        JSON.stringify(currentPorts) ===
          JSON.stringify({ inputs: inputSockets, outputs: outputSockets })
      ) {
        return node;
      }

      mutated = true;
      return {
        ...node,
        data: {
          ...node.data,
          configuration: {
            ...node.data?.configuration,
            inputs,
            outputs
          },
          dynamicPorts: {
            ...node.data?.dynamicPorts,
            inputs: inputSockets,
            outputs: outputSockets
          }
        }
      } as IBehaveNode;
    });

    if (mutated) target.nodeStore.getState().setNodes(() => nextNodes);
  }
};

/**
 * Keep Call Subgraph nodes live with the graphs they reference. Without this a
 * call node only captures the subgraph's contract at selection time; editing the
 * subgraph's inputs/outputs afterwards would leave callers stale.
 *
 * Implemented as an editor session extension: every open graph (existing and
 * future) watches its own contract, and when it changes we repropagate to all
 * call nodes referencing it across every graph. Returns a disposer.
 */
export function setupCallSubgraphSync(editor: System): () => void {
  const unsubscribes = new Map<string, () => void>();

  const watch = (session: GraphSession) => {
    if (unsubscribes.has(session.id)) return;

    let last = contractKey(session);
    const unsub = session.nodeStore.subscribe(() => {
      const next = contractKey(session);
      if (next === last) return; // ignore non-contract edits (drags, etc.)
      last = next;
      resyncAllCallNodes(editor);
    });

    unsubscribes.set(session.id, unsub);
    session.onDispose(() => {
      unsubscribes.get(session.id)?.();
      unsubscribes.delete(session.id);
    });
  };

  const unregister = editor.registerSessionExtension(watch);
  // Reconcile graphs already open (e.g. a project loaded from disk) once.
  resyncAllCallNodes(editor);

  return () => {
    unregister();
    for (const unsub of unsubscribes.values()) unsub();
    unsubscribes.clear();
  };
}
