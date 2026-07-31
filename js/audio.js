/* ============================================================
 * audio.js — 程序化 WebAudio 音效合成系统
 * 无外部音频文件，全部用振荡器/噪声实时合成
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Sniper = global.Sniper || {};

  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.7;

  function ensure() {
    if (ctx) return true;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; return false; }
    return true;
  }

  // 用户首次交互后恢复 AudioContext（浏览器自动播放策略）
  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  function now() { return ctx.currentTime; }

  // 白噪声源
  function noiseBuffer(dur) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playNoise(dur, { freq = 1200, q = 0.8, gain = 0.5, type = 'lowpass', decay = dur } = {}) {
    if (!ensure()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const g = ctx.createGain();
    const t = now();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  function tone(freq, dur, { type = 'square', gain = 0.3, slide = 0, attack = 0.002 } = {}) {
    if (!ensure()) return;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    const t = now();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, freq + slide), t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // 对外音效事件
  const FX = {
    shoot() {           // 狙击枪响：低频轰鸣 + 高频脆响
      playNoise(0.16, { freq: 900, gain: 0.7, decay: 0.14 });
      tone(180, 0.18, { type: 'sawtooth', gain: 0.4, slide: -120 });
    },
    hit() {             // 命中：短促点击
      playNoise(0.06, { freq: 2400, gain: 0.4, type: 'highpass', decay: 0.06 });
      tone(520, 0.08, { type: 'square', gain: 0.25, slide: -180 });
    },
    kill() {            // 击杀：上滑确认音
      tone(300, 0.1, { type: 'square', gain: 0.28, slide: 320 });
      tone(600, 0.12, { type: 'triangle', gain: 0.22, slide: 240 });
    },
    weakKill() {        // 弱点击杀：更亮
      tone(500, 0.09, { type: 'square', gain: 0.3, slide: 500 });
      tone(900, 0.12, { type: 'triangle', gain: 0.26, slide: 420 });
    },
    miss() { playNoise(0.08, { freq: 600, gain: 0.25, decay: 0.08 }); },
    enemyFire() { playNoise(0.1, { freq: 1400, gain: 0.25, decay: 0.09 }); },
    hurt() {            // 队友受伤：低频闷响
      tone(120, 0.2, { type: 'sawtooth', gain: 0.35, slide: -60 });
      playNoise(0.1, { freq: 300, gain: 0.3, decay: 0.1 });
    },
    explosion() {       // 爆炸
      playNoise(0.5, { freq: 250, gain: 0.8, decay: 0.45 });
      tone(70, 0.4, { type: 'sine', gain: 0.5, slide: -40 });
    },
    pickup() { tone(660, 0.09, { type: 'sine', gain: 0.3, slide: 220 }); },
    ui() { tone(440, 0.06, { type: 'sine', gain: 0.18 }); },
    win() {             // 胜利琶音
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, { type: 'triangle', gain: 0.3 }), i * 90));
    },
    lose() {
      [400, 320, 240, 160].forEach((f, i) => setTimeout(() => tone(f, 0.24, { type: 'sawtooth', gain: 0.25 }), i * 110));
    },
    bossHit() { playNoise(0.12, { freq: 800, gain: 0.5, decay: 0.12 }); tone(150, 0.14, { type: 'square', gain: 0.3, slide: -80 }); },
    bossPhase() { [200, 300, 200, 300].forEach((f, i) => setTimeout(() => tone(f, 0.16, { type: 'square', gain: 0.3 }), i * 100)); },
    sniperWarn() { tone(880, 0.05, { type: 'sine', gain: 0.12 }); },  // 敌方狙击手警告tick
  };

  S.audio = {
    fx: FX,
    unlock,
    play(name) { if (muted) return; unlock(); const f = FX[name]; if (f) f(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; },
    isMuted() { return muted; },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master && !muted) master.gain.value = volume; },
    getVolume() { return volume; },
  };
})(typeof window !== 'undefined' ? window : this);
