import { describe, expect, it } from 'vitest';
import {
  calculateTimeInterval,
  clamp,
  hashToHue
} from '@/components/panels/traces/utils';

describe('traces/utils', () => {
  describe('hashToHue', () => {
    it('is deterministic for the same input', () => {
      expect(hashToHue('node-a')).toBe(hashToHue('node-a'));
    });

    it('always returns a hue in the [0, 360) range', () => {
      for (const s of ['', 'a', 'flow/branch', 'a-very-long-identifier-123']) {
        const hue = hashToHue(s);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
        expect(Number.isInteger(hue)).toBe(true);
      }
    });

    it('generally produces different hues for different inputs', () => {
      expect(hashToHue('alpha')).not.toBe(hashToHue('beta'));
    });
  });

  describe('clamp', () => {
    it('returns the value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
    it('clamps below the minimum', () => {
      expect(clamp(-3, 0, 10)).toBe(0);
    });
    it('clamps above the maximum', () => {
      expect(clamp(42, 0, 10)).toBe(10);
    });
  });

  describe('calculateTimeInterval', () => {
    it('picks a "nice" interval roughly targeting 8 ticks', () => {
      expect(calculateTimeInterval(8)).toBe(1);
      expect(calculateTimeInterval(80)).toBe(10);
      expect(calculateTimeInterval(800)).toBe(100);
      expect(calculateTimeInterval(8000)).toBe(1000);
    });

    it('caps at the largest nice interval for very large ranges', () => {
      expect(calculateTimeInterval(10_000_000)).toBe(10000);
    });
  });
});
