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
      if (e.button === 2) { this.zoom = true; }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.shooting = false;
      if (e.button === 2) this.zoom = false;
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.zoom = true;
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
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.zoom = false;
    });
  }

  consumeShoot() {
    const v = this.shootBuffer;
    this.shootBuffer = false;
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
}
