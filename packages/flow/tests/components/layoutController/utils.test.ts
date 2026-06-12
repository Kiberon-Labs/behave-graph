import { describe, expect, it } from 'vitest';
import type { LayoutBase } from 'rc-dock';
import {
  findGraphPanel,
  findTabInLayout,
  removeTabFromLayout
} from '@/components/layoutController/utils';

const makeLayout = (): LayoutBase =>
  ({
    dockbox: {
      id: 'root',
      mode: 'horizontal',
      children: [
        {
          id: 'graphs',
          tabs: [{ id: 'tab-a' }, { id: 'tab-b' }]
        },
        {
          id: 'sidebar',
          tabs: [{ id: 'tab-c' }]
        }
      ]
    }
  }) as unknown as LayoutBase;

describe('layoutController/utils', () => {
  describe('findGraphPanel', () => {
    it('locates the panel whose id is "graphs"', () => {
      const panel = findGraphPanel(makeLayout());
      expect(panel?.id).toBe('graphs');
    });

    it('returns null when no graph panel exists', () => {
      const layout = {
        dockbox: { id: 'root', children: [{ id: 'other', tabs: [] }] }
      } as unknown as LayoutBase;
      expect(findGraphPanel(layout)).toBeNull();
    });
  });

  describe('findTabInLayout', () => {
    it('finds the panel that owns a given tab', () => {
      expect(findTabInLayout(makeLayout(), 'tab-b')?.id).toBe('graphs');
      expect(findTabInLayout(makeLayout(), 'tab-c')?.id).toBe('sidebar');
    });

    it('returns null for an unknown tab', () => {
      expect(findTabInLayout(makeLayout(), 'missing')).toBeNull();
    });
  });

  describe('removeTabFromLayout', () => {
    it('removes a tab while keeping the panel that still has tabs', () => {
      const updated = removeTabFromLayout(makeLayout(), 'tab-a');
      const graphsPanel = findTabInLayout(updated, 'tab-b');
      expect(graphsPanel?.id).toBe('graphs');
      expect(findTabInLayout(updated, 'tab-a')).toBeNull();
    });

    it('does not mutate the original layout', () => {
      const layout = makeLayout();
      removeTabFromLayout(layout, 'tab-a');
      // original still has tab-a
      expect(findTabInLayout(layout, 'tab-a')?.id).toBe('graphs');
    });
  });
});
