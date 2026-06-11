import { describe, expect, it } from 'vitest';
import { makeGraphApi } from '@/Graphs/Graph.js';
import type { Dependencies } from '@/types/registry.js';
import { makePureInOutFunctionDesc } from '@/Nodes/FunctionNode.js';
import type { IFunctionNode } from '@/Nodes/NodeInstance.js';

describe('makePureInOutFunctionDesc', () => {
  it('skips exec when inputs are unchanged and replays cached outputs', async () => {
    let callCount = 0;

    const def = makePureInOutFunctionDesc({
      typeName: 'test/pureAddOne',
      label: 'Pure Add One',
      in: { a: 'integer' },
      out: { result: 'integer' },
      exec: ({ read, write }) => {
        callCount++;
        const a = read<bigint>('a');
        write('result', a + 1n);
      }
    });

    const graph = makeGraphApi({
      dependencies: {} as unknown as Dependencies,
      values: {}
    });
    const node = def.nodeFactory(
      graph,
      {},
      'node-1'
    ) as unknown as IFunctionNode;

    // first execution
    node.inputs.find((s) => s.name === 'a')!.value = 1n;
    await node.exec(node);
    expect(callCount).toBe(1);
    expect(node.outputs.find((s) => s.name === 'result')!.value).toBe(2n);

    // clear output and re-run with same input: should not call exec, but should restore output
    node.outputs.find((s) => s.name === 'result')!.value = undefined;
    await node.exec(node);
    expect(callCount).toBe(1);
    expect(node.outputs.find((s) => s.name === 'result')!.value).toBe(2n);

    // change input: should call exec again
    node.inputs.find((s) => s.name === 'a')!.value = 5n;
    await node.exec(node);
    expect(callCount).toBe(2);
    expect(node.outputs.find((s) => s.name === 'result')!.value).toBe(6n);
  });

  it('caches multiple outputs by socket key', async () => {
    let callCount = 0;

    const def = makePureInOutFunctionDesc({
      typeName: 'test/pureSplit',
      label: 'Pure Split',
      in: { a: 'integer' },
      out: { x: 'integer', y: 'integer' },
      exec: ({ read, write }) => {
        callCount++;
        const a = read<bigint>('a');
        write('x', a);
        write('y', a + 10n);
      }
    });

    const graph = makeGraphApi({
      dependencies: {} as unknown as Dependencies,
      values: {}
    });
    const node = def.nodeFactory(
      graph,
      {},
      'node-2'
    ) as unknown as IFunctionNode;

    node.inputs.find((s) => s.name === 'a')!.value = 3n;
    await node.exec(node);
    expect(callCount).toBe(1);
    expect(node.outputs.find((s) => s.name === 'x')!.value).toBe(3n);
    expect(node.outputs.find((s) => s.name === 'y')!.value).toBe(13n);

    node.outputs.find((s) => s.name === 'x')!.value = undefined;
    node.outputs.find((s) => s.name === 'y')!.value = undefined;
    await node.exec(node);
    expect(callCount).toBe(1);
    expect(node.outputs.find((s) => s.name === 'x')!.value).toBe(3n);
    expect(node.outputs.find((s) => s.name === 'y')!.value).toBe(13n);
  });

  it('accepts full socket definitions (defaultValue/choices/label)', async () => {
    let callCount = 0;

    const def = makePureInOutFunctionDesc({
      typeName: 'test/pureWithDefaults',
      label: 'Pure With Defaults',
      in: {
        a: {
          valueType: 'integer',
          defaultValue: 2n,
          label: 'A',
          choices: [
            { text: '1', value: 1n },
            { text: '2', value: 2n },
            { text: '3', value: 3n }
          ]
        }
      },
      out: {
        result: {
          valueType: 'integer',
          label: 'Result'
        }
      },
      exec: ({ read, write }) => {
        callCount++;
        const a = read<bigint>('a');
        write('result', a + 1n);
      }
    });

    const graph = makeGraphApi({
      dependencies: {} as unknown as Dependencies,
      values: {}
    });
    const node = def.nodeFactory(
      graph,
      {},
      'node-3'
    ) as unknown as IFunctionNode;

    const input = node.inputs.find((s) => s.name === 'a')!;
    expect(input.label).toBe('A');
    expect(input.valueChoices).toEqual([
      { text: '1', value: 1n },
      { text: '2', value: 2n },
      { text: '3', value: 3n }
    ]);
    expect(input.value).toBe(2n);

    await node.exec(node);
    expect(callCount).toBe(1);
    expect(node.outputs.find((s) => s.name === 'result')!.value).toBe(3n);

    // same inputs: should replay cached outputs
    node.outputs.find((s) => s.name === 'result')!.value = undefined;
    await node.exec(node);
    expect(callCount).toBe(1);
    expect(node.outputs.find((s) => s.name === 'result')!.value).toBe(3n);
  });
});
