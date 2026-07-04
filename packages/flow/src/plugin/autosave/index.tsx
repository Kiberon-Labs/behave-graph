import { ErrorBoundary } from 'react-error-boundary';
import { plugin } from '@/system/plugin';
import type { System, SettingsStorage } from '@/system/system';
import { MenuItemElement } from '@/components/menubar/menuItem';
import { BackupController } from './controller';
import { BackupPanel } from './panel';
import { AUTOSAVE_SETTINGS } from './settings';

export * from './settings';
export * from './storage';
export * from './controller';

declare module '@/system/system' {
  interface System {
    /** Local backup controller, present when the autosave plugin is loaded. */
    backups?: BackupController;
  }
}

/** Tab id for the backup browser panel. */
export const BACKUP_PANEL_TAB_ID = 'autosaveBackups';

/** Options for {@link autosavePlugin}. */
export interface AutosavePluginOptions {
  /**
   * Storage adapter for the backups. Defaults to `localStorage`. Provide your
   * own (e.g. backed by VS Code workspace state) to persist elsewhere; pass a
   * throwaway map in tests.
   */
  storage?: SettingsStorage;
  /** Add the "Local Backups" item to the Window menu. Default: true. */
  addMenuItem?: boolean;
}

/**
 * Client-side automatic graph backups.
 *
 * Periodically snapshots every open graph into local storage so a crash or a
 * bad edit during development is recoverable, and adds a panel to browse and
 * restore those copies. Everything stays in the browser , no backend.
 *
 * The plugin:
 * - contributes the `Autosave` settings (on/off, frequency, copies-to-keep);
 * - installs a {@link BackupController} on the editor as `system.backups`,
 *   which runs the consistency-checked capture loop and honours the settings;
 * - registers the `autosaveBackups` panel plus `autosave.openBackups` /
 *   `autosave.backupNow` commands and a Window-menu entry.
 *
 * Snapshots are only taken when a graph changed, settled, is consistent and is
 * not empty; callers can bracket bulk mutations with
 * `system.backups.runExclusive(...)` to guarantee no copy is taken mid-change.
 */
export const autosavePlugin = plugin(
  (system: System, options: AutosavePluginOptions = {}) => {
    system.registerSettings(AUTOSAVE_SETTINGS);

    const controller = new BackupController(system, options.storage);
    system.decorate('backups', controller);

    const commands = system.commandStore.getState();
    commands.register({
      id: 'autosave.openBackups',
      title: 'Open Local Backups',
      run: (ctx) => ctx.editor.tabStore.getState().openTab(BACKUP_PANEL_TAB_ID)
    });
    commands.register({
      id: 'autosave.backupNow',
      title: 'Back Up Graph Now',
      run: (ctx) => {
        ctx.editor.backups?.backupNow();
      }
    });

    system.tabLoader.register(BACKUP_PANEL_TAB_ID, () => ({
      id: BACKUP_PANEL_TAB_ID,
      closable: true,
      title: 'Local Backups',
      group: 'default',
      content: () => (
        <ErrorBoundary fallback={'Error loading Local Backups panel'}>
          <BackupPanel />
        </ErrorBoundary>
      )
    }));

    if (options.addMenuItem !== false) {
      const menuStore = system.menubarStore;
      const windowMenu = menuStore
        .getState()
        .items.find((menu) => menu.name === 'window');
      if (windowMenu) {
        menuStore.getState().setSubMenuItems('window', [
          ...windowMenu.items,
          {
            name: 'autosaveBackups',
            render: function BackupsMenuItem() {
              return (
                <MenuItemElement
                  key="autosaveBackups"
                  onClick={() =>
                    system.tabStore.getState().openTab(BACKUP_PANEL_TAB_ID)
                  }
                >
                  Local Backups
                </MenuItemElement>
              );
            }
          }
        ]);
      }
    }
  },
  { name: 'autosave' }
);
