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
  scene.background = new THREE.Color(0x1a2a4a);
  scene.fog = new THREE.Fog(0x1a2a4a, 40, 80);

  // Camera — first person, fixed at sniper nest
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 3.8, 15);
  camera.lookAt(0, 0, -20);

  // Lighting
  const ambient = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362d1a, 0.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffeedd, 1.8);
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

  const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
  fill.position.set(-10, 10, 10);
  scene.add(fill);

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
