#!/usr/bin/env node
/* ============================================================
 * headless-screenshot-test.js — Chrome headless 关卡回归用例
 *
 * 用途：自动化验证游戏渲染管线与关卡生成，防"关卡空白/菜单遮罩/运行时异常"回归。
 * 原理：
 *   1. 生成探针 HTML：在 main.js 前注入探针模块（捕获带堆栈的 JS 错误、
 *      劫持 THREE.Object3D.add 拿到 scene 实例），并自动驱动
 *      菜单→选关→进入第1关 的完整真实 UI 路径；
 *   2. 经本地 HTTP 服务器加载（ES module 不能用 file://），Chrome headless 截图 + dump DOM；
 *   3. 判据：无 JS 运行时错误 + 场景内存在队友与敌人 + 无菜单遮罩残留 + 截图非空白。
 *
 * 运行：node headless-screenshot-test.js
 * 依赖：本机装有 Google Chrome（路径可经 CHROME_PATH 环境变量覆盖）；
 *       优先复用 localhost:8080 服务器，未运行则临时启动 python3 http.server。
 * 退出码：0=通过，1=失败（可接入 CI）
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawn, execSync } = require('child_process');

const ROOT = __dirname;
const CHROME = process.env.CHROME_PATH
  || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
       .find(p => fs.existsSync(p));

if (!CHROME) {
  console.error('❌ 未找到 Google Chrome，无法执行截图回归。请安装 Chrome 或设置 CHROME_PATH。');
  process.exit(1);
}

const PROBE_HTML = path.join(ROOT, '__probe.html');
const SHOT_PNG = path.join(ROOT, '__probe_shot.png');

// ---------- 生成探针 HTML ----------
function makeProbe() {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // 探针模块必须在 main.js 之前执行：共享同一个 three 模块实例，
  // 劫持 Object3D.add 捕获 scene；同时注册错误捕获。
  const probe = `
<script type="module">
import * as THREE from 'three';

// ---------- 错误捕获 ----------
window.__errs = [];
window.addEventListener('error', function(e){
  var stk = (e.error && e.error.stack) ? String(e.error.stack).split('\\n').slice(0,3).join(' <- ') : '';
  window.__errs.push((e.message || 'err') + (stk ? ' | ' + stk : ''));
});
window.addEventListener('unhandledrejection', function(e){
  window.__errs.push('promise: ' + ((e.reason && e.reason.message) || e.reason));
});

// ---------- 解锁全部关卡（全关卡通检） ----------
try { localStorage.setItem('sniper3d_unlocked', '8'); } catch (e) {}

// ---------- patch pointer lock（headless 无真实用户手势） ----------
function __setLock(el){
  Object.defineProperty(document, 'pointerLockElement', { get: function(){ return el; }, configurable: true });
  document.dispatchEvent(new Event('pointerlockchange'));
}
Element.prototype.requestPointerLock = function(){ __setLock(this); };
document.exitPointerLock = function(){ __setLock(null); };

// ---------- 捕获 scene 实例（与 main.js 共享 three 模块） ----------
var origAdd = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function(){
  if (this.isScene && !window.__scene) window.__scene = this;
  return origAdd.apply(this, arguments);
};

// ---------- 观测点：rAF 帧数 / 右键事件到达计数 ----------
// headless 虚拟时间模式会节流 rAF（页面视为 hidden），导致 update 循环停摆；
// 桥接为 setTimeout(16ms) 驱动，虚拟时钟下计时器照常快进，语义等价真实 60fps
window.__rafCount = 0;
window.requestAnimationFrame = function(cb){
  window.__rafCount++;
  return setTimeout(function(){ cb(performance.now()); }, 16);
};
window.__mdRight = 0;
document.addEventListener('mousedown', function(e){ if (e.button === 2) window.__mdRight++; });

// ---------- 场景统计 ----------
function sceneStats(){
  var info = { ally: 0, enemies: [], meshes: 0 };
  var s = window.__scene;
  if (s) {
    s.traverse(function(o){
      if (o.isMesh) info.meshes++;
      if (o.userData && o.userData.colorKey === 'ally') info.ally++;
      if (o.userData && o.userData.enemyRef) info.enemies.push(o.userData.enemyRef.kind);
    });
  }
  info.hudEnemy = (document.getElementById('hudEnemy')||{}).textContent || '';
  info.visibleScreens = Array.prototype.slice.call(document.querySelectorAll('.screen'))
    .filter(function(x){ return x.classList.contains('show'); }).map(function(x){ return x.id; });
  return info;
}

function rclick(){ document.dispatchEvent(new MouseEvent('mousedown', { button: 2 })); }

// ---------- 驱动：全关卡通检 + 右键 toggle 开/关镜验证 ----------
function drive(){
  var start = document.getElementById('btnStart');
  if (!start) { setTimeout(drive, 200); return; }
  start.click();
  setTimeout(function(){
    var cards = document.querySelectorAll('.levelCard');
    var results = [];
    var i = 0;
    function nextLevel(){
      if (i >= cards.length) { zoomTest(); return; }
      var card = cards[i];
      i++;
      card.click(); // 程序点击不受遮罩可见性限制，直接复用 main.js 事件委托
      setTimeout(function(){
        var st = sceneStats();
        st.level = i;
        results.push(st);
        nextLevel();
      }, 700);
    }
    function zoomTest(){
      // 当前处于最后一关 playing 状态，pointer lock 已 patch 成功
      var overlay = document.getElementById('scope-overlay');
      var diag = {
        lockEl: document.pointerLockElement ? document.pointerLockElement.id : null,
        pauseTip: (document.getElementById('pauseTip')||{style:{}}).style.display,
        raf: window.__rafCount,
        mdRightBefore: window.__mdRight,
      };
      rclick(); // 第1次右键：应开镜
      setTimeout(function(){
        var zoomOn = overlay.classList.contains('active');
        rclick(); // 第2次右键：应关镜
        setTimeout(function(){
          var zoomOff = !overlay.classList.contains('active');
          diag.mdRightAfter = window.__mdRight;
          diag.rafAfter = window.__rafCount;
          emit(results, zoomOn, zoomOff, diag);
        }, 500);
      }, 500);
    }
    nextLevel();
  }, 400);
}

function emit(results, zoomOn, zoomOff, diag){
  var pre = document.createElement('pre');
  pre.id = '__probe_final';
  pre.textContent = 'PROBE_JSON_BEGIN' + JSON.stringify({
    levels: results, zoomOn: zoomOn, zoomOff: zoomOff, diag: diag, errs: window.__errs
  }) + 'PROBE_JSON_END';
  document.body.appendChild(pre);
}

setTimeout(drive, 1200);
</scr` + `ipt>`;
  return index.replace('<script type="module" src="js/main.js"></script>', probe + '\n  <script type="module" src="js/main.js"></script>');
}

// ---------- 服务器：复用 8080，否则临时启动 ----------
function ensureServer() {
  try {
    execSync('curl -s -o /dev/null -m 2 http://localhost:8080/index.html');
    return { url: 'http://localhost:8080', proc: null };
  } catch (e) { /* 8080 未运行 */ }
  const port = 8123;
  const proc = spawn('python3', ['-m', 'http.server', String(port)], { cwd: ROOT, stdio: 'ignore' });
  execSync('for i in $(seq 1 30); do curl -s -o /dev/null -m 1 http://localhost:' + port + '/index.html && break; sleep 0.2; done');
  return { url: 'http://localhost:' + port, proc };
}

