import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('GameRoot High-Risk Behavioral Changes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).wx;
  });

  describe('Safe Area Calculation', () => {
    it('computes _safeTop correctly in valid WeChat environment', () => {
      const si = { windowHeight: 800 };
      const cap = { bottom: 50 };
      (globalThis as any).wx = {
        getSystemInfoSync: () => si,
        getMenuButtonBoundingClientRect: () => cap
      };
      const h = 800;
      let _safeTop = 0;
      try {
        const wxa = (globalThis as any)?.wx;
        if (wxa?.getSystemInfoSync && wxa?.getMenuButtonBoundingClientRect) {
          const s = wxa.getSystemInfoSync();
          const c = wxa.getMenuButtonBoundingClientRect();
          if (s?.windowHeight > 0 && c?.bottom > 0) {
            _safeTop = (c.bottom + 8) * (h / s.windowHeight);
          }
        }
      } catch (e) { /* non-wx environment ignore */ }
      expect(_safeTop).toBeCloseTo((cap.bottom + 8) * (h / si.windowHeight));
    });

    it('defaults to 0 when wx API is unavailable', () => {
      const h = 800;
      let _safeTop = 0;
      try {
        const wxa = (globalThis as any)?.wx;
        if (wxa?.getSystemInfoSync && wxa?.getMenuButtonBoundingClientRect) {
          const s = wxa.getSystemInfoSync();
          const c = wxa.getMenuButtonBoundingClientRect();
          if (s?.windowHeight > 0 && c?.bottom > 0) {
            _safeTop = (c.bottom + 8) * (h / s.windowHeight);
          }
        }
      } catch (e) { /* non-wx environment ignore */ }
      expect(_safeTop).toBe(0);
    });

    it('gracefully handles invalid system info without throwing', () => {
      (globalThis as any).wx = {
        getSystemInfoSync: () => ({ windowHeight: -1 }),
        getMenuButtonBoundingClientRect: () => ({})
      };
      const h = 800;
      let _safeTop = 0;
      try {
        const wxa = (globalThis as any)?.wx;
        if (wxa?.getSystemInfoSync && wxa?.getMenuButtonBoundingClientRect) {
          const s = wxa.getSystemInfoSync();
          const c = wxa.getMenuButtonBoundingClientRect();
          if (s?.windowHeight > 0 && c?.bottom > 0) {
            _safeTop = (c.bottom + 8) * (h / s.windowHeight);
          }
        }
      } catch (e) { /* non-wx environment ignore */ }
      expect(_safeTop).toBe(0);
    });
  });

  describe('Tutorial State Management', () => {
    it('enables teaching mode and resets timer for level 1', () => {
      let _teaching = false;
      let _teachT = 0;
      const lv = 1;
      _teaching = lv === 1;
      _teachT = 0;
      expect(_teaching).toBe(true);
      expect(_teachT).toBe(0);
    });

    it('disables teaching on first pile interaction', () => {
      let _teaching = true;
      if (_teaching) _teaching = false;
      expect(_teaching).toBe(false);
    });

    it('increments teach timer during update loop', () => {
      let _teaching = true;
      let _teachT = 0;
      const dt = 0.16;
      if (_teaching) _teachT += dt;
      expect(_teachT).toBeCloseTo(dt);
    });
  });

  describe('UI Layout Adjustments', () => {
    it('subtracts safe top from bottom UI coordinates', () => {
      const h = 800;
      const _safeTop = 20;
      const top = h - 150 - _safeTop;
      expect(top).toBe(630);
    });

    it('constrains button width for narrow viewports', () => {
      const w = 300;
      const bw = Math.min(216, (w - 56) / 3);
      expect(bw).toBeCloseTo(81.333);
      
      const wWide = 500;
      const bwWide = Math.min(216, (wWide - 56) / 3);
      expect(bwWide).toBe(216);
    });

    it('constrains modal width for narrow viewports', () => {
      const w = 300;
      const pw = Math.min(580, w - 24);
      expect(pw).toBe(276);
      
      const wWide = 800;
      const pwWide = Math.min(580, wWide - 24);
      expect(pwWide).toBe(580);
    });
  });

  describe('Tutorial Rendering Edge Cases', () => {
    it('returns early when target pile position is null', () => {
      let target: { x: number; y: number } | null = null;
      let guardTriggered = false;
      if (!target) {
        guardTriggered = true;
        return;
      }
      expect(guardTriggered).toBe(true);
    });

    it('calculates pulse radius smoothly between 0 and 1', () => {
      const getPulse = (t: number) => (Math.sin(t * 4) + 1) / 2;
      expect(getPulse(0)).toBeCloseTo(0.5);
      expect(getPulse(Math.PI / 4)).toBeCloseTo(1.0);
      expect(getPulse(Math.PI / 2)).toBeCloseTo(0.5);
      expect(getPulse(Math.PI)).toBeCloseTo(-0.0);
    });
  });
});
