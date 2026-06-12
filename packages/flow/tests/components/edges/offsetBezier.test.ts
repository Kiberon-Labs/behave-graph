import { describe, expect, it } from 'vitest';
import { Position } from 'reactflow';
import { getBetterBezierPath } from '@/components/edges/offsetBezier';

describe('getBetterBezierPath', () => {
  it('returns a bezier path string plus label/offset coordinates', () => {
    const result = getBetterBezierPath({
      sourceX: 0,
      sourceY: 0,
      targetX: 0,
      targetY: 200
    });

    expect(result).toHaveLength(5);
    const [path, labelX, labelY] = result;
    expect(typeof path).toBe('string');
    expect(path.startsWith('M0,0 C')).toBe(true);
    expect(typeof labelX).toBe('number');
    expect(typeof labelY).toBe('number');
  });

  it('offsets the control points vertically for bottom->top connections', () => {
    const [path] = getBetterBezierPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Bottom,
      targetX: 0,
      targetY: 200,
      targetPosition: Position.Top,
      offset: 75
    });

    // source control = (0, 0 + 75), target control = (0, 200 - 75)
    expect(path).toBe('M0,0 C0,75 0,125 0,200');
  });

  it('offsets the control points horizontally for left/right connections', () => {
    const [path] = getBetterBezierPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 200,
      targetY: 0,
      targetPosition: Position.Left,
      offset: 50
    });

    // source control = (0 + 50, 0), target control = (200 - 50, 0)
    expect(path).toBe('M0,0 C50,0 150,0 200,0');
  });
});
