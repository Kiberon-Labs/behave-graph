import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { generateNodesFromFile } from '../src/generator';

/** Collapse all whitespace sequences to a single space and normalize
 *  quote characters so comparisons are invariant of formatting and
 *  quote style (single vs double quotes). */
function normalizeCode(code: string): string {
  return code.replace(/\s+/g, ' ').replace(/"/g, "'").trim();
}

describe('node generator', () => {
  it('imports source and calls function (no inlining)', () => {
    const fixturesDir = path.resolve(__dirname, 'fixtures');
    const input = path.join(fixturesDir, 'example.src.ts');
    const out = path.join(fixturesDir, 'example.compiled.ts');
    const expectedFile = path.join(fixturesDir, 'example.expected.ts');
    const dts = path.join(fixturesDir, 'behave-graph.d.ts');

    const { code } = generateNodesFromFile(input, {
      extraRootFiles: [dts],
      outputFilePath: out,
      behaveGraphModuleNames: ['behave-graph']
    });

    if (process.env.UPDATE_EXPECTED === '1') {
      fs.writeFileSync(expectedFile, code, 'utf8');
    }

    const expected = fs.readFileSync(expectedFile, 'utf8');
    expect(normalizeCode(code)).toBe(normalizeCode(expected));
  });

  it('handles flows correctly', () => {
    const fixturesDir = path.resolve(__dirname, 'fixtures');
    const input = path.join(fixturesDir, 'flow.src.ts');
    const out = path.join(fixturesDir, 'flow.compiled.ts');
    const expectedFile = path.join(fixturesDir, 'flow.expected.ts');
    const dts = path.join(fixturesDir, 'behave-graph.d.ts');

    const { code } = generateNodesFromFile(input, {
      extraRootFiles: [dts],
      outputFilePath: out,
      behaveGraphModuleNames: ['behave-graph']
    });

    const expected = fs.readFileSync(expectedFile, 'utf8');
    expect(normalizeCode(code)).toBe(normalizeCode(expected));
  });

  it('support default exports', () => {
    const fixturesDir = path.resolve(__dirname, 'fixtures');
    const input = path.join(fixturesDir, 'exportDefault.src.ts');
    const out = path.join(fixturesDir, 'exportDefault.compiled.ts');
    const expectedFile = path.join(fixturesDir, 'exportDefault.expected.ts');
    const dts = path.join(fixturesDir, 'behave-graph.d.ts');

    const { code } = generateNodesFromFile(input, {
      extraRootFiles: [dts],
      outputFilePath: out,
      behaveGraphModuleNames: ['behave-graph']
    });

    const expected = fs.readFileSync(expectedFile, 'utf8');
    expect(normalizeCode(code)).toBe(normalizeCode(expected));
  });

  it('handles classes correctly', () => {
    const fixturesDir = path.resolve(__dirname, 'fixtures');
    const input = path.join(fixturesDir, 'class.src.ts');
    const out = path.join(fixturesDir, 'class.compiled.ts');
    const expectedFile = path.join(fixturesDir, 'class.expected.ts');
    const dts = path.join(fixturesDir, 'behave-graph.d.ts');

    const { code } = generateNodesFromFile(input, {
      extraRootFiles: [dts],
      outputFilePath: out,
      behaveGraphModuleNames: ['behave-graph']
    });

    const expected = fs.readFileSync(expectedFile, 'utf8');
    expect(normalizeCode(code)).toBe(normalizeCode(expected));
  });

  it('handles decorated classes correctly', () => {
    const fixturesDir = path.resolve(__dirname, 'fixtures');
    const input = path.join(fixturesDir, 'decorated.src.ts');
    const out = path.join(fixturesDir, 'decorated.compiled.ts');
    const expectedFile = path.join(fixturesDir, 'decorated.expected.ts');
    const dts = path.join(fixturesDir, 'behave-graph.d.ts');

    const { code } = generateNodesFromFile(input, {
      extraRootFiles: [dts],
      outputFilePath: out,
      behaveGraphModuleNames: ['behave-graph']
    });

    const expected = fs.readFileSync(expectedFile, 'utf8');
    expect(normalizeCode(code)).toBe(normalizeCode(expected));
  });
});
