import { useEffect, useRef } from 'react';
import {
  PerspectiveCamera,
  WebGLRenderer,
  DirectionalLight,
  AmbientLight,
  GridHelper,
  AxesHelper,
  Color,
  Raycaster,
  Vector2,
  Mesh
} from 'three';
import { OrbitControls } from 'three-stdlib';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import type { DemoScene } from './DemoScene';

interface SceneViewerProps {
  scene: DemoScene;
}

export const SceneViewer = ({ scene }: SceneViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const statsRef = useRef<Stats | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Use the scene from props
    const threeScene = scene.scene;
    threeScene.background = new Color(0x1e1e1e);

    // Setup camera
    const camera = new PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(8, 6, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Setup orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 3;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2;
    controlsRef.current = controls;

    // Setup raycaster for mesh click detection
    const raycaster = new Raycaster();
    const pointer = new Vector2();

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      // Only raycast against registered mesh objects, not helpers/lights
      const meshes = Array.from(threeScene.children).filter(
        (child): child is Mesh => child instanceof Mesh
      );

      const intersects = raycaster.intersectObjects(meshes, true);

      for (const hit of intersects) {
        // Walk up to find the nearest named Mesh
        let obj = hit.object;
        while (obj) {
          if (obj instanceof Mesh && obj.name) {
            scene.triggerAnyMeshClick(obj.name);
            return;
          }
          if (obj.parent) {
            obj = obj.parent;
          } else {
            break;
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // Setup Stats monitor
    const stats = new Stats();
    // Style the stats panel to fit within the container
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0';
    stats.dom.style.left = '0';
    stats.dom.style.zIndex = '100';
    containerRef.current.appendChild(stats.dom);
    statsRef.current = stats;

    // Add lights
    const ambientLight = new AmbientLight(0x404040, 2);
    threeScene.add(ambientLight);

    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    threeScene.add(directionalLight);

    const directionalLight2 = new DirectionalLight(0x4466ff, 0.5);
    directionalLight2.position.set(-5, 5, -5);
    threeScene.add(directionalLight2);

    // Add grid and axes helpers
    const gridHelper = new GridHelper(20, 20, 0x444444, 0x222222);
    threeScene.add(gridHelper);

    const axesHelper = new AxesHelper(5);
    threeScene.add(axesHelper);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      stats.update();
      // Update controls
      controls.update();

      renderer.render(threeScene, camera);
    };
    animate();

    // Handle container resize using ResizeObserver
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    };

    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(containerRef.current);

    // Cleanup
    return () => {
      resizeObserver.disconnect();

      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (statsRef.current && containerRef.current) {
        containerRef.current.removeChild(statsRef.current.dom);
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [scene]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    />
  );
};
