import type { System } from '@/system/system';
import { registerDefaultSocketGenerators } from './registerDefaultGenerators';
import { setupCallSubgraphSync } from './callSubgraphSync';

/** Editors that already had their built-in content registered. */
const initialized = new WeakSet<System>();

/**
 * Register the editor's built-in content , the default socket generators and the
 * call-subgraph contract sync , on an editor instance.
 *
 * Idempotent per editor: safe to call from every graph-canvas mount (multiple
 * tabs) without double-registering. The default content is editor-lifetime; the
 * subgraph sync's per-session subscriptions clean themselves up on session
 * dispose.
 *
 * A host that wants a blank or fully custom editor can simply not rely on the
 * canvas's auto-call and register its own content instead.
 */
export function registerDefaults(editor: System): void {
  if (initialized.has(editor)) return;
  initialized.add(editor);

  registerDefaultSocketGenerators(editor);
  setupCallSubgraphSync(editor);
}
