import { describe, it, expect } from 'vitest';
import type { Node, Connection } from 'reactflow';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import {
  findConverterSpec,
  resolveConverter,
  buildConverterInsertion
} from '../src/util/autoConvert.js';

const specs = [
  { type: 'src', label: '', category: '', inputs: [], outputs: [{ name: 'out', valueType: 'integer' }] },
  { type: 'dst', label: '', category: '', inputs: [{ name: 'in', valueType: 'string' }], outputs: [] },
  {
    type: 'math/toString/integer',
    label: 'To String',
    category: 'Logic',
    inputs: [{ name: 'a', valueType: 'integer' }],
    outputs: [{ name: 'result', valueType: 'string' }]
  }
] as unknown as NodeSpecJSON[];

const node = (id: string, type: string, x: number): Node => ({
  id,
  type: 'behaveNode',
  position: { x, y: 0 },
  data: { type, configuration: {}, ports: {} } as any
});

const conn = (
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string
): Connection => ({ source, sourceHandle, target, targetHandle });

describe('findConverterSpec', () => {
  it('finds a single-in/single-out converter for the type pair', () => {
    expect(findConverterSpec(specs, 'integer', 'string')?.type).toBe(
      'math/toString/integer'
    );
  });

  it('ignores nodes that have flow sockets', () => {
    const flowNode = [
      {
        type: 'fn',
        inputs: [
          { name: 'flow', valueType: 'flow' },
          { name: 'a', valueType: 'integer' }
        ],
        outputs: [{ name: 'result', valueType: 'string' }]
      }
    ] as unknown as NodeSpecJSON[];
    expect(findConverterSpec(flowNode, 'integer', 'string')).toBeUndefined();
  });

  it('returns undefined when no converter exists', () => {
    expect(findConverterSpec(specs, 'string', 'boolean')).toBeUndefined();
  });
});

describe('resolveConverter (configurable rules)', () => {
  const customSpecs = [
    ...specs,
    {
      type: 'custom/intToStr',
      inputs: [{ name: 'x', valueType: 'integer' }],
      outputs: [{ name: 'y', valueType: 'string' }]
    }
  ] as unknown as NodeSpecJSON[];

  it('prefers a registered custom rule over the spec heuristic', () => {
    const rules = [{ from: 'integer', to: 'string', nodeType: 'custom/intToStr' }];
    expect(resolveConverter(customSpecs, 'integer', 'string', rules)).toEqual({
      nodeType: 'custom/intToStr',
      inputName: 'x',
      outputName: 'y'
    });
  });

  it('falls back to the spec heuristic when no rule matches', () => {
    expect(resolveConverter(specs, 'integer', 'string', [])?.nodeType).toBe(
      'math/toString/integer'
    );
  });

  it('honours explicit inputKey/outputKey from the rule', () => {
    const rules = [
      {
        from: 'integer',
        to: 'string',
        nodeType: 'whatever',
        inputKey: 'in',
        outputKey: 'out'
      }
    ];
    expect(resolveConverter([], 'integer', 'string', rules)).toEqual({
      nodeType: 'whatever',
      inputName: 'in',
      outputName: 'out'
    });
  });

  // A converter node with several inputs/outputs (e.g. value + config ports).
  const multiPortSpecs = [
    {
      type: 'multi',
      inputs: [
        { name: 'flow', valueType: 'flow' },
        { name: 'label', valueType: 'string' }, // first non-flow, wrong type
        { name: 'n', valueType: 'integer' } // the actual source port
      ],
      outputs: [
        { name: 'flag', valueType: 'boolean' }, // first non-flow, wrong type
        { name: 'text', valueType: 'string' } // the actual target port
      ]
    }
  ] as unknown as NodeSpecJSON[];

  it('resolves a multi-port converter by type when keys are omitted', () => {
    const rules = [{ from: 'integer', to: 'string', nodeType: 'multi' }];
    expect(resolveConverter(multiPortSpecs, 'integer', 'string', rules)).toEqual(
      { nodeType: 'multi', inputName: 'n', outputName: 'text' }
    );
  });

  it('honours explicit keys to pick a specific port among several of a type', () => {
    const twoEachSpecs = [
      {
        type: 'multi2',
        inputs: [
          { name: 'a', valueType: 'integer' },
          { name: 'b', valueType: 'integer' }
        ],
        outputs: [
          { name: 'x', valueType: 'string' },
          { name: 'y', valueType: 'string' }
        ]
      }
    ] as unknown as NodeSpecJSON[];
    const rules = [
      {
        from: 'integer',
        to: 'string',
        nodeType: 'multi2',
        inputKey: 'b',
        outputKey: 'y'
      }
    ];
    expect(resolveConverter(twoEachSpecs, 'integer', 'string', rules)).toEqual({
      nodeType: 'multi2',
      inputName: 'b',
      outputName: 'y'
    });
  });
});

