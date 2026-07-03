import {
  Scene,
  Mesh,
  BoxGeometry,
  MeshPhongMaterial,
  TorusKnotGeometry,
  SphereGeometry,
  CylinderGeometry,
  PlaneGeometry,
  ConeGeometry,
  TorusGeometry,
  PointLight,
  DirectionalLight,
  SpotLight,
  AmbientLight,
  type Light,
  Vector3,
  Color
} from 'three';
import { EventEmitter } from '@kiberon-labs/behave-graph';
import type { IScene } from '@/Abstractions/IScene';
import type { ChoiceJSON } from '@kiberon-labs/behave-graph';

export class DemoScene implements IScene {
  public readonly scene: Scene;
  public readonly onSceneChanged = new EventEmitter<void>();

  private objects: Map<string, Mesh>;
  private lights: Map<string, Light>;
  private clickListeners: Map<string, Set<(jsonPath: string) => void>>;
  private anyMeshClickListeners: Set<(meshName: string) => void>;
  private sceneChangedListeners: Set<() => void>;

  constructor() {
    this.scene = new Scene();
    this.objects = new Map();
    this.lights = new Map();
    this.clickListeners = new Map();
    this.anyMeshClickListeners = new Set();
    this.sceneChangedListeners = new Set();

    this.initializeScene();
  }

  private initializeScene() {
    // Create cube
    const cubeGeometry = new BoxGeometry(2, 2, 2);
    const cubeMaterial = new MeshPhongMaterial({
      color: 0x2194ce,
      shininess: 100
    });
    const cube = new Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 1, 0);
    cube.name = 'cube';
    this.scene.add(cube);
    this.objects.set('cube', cube);

    // Create torus knot
    const torusGeometry = new TorusKnotGeometry(0.8, 0.3, 100, 16);
    const torusMaterial = new MeshPhongMaterial({
      color: 0xce2194,
      shininess: 100
    });
    const torus = new Mesh(torusGeometry, torusMaterial);
    torus.position.set(4, 2, 2);
    torus.name = 'torus';
    this.scene.add(torus);
    this.objects.set('torus', torus);

    // Create sphere
    const sphereGeometry = new SphereGeometry(1, 32, 32);
    const sphereMaterial = new MeshPhongMaterial({
      color: 0x21ce94,
      shininess: 100
    });
    const sphere = new Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(-4, 1, -2);
    sphere.name = 'sphere';
    this.scene.add(sphere);
    this.objects.set('sphere', sphere);

    // Create cylinder
    const cylinderGeometry = new CylinderGeometry(0.7, 0.7, 3, 32);
    const cylinderMaterial = new MeshPhongMaterial({
      color: 0xce9421,
      shininess: 100
    });
    const cylinder = new Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.position.set(-2, 1.5, 3);
    cylinder.name = 'cylinder';
    this.scene.add(cylinder);
    this.objects.set('cylinder', cylinder);

    // Create a default directional light
    const defaultLight = new DirectionalLight(0xffffff, 1);
    defaultLight.position.set(5, 10, 7);
    defaultLight.name = 'defaultLight';
    this.scene.add(defaultLight);
    this.lights.set('defaultLight', defaultLight);

