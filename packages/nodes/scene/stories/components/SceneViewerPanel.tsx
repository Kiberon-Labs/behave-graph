import { SceneViewer } from './SceneViewer';
import type { DemoScene } from './DemoScene';

interface SceneViewerPanelProps {
  scene: DemoScene;
}

export const SceneViewerPanel = ({ scene }: SceneViewerPanelProps) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e1e1e'
      }}
    >
      <div style={{ flex: 1, position: 'relative' }}>
        <SceneViewer scene={scene} />
      </div>
      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid #3e3e3e',
          backgroundColor: '#252525',
          color: '#888',
          fontSize: '11px',
          display: 'flex',
          justifyContent: 'space-between'
        }}
      >
        <span>Demo Scene - 4 objects with animation</span>
        <span>
          Left click + drag to rotate • Right click + drag to pan • Scroll to
          zoom
        </span>
      </div>
    </div>
  );
};
