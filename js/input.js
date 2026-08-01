/* ============================================================
 * input.js — 3D 鼠标/键盘输入管理
 * ============================================================ */
import * as THREE from 'three';

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = new THREE.Vector2();
    this.shooting = false;
    this.zoom = false;
    this.shootBuffer = false;
    this.pointerLocked = false;
    this.keys = {};
    this.scopeDelta = 0; // 滚轮跳档缓冲（正=放大，负=缩小）
    this._onShoot = null;
    this._onZoom = null;
    this._onPause = null;
    this._attach();
  }

  _attach() {
    const c = this.canvas;
    
    c.addEventListener('click', () => {
      if (!this.pointerLocked) {
        c.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === c;
      if (!this.pointerLocked && this._onPause) {
        this._onPause();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouse.x += e.movementX;
        this.mouse.y += e.movementY;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked) return;
      if (e.button === 0) { this.shootBuffer = true; this.shooting = true; }
      if (e.button === 2) { this.zoom = !this.zoom; } // 右键点击切换开/关镜
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.shooting = false;
    });

    document.addEventListener('wheel', (e) => {
      if (!this.pointerLocked) return;
      // 开镜时滚轮跳放大倍数
      if (e.deltaY < 0) this.scopeDelta += 1;  // 滚上 → 放大
      else if (e.deltaY > 0) this.scopeDelta -= 1; // 滚下 → 缩小
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Escape' && this.pointerLocked) {
        document.exitPointerLock();
      }
      if (e.code === 'KeyP' && this._onPause) {
        this._onPause();
      }
      if (e.code === 'Space') this.shootBuffer = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  consumeShoot() {
    const v = this.shootBuffer;
    this.shootBuffer = false;
    return v;
  }

  /** 消费滚轮跳档缓冲（返回累计 delta，清空） */
  consumeScopeDelta() {
    const v = this.scopeDelta;
    this.scopeDelta = 0;
    return v;
  }

  onShoot(cb) { this._onShoot = cb; }
  onZoom(cb) { this._onZoom = cb; }
  onPause(cb) { this._onPause = cb; }

  lockPointer() {
    if (!this.pointerLocked) {
      this.canvas.requestPointerLock();
    }
  }

  unlockPointer() {
    if (this.pointerLocked) {
      document.exitPointerLock();
    }
  }

  /** 复位开镜状态（关卡切换/结算时调用） */
  resetZoom() { this.zoom = false; }
}
