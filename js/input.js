/* ============================================================
 * input.js — 鼠标/键盘输入管理
 * 维护点击、右键开镜、十字线位置、数字键切关等状态
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Sniper = global.Sniper || {};

  function Input(canvas) {
    this.canvas = canvas;
    this.mouse = { x: 0, y: 0, inCanvas: false };
    this.zoom = false;      // 右键开镜
    this.shooting = false;  // 按住鼠标左键
    this.shootBuffer = false; // 本帧是否有点击待发射
    this.keys = {};
    this.attached = false;
  }

  Input.prototype.attach = function () {
    if (this.attached) return;
    const self = this;
    const c = this.canvas;

    const toCanvasXY = (e) => {
      const rect = c.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    c.addEventListener('mousemove', (e) => {
      const p = toCanvasXY(e);
      self.mouse.x = p.x; self.mouse.y = p.y; self.mouse.inCanvas = true;
      e.preventDefault();
    });
    c.addEventListener('mouseleave', () => { self.mouse.inCanvas = false; });

    c.addEventListener('mousedown', (e) => {
      const p = toCanvasXY(e);
      self.mouse.x = p.x; self.mouse.y = p.y; self.mouse.inCanvas = true;
      if (e.button === 0) { self.shootBuffer = true; self.shooting = true; }
      else if (e.button === 2) { self.zoom = true; }
      e.preventDefault();
    });
    c.addEventListener('mouseup', (e) => {
      if (e.button === 0) self.shooting = false;
      else if (e.button === 2) self.zoom = false;
      e.preventDefault();
    });
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); });

    window.addEventListener('keydown', (e) => {
      self.keys[e.code] = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') self.zoom = true;
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      self.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') self.zoom = false;
    });

    this.attached = true;
  };

  Input.prototype.consumeShoot = function () {
    const v = this.shootBuffer;
    this.shootBuffer = false;
    return v;
  };

  S.Input = Input;
})(typeof window !== 'undefined' ? window : this);