// ---------- 主流程 ----------
function run() {
  fs.writeFileSync(PROBE_HTML, makeProbe(), 'utf8');
  const server = ensureServer();

  let dom = '';
  try {
    dom = execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      // SwiftShader 软件渲染：headless 无 GPU 也能创建 WebGL 上下文，
      // 否则 createScene 抛错导致整个游戏模块不执行，探针失明
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--screenshot=' + SHOT_PNG,
      '--window-size=800,450',
      '--virtual-time-budget=15000',
      '--dump-dom',
      server.url + '/__probe.html',
    ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }).toString('utf8');
  } catch (e) {
    dom = (e.stdout && e.stdout.toString('utf8')) || '';
  } finally {
    if (server.proc) server.proc.kill();
  }

  // 提取探针 JSON（DOM 序列化后引号被转义为 &quot;）
  // 注意：探针脚本源码本身也含 PROBE_JSON_BEGIN/END 字面量，需全局匹配所有候选，
  // 取第一个能成功 JSON.parse 的（源码候选会 parse 失败被跳过）
  let info = null;
  const candidates = dom.match(/PROBE_JSON_BEGIN[\s\S]*?PROBE_JSON_END/g) || [];
  for (const c of candidates) {
    const raw = c.slice('PROBE_JSON_BEGIN'.length, -'PROBE_JSON_END'.length)
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    try { info = JSON.parse(raw); break; } catch (e) { /* 源码候选，跳过 */ }
  }

  const shotSize = fs.existsSync(SHOT_PNG) ? fs.statSync(SHOT_PNG).size : 0;
  console.log('📸 截图字节数:', shotSize);
  if (!info) {
    console.log('  ❌ 探针未返回数据（页面未加载或 main.js 未执行）');
    cleanup();
    process.exit(1);
  }

  // headless 环境特有可忽略错误：无真实用户手势导致 pointer lock / 音频策略拒绝
  const IGNORABLE = /pointer ?lock|SecurityError|AudioContext|user gesture|permissions policy/i;
  const realErrs = (info.errs || []).filter(e => !IGNORABLE.test(e));

  (info.levels || []).forEach(l => {
    console.log('   [关卡' + l.level + '] mesh:' + l.meshes + ' 队友:' + l.ally +
      ' 敌人:[' + (l.enemies || []).join(',') + '] HUD:' + l.hudEnemy +
      ' 遮罩:' + JSON.stringify(l.visibleScreens));
  });
  console.log('   [右键toggle] 第1次点击开镜:', info.zoomOn, '| 第2次点击关镜:', info.zoomOff);
  if (info.diag) console.log('   [诊断] lockEl:', info.diag.lockEl, '| pauseTip:', JSON.stringify(info.diag.pauseTip),
    '| rAF:', info.diag.raf, '→', info.diag.rafAfter, '| 右键到达:', info.diag.mdRightBefore, '→', info.diag.mdRightAfter);
  if (realErrs.length) console.log('   [JS错误]\n   - ' + realErrs.join('\n   - '));
  if ((info.errs || []).length > realErrs.length) console.log('   [已忽略-headless特有]', (info.errs || []).filter(e => IGNORABLE.test(e)).join(' | '));

  const levels = info.levels || [];
  const emptyLevels = levels.filter(l => l.ally < 1 || (l.enemies || []).length < 1);
  const masked = levels.filter(l => (l.visibleScreens || []).length > 0);
  const checks = [
    { name: '无JS运行时错误', ok: realErrs.length === 0 },
    { name: '全关卡(8关)探针覆盖', ok: levels.length >= 8 },
    { name: '每关均有队友与敌人（空关卡:' + (emptyLevels.map(l => l.level).join(',') || '无') + '）', ok: levels.length >= 8 && emptyLevels.length === 0 },
    { name: '无菜单/结算遮罩残留', ok: masked.length === 0 },
    { name: '右键点击1次开启瞄准镜', ok: info.zoomOn === true },
    { name: '右键再点1次取消瞄准镜', ok: info.zoomOff === true },
    { name: '截图像素内容丰富(≥4000B，防空白/静止)', ok: shotSize >= 4000 },
  ];
  const failed = checks.filter(c => !c.ok);
  checks.forEach(c => console.log((c.ok ? '  ✅' : '  ❌') + ' ' + c.name));

  cleanup();
  process.exit(failed.length ? 1 : 0);
}

function cleanup() {
  try { fs.unlinkSync(PROBE_HTML); } catch (e) {}
  try { fs.unlinkSync(SHOT_PNG); } catch (e) {}
}

run();
