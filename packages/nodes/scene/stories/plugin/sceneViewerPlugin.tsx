import { MenuItemElement, plugin } from '@kiberon-labs/behave-graph-flow';
import type { System } from '@kiberon-labs/behave-graph-flow';
import type { DemoScene } from '../components/DemoScene';
import { SceneViewerPanel } from '../components/SceneViewerPanel';

interface SceneViewerPluginOptions {
  scene: DemoScene;
  addMenuItem?: boolean;
}

/**
 * Plugin loader function that adds a 3D Scene Viewer tab to the system
 */
const sceneViewerPluginLoader = (
  system: System,
  options?: SceneViewerPluginOptions
) => {
  const scene = options?.scene;

  // Register the scene viewer tab
  system.tabLoader.register('sceneViewer', () => {
    return {
      id: 'sceneViewer',
      closable: true,
      title: '3D Scene Viewer',
      group: 'default',
      content: () => <SceneViewerPanel scene={scene} />
    };
  });

  // Add menu item to Window menu (unless disabled)
  if (options?.addMenuItem !== false) {
    const menuStore = system.menubarStore;

    const currentItems = menuStore.getState().items;
    const windowMenu = currentItems.find((menu) => menu.name === 'window');

    if (windowMenu) {
      // Check if item already exists
      const existingItem = windowMenu.items?.find(
        (item) => 'name' in item && item.name === 'sceneViewer'
      );

      if (!existingItem) {
        const newMenuItem = {
          name: 'sceneViewer',
          render: function SceneViewerMenuItem() {
            return (
              <MenuItemElement
                onClick={() =>
                  system.tabStore.getState().openTab('sceneViewer')
                }
              >
                3D Scene Viewer
              </MenuItemElement>
            );
          }
        };

        menuStore.setState({
          items: currentItems.map((menu) =>
            menu.name === 'window'
              ? { ...menu, items: [...(menu.items || []), newMenuItem] }
              : menu
          )
        });
      }
    }
  }

  // Automatically open the scene viewer tab
  setTimeout(() => {
    system.tabStore.getState().openTab('sceneViewer');
  }, 100);
};

/**
 * Plugin that adds a 3D Scene Viewer tab to the system
 */
export const sceneViewerPlugin = plugin<SceneViewerPluginOptions>(
  sceneViewerPluginLoader,
  { name: 'sceneViewerPlugin' }
);
