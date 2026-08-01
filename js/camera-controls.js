/* ============================================================
 * camera-controls.js — 第一人称视角控制 + 瞄准镜缩放
 * ============================================================ */
import * as THREE from 'three';

const DEFAULT_FOV = 50;
const SCOPE_FOV = 8;
const SENSITIVITY = 0.002;
const PITCH_LIMIT = Math.PI * 0.45;

export class CameraControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.isLocked = false;
    this.yaw = 0;
    this.pitch = -0.15;
    this.zooming = false;
    this.zoomProgress = 0; // 0~1
    this.breathTime = 0;
    this._smoothFov = DEFAULT_FOV;

    // 固定狙击位
    this._pos = new THREE.Vector3(0, 3.8, 15);
    this.camera.position.copy(this._pos);
  }

  update(dt) {
    // 呼吸晃动（微小的准星自然晃动）
    this.breathTime += dt;
    const breath = this.zooming ? 0.0004 : 0.001;
    const bx = Math.sin(this.breathTime * 1.7) * breath;
    const by = Math.cos(this.breathTime * 2.3) * breath;

    // 应用视角旋转
    const euler = new THREE.Euler(
      this.pitch + by,
      this.yaw + bx,
      0,
      'YXZ'
    );
    this.camera.quaternion.setFromEuler(euler);
    this.camera.position.copy(this._pos);

    // 平滑FOV过渡
    const targetFov = this.zooming ? SCOPE_FOV : DEFAULT_FOV;
    this._smoothFov += (targetFov - this._smoothFov) * Math.min(1, dt * 6);
    this.camera.fov = this._smoothFov;
    this.camera.updateProjectionMatrix();

    this.zoomProgress = 1 - (this._smoothFov - SCOPE_FOV) / (DEFAULT_FOV - SCOPE_FOV);
  }

  /** 鼠标移动增量（开镜时灵敏度随 FOV 比例降低，便于精细调整） */
  rotate(dx, dy) {
    if (!this.isLocked) return;
    const sens = SENSITIVITY * (this._smoothFov / DEFAULT_FOV);
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  }

  setZoom(active) {
    this.zooming = active;
  }

  getFov() { return this._smoothFov; }

  /** 获取瞄准方向向量 */
  getAimDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  /** 获取瞄准起点 */
  getAimOrigin() {
    return this.camera.position.clone();
  }

  /** 重置视角 */
  reset() {
    this.yaw = 0;
    this.pitch = -0.15;
    this.zooming = false;
    this._smoothFov = DEFAULT_FOV;
    this.camera.fov = DEFAULT_FOV;
    this.camera.position.copy(this._pos);
    this.camera.updateProjectionMatrix();
  }
}
