import { describe, expect, it } from 'vitest';
import { mergeSockets } from '@/util/mergeSockets';

const specSocket = (name: string, valueType: string) =>
  ({ name, valueType }) as any;

describe('mergeSockets', () => {
  it('maps spec sockets to socket-base objects keyed by name', () => {
    const result = mergeSockets([
      specSocket('a', 'flow'),
      specSocket('b', 'string')
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.key)).toEqual(['a', 'b']);
    expect(result[0]).toMatchObject({ key: 'a', name: 'a', valueType: 'flow' });
  });

  it('returns spec sockets unchanged when no dynamic ports are given', () => {
    const result = mergeSockets([specSocket('a', 'flow')], undefined);
    expect(result).toEqual([{ key: 'a', name: 'a', valueType: 'flow' }]);
  });

  it('lets a dynamic port override a spec socket with the same key', () => {
    const result = mergeSockets(
      [specSocket('a', 'flow'), specSocket('b', 'string')],
      [{ key: 'b', name: 'b', valueType: 'integer' } as any]
    );

    expect(result).toHaveLength(2);
    const b = result.find((s) => s.key === 'b');
    expect(b?.valueType).toBe('integer');
  });

  it('appends dynamic ports that do not match any spec socket', () => {
    const result = mergeSockets(
      [specSocket('a', 'flow')],
      [{ key: 'extra', name: 'extra', valueType: 'boolean' } as any]
    );

    expect(result.map((s) => s.key)).toEqual(['a', 'extra']);
  });
});
