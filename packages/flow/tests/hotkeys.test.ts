import { describe, it, expect } from 'vitest';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';
import { System } from '../src/system/system.js';
import { formatTrigger } from '../src/store/hotKeys.js';

const buildSystem = () => {
  const reg = registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {} as any
  });
  return new System({ values: reg.values, specs: writeNodeSpecsToJSON(reg) });
};

describe('formatTrigger', () => {
  it('capitalizes modifiers and single keys', () => {
    expect(formatTrigger('ctrl+s')).toBe('Ctrl+S');
    expect(formatTrigger('shift+alt+f')).toBe('Shift+Alt+F');
  });

  it('maps arrow keys to glyphs', () => {
    expect(formatTrigger('ctrl+shift+left')).toBe('Ctrl+Shift+←');
    expect(formatTrigger('ctrl+shift+right')).toBe('Ctrl+Shift+→');
  });

  it('prefers the ctrl variant when several triggers are bound', () => {
    expect(formatTrigger(['command+c', 'ctrl+c'])).toBe('Ctrl+C');
  });

  it('returns undefined for empty/unset triggers', () => {
    expect(formatTrigger(undefined)).toBeUndefined();
    expect(formatTrigger('')).toBeUndefined();
    expect(formatTrigger([])).toBeUndefined();
  });
});

describe('getCommandKeybinding', () => {
  it('auto-detects the shortcut for a command-backed binding', () => {
    const sys = buildSystem();
    const store = sys.hotKeyStore.getState();
    expect(store.getCommandKeybinding('selection.copy')).toBe('Ctrl+C');
    expect(store.getCommandKeybinding('editor.save')).toBe('Ctrl+S');
  });

  it('resolves handler-only bindings via hintCommand', () => {
    const sys = buildSystem();
    const store = sys.hotKeyStore.getState();
    expect(store.getCommandKeybinding('node.traceUpstream')).toBe(
      'Ctrl+Shift+←'
    );
  });

  it('returns undefined for a command with no bound key', () => {
    const sys = buildSystem();
    const store = sys.hotKeyStore.getState();
    expect(store.getCommandKeybinding('node.focus')).toBeUndefined();
    expect(store.getCommandKeybinding('does.not.exist')).toBeUndefined();
  });

  it('reflects a rebind live, and picks up runtime-registered commands', () => {
    const sys = buildSystem();
    const store = sys.hotKeyStore.getState();

    // Rebinding the action updates the derived hint.
    store.register({ action: 'SAVE', trigger: 'ctrl+k' });
    expect(sys.hotKeyStore.getState().getCommandKeybinding('editor.save')).toBe(
      'Ctrl+K'
    );

    // A runtime binding that names its command becomes resolvable.
    store.register({ action: 'RUN', trigger: 'p', command: 'graph.run' });
    expect(sys.hotKeyStore.getState().getCommandKeybinding('graph.run')).toBe(
      'P'
    );
  });
});