describe('buildConverterInsertion', () => {
  const nodes = [node('s', 'src', 0), node('t', 'dst', 100)];

  it('uses a custom conversion rule when provided', () => {
    const customSpecs = [
      ...specs,
      {
        type: 'custom/intToStr',
        inputs: [{ name: 'x', valueType: 'integer' }],
        outputs: [{ name: 'y', valueType: 'string' }]
      }
    ] as unknown as NodeSpecJSON[];
    const insertion = buildConverterInsertion(
      conn('s', 'out', 't', 'in'),
      nodes,
      customSpecs,
      [{ from: 'integer', to: 'string', nodeType: 'custom/intToStr' }]
    );
    expect(insertion!.node.data.type).toBe('custom/intToStr');
    expect(insertion!.edges[0]!.targetHandle).toBe('x');
    expect(insertion!.edges[1]!.sourceHandle).toBe('y');
  });

  it('splices a converter between mismatched-but-convertible sockets', () => {
    const insertion = buildConverterInsertion(
      conn('s', 'out', 't', 'in'),
      nodes,
      specs
    );
    expect(insertion).not.toBeNull();
    expect(insertion!.node.data.type).toBe('math/toString/integer');
    expect(insertion!.node.position).toEqual({ x: 50, y: 0 });
    expect(insertion!.edges).toHaveLength(2);
    expect(insertion!.edges[0]).toMatchObject({
      source: 's',
      sourceHandle: 'out',
      target: insertion!.node.id,
      targetHandle: 'a'
    });
    expect(insertion!.edges[1]).toMatchObject({
      source: insertion!.node.id,
      sourceHandle: 'result',
      target: 't',
      targetHandle: 'in'
    });
  });

  it('wires the type-matched output port of a multi-output converter', () => {
    // Converter emits both a boolean and a string; from→to is integer→string,
    // so the splice must use the `string` output (`text`), not the first output.
    const multiOutSpecs = [
      { type: 'src', inputs: [], outputs: [{ name: 'out', valueType: 'integer' }] },
      { type: 'dst', inputs: [{ name: 'in', valueType: 'string' }], outputs: [] },
      {
        type: 'multiOut',
        inputs: [{ name: 'a', valueType: 'integer' }],
        outputs: [
          { name: 'flag', valueType: 'boolean' },
          { name: 'text', valueType: 'string' }
        ]
      }
    ] as unknown as NodeSpecJSON[];
    const insertion = buildConverterInsertion(
      conn('s', 'out', 't', 'in'),
      nodes,
      multiOutSpecs,
      [{ from: 'integer', to: 'string', nodeType: 'multiOut' }]
    );
    expect(insertion!.node.data.type).toBe('multiOut');
    expect(insertion!.edges[0]!.targetHandle).toBe('a');
    // The converter→target edge leaves the string output, not the boolean one.
    expect(insertion!.edges[1]!.sourceHandle).toBe('text');
  });

  it('honours an explicit outputKey to pin a specific output port', () => {
    const twoStrOutSpecs = [
      { type: 'src', inputs: [], outputs: [{ name: 'out', valueType: 'integer' }] },
      { type: 'dst', inputs: [{ name: 'in', valueType: 'string' }], outputs: [] },
      {
        type: 'twoOut',
        inputs: [{ name: 'a', valueType: 'integer' }],
        outputs: [
          { name: 'x', valueType: 'string' },
          { name: 'y', valueType: 'string' }
        ]
      }
    ] as unknown as NodeSpecJSON[];
    const insertion = buildConverterInsertion(
      conn('s', 'out', 't', 'in'),
      nodes,
      twoStrOutSpecs,
      [
        {
          from: 'integer',
          to: 'string',
          nodeType: 'twoOut',
          inputKey: 'a',
          outputKey: 'y'
        }
      ]
    );
    expect(insertion!.edges[1]!.sourceHandle).toBe('y');
  });

  it('returns null for same-type connections', () => {
    const sameSpecs = [
      { type: 'src', inputs: [], outputs: [{ name: 'out', valueType: 'integer' }] },
      { type: 'dstI', inputs: [{ name: 'in', valueType: 'integer' }], outputs: [] }
    ] as unknown as NodeSpecJSON[];
    const ns = [node('s', 'src', 0), node('t', 'dstI', 100)];
    expect(
      buildConverterInsertion(conn('s', 'out', 't', 'in'), ns, sameSpecs)
    ).toBeNull();
  });

  it('returns null when no converter is available', () => {
    const noConv = [
      { type: 'src', inputs: [], outputs: [{ name: 'out', valueType: 'integer' }] },
      { type: 'dstB', inputs: [{ name: 'in', valueType: 'boolean' }], outputs: [] }
    ] as unknown as NodeSpecJSON[];
    const ns = [node('s', 'src', 0), node('t', 'dstB', 100)];
    expect(
      buildConverterInsertion(conn('s', 'out', 't', 'in'), ns, noConv)
    ).toBeNull();
  });
});