    // Create a default ambient light
    const ambientLight = new AmbientLight(0x404040, 0.5);
    ambientLight.name = 'ambientLight';
    this.scene.add(ambientLight);
    this.lights.set('ambientLight', ambientLight);
  }

  getProperty(jsonPath: string): any {
    const parts = jsonPath.split('/');
    const objectName = parts[0]!;
    const propertyName = parts[1];

    const obj = this.objects.get(objectName);
    if (!obj) return undefined;

    switch (propertyName) {
      case 'position':
        return { x: obj.position.x, y: obj.position.y, z: obj.position.z };
      case 'rotation':
        return { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
      case 'scale':
        return { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };
      case 'visible':
        return obj.visible;
      case 'color':
        if (obj.material instanceof MeshPhongMaterial) {
          const color = obj.material.color;
          return { r: color.r, g: color.g, b: color.b };
        }
        return undefined;
      default:
        return undefined;
    }
  }

  setProperty(jsonPath: string, valueTypeName: string, value: any): void {
    const parts = jsonPath.split('/');
    const objectName = parts[0]!;
    const propertyName = parts[1];

    const obj = this.objects.get(objectName);
    if (!obj) return;

    switch (propertyName) {
      case 'position':
        if (value.x !== undefined) obj.position.x = value.x;
        if (value.y !== undefined) obj.position.y = value.y;
        if (value.z !== undefined) obj.position.z = value.z;
        break;
      case 'rotation':
        if (value.x !== undefined) obj.rotation.x = value.x;
        if (value.y !== undefined) obj.rotation.y = value.y;
        if (value.z !== undefined) obj.rotation.z = value.z;
        break;
      case 'scale':
        if (value.x !== undefined) obj.scale.x = value.x;
        if (value.y !== undefined) obj.scale.y = value.y;
        if (value.z !== undefined) obj.scale.z = value.z;
        break;
      case 'visible':
        obj.visible = Boolean(value);
        break;
      case 'color':
        if (obj.material instanceof MeshPhongMaterial) {
          obj.material.color.setRGB(value.x || 0, value.y || 0, value.z || 0);
        }
        break;
    }

    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  addOnClickedListener(
    jsonPath: string,
    callback: (jsonPath: string) => void
  ): void {
    if (!this.clickListeners.has(jsonPath)) {
      this.clickListeners.set(jsonPath, new Set());
    }
    this.clickListeners.get(jsonPath)!.add(callback);
  }

  removeOnClickedListener(
    jsonPath: string,
    callback: (jsonPath: string) => void
  ): void {
    const listeners = this.clickListeners.get(jsonPath);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  getRaycastableProperties(): ChoiceJSON {
    const choices: ChoiceJSON = [];
    this.objects.forEach((obj, name) => {
      choices.push({
        text: name,
        value: name
      });
    });
    return choices;
  }

  getProperties(valueFilter?: string): ChoiceJSON {
    const choices: ChoiceJSON = [];
    this.objects.forEach((obj, name) => {
      if (valueFilter == 'euler' || valueFilter == 'vec3') {
        choices.push({ text: `${name}/position`, value: `${name}/position` });
        choices.push({ text: `${name}/rotation`, value: `${name}/rotation` });
        choices.push({ text: `${name}/scale`, value: `${name}/scale` });
      }
      if (valueFilter === 'boolean') {
        choices.push({ text: `${name}/visible`, value: `${name}/visible` });
      }
      if (valueFilter === 'color') {
        choices.push({ text: `${name}/color`, value: `${name}/color` });
      }
    });
    return choices;
  }

  addOnSceneChangedListener(listener: () => void): void {
    this.sceneChangedListeners.add(listener);
  }

  removeOnSceneChangedListener(listener: () => void): void {
    this.sceneChangedListeners.delete(listener);
  }

  // Trigger a click event (for testing)
  triggerClick(jsonPath: string): void {
    const listeners = this.clickListeners.get(jsonPath);
    if (listeners) {
      listeners.forEach((callback) => callback(jsonPath));
    }
  }

  // --- mesh lifecycle ---

  private createGeometry(
    geometryType: string,
    size: { x: number; y: number; z: number }
  ) {
    switch (geometryType) {
      case 'box':
        return new BoxGeometry(size.x, size.y, size.z);
      case 'sphere':
        return new SphereGeometry(size.x / 2, 32, 32);
      case 'cylinder':
        return new CylinderGeometry(size.x / 2, size.x / 2, size.y, 32);
      case 'torus':
        return new TorusGeometry(size.x / 2, size.y / 4, 16, 48);
      case 'plane':
        return new PlaneGeometry(size.x, size.y);
      case 'cone':
        return new ConeGeometry(size.x / 2, size.y, 32);
      default:
        return new BoxGeometry(size.x, size.y, size.z);
    }
  }

  createMesh(
    name: string,
    geometryType: string,
    size: { x: number; y: number; z: number }
  ): void {
    // Remove existing mesh with the same name
    if (this.objects.has(name)) {
      this.deleteMesh(name);
    }

    const geometry = this.createGeometry(geometryType, size);
    const material = new MeshPhongMaterial({
      color: 0xcccccc,
      shininess: 100
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    this.scene.add(mesh);
    this.objects.set(name, mesh);

    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  deleteMesh(name: string): void {
    const obj = this.objects.get(name);
    if (!obj) return;

    this.scene.remove(obj);
    obj.geometry.dispose();
    if (obj.material instanceof MeshPhongMaterial) {
      obj.material.dispose();
    }
    this.objects.delete(name);

    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  getMeshNames(): ChoiceJSON {
    const choices: ChoiceJSON = [];
    this.objects.forEach((_obj, name) => {
      choices.push({ text: name, value: name });
    });
    return choices;
  }

  // --- lighting ---

  private createLight(
    lightType: string,
    color: { r: number; g: number; b: number },
    intensity: number
  ): Light {
    const threeColor = new Color(color.r, color.g, color.b);

    switch (lightType) {
      case 'point': {
        const light = new PointLight(threeColor, intensity);
        light.position.set(0, 5, 0);
        return light;
      }
      case 'directional': {
        const light = new DirectionalLight(threeColor, intensity);
        light.position.set(5, 10, 7);
        return light;
      }
      case 'spot': {
        const light = new SpotLight(threeColor, intensity);
        light.position.set(0, 10, 0);
        return light;
      }
      case 'ambient':
        return new AmbientLight(threeColor, intensity);
      default:
        return new PointLight(threeColor, intensity);
    }
  }

  addLight(
    name: string,
    lightType: string,
    color: { r: number; g: number; b: number },
    intensity: number
  ): void {
    // Remove existing light with the same name
    if (this.lights.has(name)) {
      this.removeLight(name);
    }

    const light = this.createLight(lightType, color, intensity);
    light.name = name;
    this.scene.add(light);
    this.lights.set(name, light);

    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  removeLight(name: string): void {
    const light = this.lights.get(name);
    if (!light) return;

    this.scene.remove(light);
    light.dispose();
    this.lights.delete(name);

    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  setLightProperty(name: string, property: string, value: unknown): void {
    const light = this.lights.get(name);
    if (!light) return;

    switch (property) {
      case 'color': {
        const c = value as { r: number; g: number; b: number };
        light.color.setRGB(c.r, c.g, c.b);
        break;
      }
      case 'intensity':
        light.intensity = value as number;
        break;
      case 'position': {
        const p = value as { x: number; y: number; z: number };
        light.position.set(p.x, p.y, p.z);
        break;
      }
    }

    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  getLightProperty(name: string, property: string): unknown {
    const light = this.lights.get(name);
    if (!light) return undefined;

    switch (property) {
      case 'color':
        return {
          r: light.color.r,
          g: light.color.g,
          b: light.color.b
        };
      case 'intensity':
        return light.intensity;
      case 'position':
        return {
          x: light.position.x,
          y: light.position.y,
          z: light.position.z
        };
      default:
        return undefined;
    }
  }

  getLightNames(): ChoiceJSON {
    const choices: ChoiceJSON = [];
    this.lights.forEach((_light, name) => {
      choices.push({ text: name, value: name });
    });
    return choices;
  }

  // --- material ---

  setMaterialProperty(
    meshName: string,
    property: string,
    value: unknown
  ): void {
    const obj = this.objects.get(meshName);
    if (!obj) return;
    if (!(obj.material instanceof MeshPhongMaterial)) return;

    const mat = obj.material;

    switch (property) {
      case 'color': {
        const c = value as { r: number; g: number; b: number };
        mat.color.setRGB(c.r, c.g, c.b);
        break;
      }
      case 'opacity':
        mat.opacity = value as number;
        mat.transparent = mat.opacity < 1;
        break;
      case 'visible':
        mat.visible = value as boolean;
        break;
      case 'wireframe':
        mat.wireframe = value as boolean;
        break;
    }

    mat.needsUpdate = true;
    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  getMaterialProperty(meshName: string, property: string): unknown {
    const obj = this.objects.get(meshName);
    if (!obj) return undefined;
    if (!(obj.material instanceof MeshPhongMaterial)) return undefined;

    const mat = obj.material;

    switch (property) {
      case 'color':
        return { r: mat.color.r, g: mat.color.g, b: mat.color.b };
      case 'opacity':
        return mat.opacity;
      case 'visible':
        return mat.visible;
      case 'wireframe':
        return mat.wireframe;
      default:
        return undefined;
    }
  }

  // --- global click ---

  addOnAnyMeshClickedListener(callback: (meshName: string) => void): void {
    console.log(
      '[DemoScene] addOnAnyMeshClickedListener , registering listener, total:',
      this.anyMeshClickListeners.size + 1
    );
    this.anyMeshClickListeners.add(callback);
  }

  removeOnAnyMeshClickedListener(callback: (meshName: string) => void): void {
    this.anyMeshClickListeners.delete(callback);
  }

  // Trigger the "any mesh clicked" event (for testing / raycaster hookup)
  triggerAnyMeshClick(meshName: string): void {
    console.log(
      '[DemoScene] triggerAnyMeshClick:',
      meshName,
      ', listeners:',
      this.anyMeshClickListeners.size
    );
    this.anyMeshClickListeners.forEach((cb) => cb(meshName));
    // Also fire per-mesh listeners for backwards compat
    this.triggerClick(meshName);
  }

  // --- spatial helpers ---

  getMeshPosition(
    meshName: string
  ): { x: number; y: number; z: number } | undefined {
    const obj = this.objects.get(meshName);
    if (!obj) return undefined;
    return {
      x: obj.position.x,
      y: obj.position.y,
      z: obj.position.z
    };
  }

  setMeshPosition(
    meshName: string,
    position: { x: number; y: number; z: number }
  ): void {
    const obj = this.objects.get(meshName);
    if (!obj) return;
    obj.position.set(position.x, position.y, position.z);
    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  getDistanceBetween(meshA: string, meshB: string): number {
    const a = this.objects.get(meshA);
    const b = this.objects.get(meshB);
    if (!a || !b) return 0;
    return a.position.distanceTo(b.position);
  }

  lookAt(meshName: string, target: { x: number; y: number; z: number }): void {
    const obj = this.objects.get(meshName);
    if (!obj) return;
    obj.lookAt(target.x, target.y, target.z);
    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  moveTowards(
    meshName: string,
    target: { x: number; y: number; z: number },
    speed: number,
    deltaSeconds: number
  ): boolean {
    const obj = this.objects.get(meshName);
    if (!obj) return true;

    const targetVec = new Vector3(target.x, target.y, target.z);
    const direction = targetVec.clone().sub(obj.position);
    const distance = direction.length();
    const step = speed * deltaSeconds;

    if (distance <= step) {
      // Arrived
      obj.position.copy(targetVec);
      this.onSceneChanged.emit();
      this.sceneChangedListeners.forEach((listener) => listener());
      return true;
    }

    direction.normalize().multiplyScalar(step);
    obj.position.add(direction);
    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
    return false;
  }

  // --- mesh utilities ---

  cloneMesh(sourceName: string, newName: string): void {
    const source = this.objects.get(sourceName);
    if (!source) return;

    const cloned = source.clone();
    cloned.name = newName;
    this.scene.add(cloned);
    this.objects.set(newName, cloned);

    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }

  setMeshVisible(meshName: string, visible: boolean): void {
    const obj = this.objects.get(meshName);
    if (!obj) return;
    obj.visible = visible;
    this.onSceneChanged.emit();
    this.sceneChangedListeners.forEach((listener) => listener());
  }
}
