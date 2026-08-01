/* ============================================================
 * camera-controls.js — 第一人称视角控制 + 瞄准镜缩放
 * ============================================================ */
import * as THREE from 'three';

const DEFAULT_FOV = 64;   // 镜头拉远：更大视野，战场纵深尽收眼底
// 多倍率瞄准镜：档位越低 FOV 越小（放大倍数越大）≈ 3.2x / 5.3x / 9x
const SCOPE_LEVELS = [20, 12, 7];
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
    this.scopeLevel = 1; // 开镜默认中档（8x 级）
    this._smoothFov = DEFAULT_FOV;

    // 固定狙击位（略后撤抬高，视野更舒展）
    this._pos = new THREE.Vector3(0, 4.2, 16);
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
    const targetFov = this.zooming ? SCOPE_LEVELS[this.scopeLevel] : DEFAULT_FOV;
    this._smoothFov += (targetFov - this._smoothFov) * Math.min(1, dt * 6);
    this.camera.fov = this._smoothFov;
    this.camera.updateProjectionMatrix();

    this.zoomProgress = 1 - (this._smoothFov - SCOPE_LEVELS[this.scopeLevel]) / (DEFAULT_FOV - SCOPE_LEVELS[this.scopeLevel]);
  }

  /** 滚轮跳档：delta=+1 放大（升倍率），delta=-1 缩小；返回当前倍率档位 */
  cycleScope(delta) {
    const next = Math.max(0, Math.min(SCOPE_LEVELS.length - 1, this.scopeLevel - delta));
    this.scopeLevel = next;
    return next;
  }

  /** 当前放大倍数（相对默认 FOV） */
  getScopeMagnification() {
    if (!this.zooming) return 1;
    return DEFAULT_FOV / SCOPE_LEVELS[this.scopeLevel];
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
