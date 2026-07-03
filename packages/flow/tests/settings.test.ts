import { describe, it, expect, vi } from 'vitest';
import { System } from '../src/system/system.js';
import { registerDefaults } from '../src/generators/registerDefaults.js';

describe('editor settings serialization', () => {
  it('round-trips toggles and custom conversions', () => {
    const a = new System();
    a.systemSettings.getState().setAutoConvert(false);
    a.systemSettings.getState().setGridSize(42);
    a.registerConversion({ from: 'integer', to: 'string', nodeType: 'x/conv' });

    const json = a.serializeSettings();

    const b = new System();
    b.applySettings(json);

    expect(b.systemSettings.getState().autoConvert).toBe(false);
    expect(b.systemSettings.getState().gridSize).toBe(42);
    expect(b.conversionStore.getState().conversions).toEqual([
      { from: 'integer', to: 'string', nodeType: 'x/conv' }
    ]);
  });

  it('round-trips settings that the old hand-written store dropped', () => {
    // inlineValues lacked a setter (so applySettings could not restore it) and
    // setShowMenu was untyped , both fixed by the declarative schema.
    const a = new System();
    a.systemSettings.getState().setInlineValues(true);
    a.systemSettings.getState().setShowMenu(false);

    const b = new System();
    b.applySettings(a.serializeSettings());

    expect(b.systemSettings.getState().inlineValues).toBe(true);
    expect(b.systemSettings.getState().showMenu).toBe(false);
  });

  it('does not persist transient settings (showSearch)', () => {
    const a = new System();
    a.systemSettings.getState().setShowSearch(true);
    expect(a.serializeSettings().settings).not.toHaveProperty('showSearch');
  });
});

describe('plugin-contributed settings (schema registry)', () => {
  it('seeds the built-in descriptors so the panel auto-generates', () => {
    const sys = new System();
    const keys = sys.settingsSchema.getState().settings.map((s) => s.key);
    expect(keys).toContain('edgeType');
    expect(keys).toContain('autoConvert');
    expect(sys.settingsSchema.getState().sectionOrder).toContain('Layout');
  });

  it('registerSetting adds a descriptor and seeds its default value', () => {
    const sys = new System();
    sys.registerSetting({
      key: 'myPlugin.apiUrl',
      section: 'My Plugin',
      type: 'string',
      default: 'https://example.com',
      title: 'API URL'
    });

    expect(sys.getSetting('myPlugin.apiUrl')).toBe('https://example.com');
    expect(
      sys.settingsSchema.getState().settings.some((s) => s.key === 'myPlugin.apiUrl')
    ).toBe(true);
    expect(sys.settingsSchema.getState().sectionOrder).toContain('My Plugin');
  });

  it('ignores a duplicate key without clobbering the original', () => {
    const sys = new System();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // edgeType is a built-in; a plugin must not be able to redefine it.
      sys.registerSetting({
        key: 'edgeType',
        section: 'Hijack',
        type: 'boolean',
        default: true
      });
      expect(warn).toHaveBeenCalled();
      const edge = sys.settingsSchema
        .getState()
        .settings.find((s) => s.key === 'edgeType');
      expect(edge?.section).toBe('Layout');
    } finally {
      warn.mockRestore();
    }
  });

  it('round-trips plugin setting values through persistence', () => {
    const a = new System();
    a.registerSetting({
      key: 'myPlugin.autoStart',
      section: 'My Plugin',
      type: 'boolean',
      default: false
    });
    a.setSetting('myPlugin.autoStart', true);

    const json = a.serializeSettings();
    expect(json.settings).toHaveProperty('myPlugin.autoStart', true);

    const b = new System();
    b.registerSetting({
      key: 'myPlugin.autoStart',
      section: 'My Plugin',
      type: 'boolean',
      default: false
    });
    b.applySettings(json);
    expect(b.getSetting('myPlugin.autoStart')).toBe(true);
  });

  it('excludes persist:false plugin settings from serialization', () => {
    const sys = new System();
    sys.registerSetting({
      key: 'myPlugin.scratch',
      section: 'My Plugin',
      type: 'boolean',
      default: false,
      persist: false
    });
    sys.setSetting('myPlugin.scratch', true);
    expect(sys.serializeSettings().settings).not.toHaveProperty(
      'myPlugin.scratch'
    );
  });
});

describe('registerDefaults', () => {
  it('registers built-in generators and is idempotent per editor', () => {
    const sys = new System();
    registerDefaults(sys);
    const first = sys.socketGeneratorStore.getState().generators.length;
    expect(first).toBeGreaterThan(0);

    // Second call (e.g. another graph tab mounting) is a no-op.
    expect(() => registerDefaults(sys)).not.toThrow();
    expect(sys.socketGeneratorStore.getState().generators.length).toBe(first);
  });

  it('persists to and loads from a storage adapter', () => {
    vi.useFakeTimers();
    try {
      const backing: Record<string, string> = {};
      const storage = {
        getItem: (k: string) => backing[k] ?? null,
        setItem: (k: string, v: string) => {
          backing[k] = v;
        }
      };

      const a = new System();
      a.enableSettingsPersistence(storage);
      a.registerConversion({ from: 'float', to: 'string', nodeType: 'f/conv' });
      a.systemSettings.getState().setShowGrid(false);
      vi.advanceTimersByTime(400); // flush the debounced save

      expect(Object.keys(backing).length).toBe(1);

      // A fresh system loads the saved state on init.
      const b = new System();
      b.enableSettingsPersistence(storage);
      expect(b.systemSettings.getState().showGrid).toBe(false);
      expect(b.conversionStore.getState().conversions).toContainEqual({
        from: 'float',
        to: 'string',
        nodeType: 'f/conv'
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
