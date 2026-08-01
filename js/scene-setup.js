/* ============================================================
 * scene-setup.js — Three.js 场景/渲染器/光照
 * ============================================================ */
import * as THREE from 'three';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b14); // 夜景深空
  scene.fog = new THREE.Fog(0x070b14, 50, 110); // 幽深夜雾

  // Camera — first person, fixed at sniper nest
  const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(0, 4.2, 16);
  camera.lookAt(0, 0, -20);
  // 关键：将 camera 加入 scene，挂在 camera 上的第一人称枪管模型才会被渲染
  scene.add(camera);

  // Lighting — 夜景月光氛围
  const ambient = new THREE.AmbientLight(0x3a4a6a, 0.32);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x4a6a9a, 0x1a1220, 0.34);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xb0c4ff, 1.05); // 冷月光
  sun.position.set(20, 30, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -10;
  scene.add(sun);

  // 冷色补光（天光反射）
  const fill = new THREE.DirectionalLight(0x4058ff, 0.22);
  fill.position.set(-10, 10, 10);
  scene.add(fill);

  // 暖色地光（远处地表细微余晖）
  const warm = new THREE.DirectionalLight(0xff7733, 0.12);
  warm.position.set(5, -4, -20);
  scene.add(warm);

  // Resize handler
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return { scene, camera, renderer, onResize };
}
