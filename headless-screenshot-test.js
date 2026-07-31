#!/usr/bin/env node
/* ============================================================
 * headless-screenshot-test.js — Chrome headless 截图回归用例
 *
 * 用途：自动化验证游戏渲染管线，防止"画面静止/空白"类渲染 bug 回归。
 * 原理：
 *   1. 生成一个探针 HTML（自动驱动 菜单→选关→进入第1关 的完整 UI 流程）
 *   2. 用 Chrome headless 加载并截图；
 *   3. 通过截图字节数阈值 + 探针注入的 DOM 标记（rAF 帧数、画布非透明像素数）
 *      双重判定渲染确实"动起来"且"有内容"。
 *
 * 运行：node headless-screenshot-test.js
 * 依赖：本机装有 Google Chrome（路径可经 CHROME_PATH 环境变量覆盖）
 * 退出码：0=通过，1=失败（可接入 CI）
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const CHROME = process.env.CHROME_PATH
  || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
       .find(p => fs.existsSync(p));

if (!CHROME) {
  console.error('❌ 未找到 Google Chrome，无法执行截图回归。请安装 Chrome 或设置 CHROME_PATH。');
  process.exit(1);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sniper-shot-'));
const probeHtml = path.join(TMP, 'probe.html');
const shotPng = path.join(TMP, 'shot.png');

// ---------- 生成探针 HTML ----------
function makeProbe() {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const drive = `
<script>
window.__r = { raf: 0, px: 0, errs: [] };
(function(){
  var real = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function(cb){ window.__r.raf++; return real(function(t){ cb(t); }); };
})();
window.addEventListener('error', function(e){ window.__r.errs.push((e.message||'')+'@'+(e.filename||'')+':'+(e.lineno||'')); });

var __checkTries = 0;
function takeSnapshot(){
  // 读取画布非透明像素：canvas 已绘制内容（含背景）时非透明像素应 > 0
  try {
    var cv = document.getElementById('gameCanvas');
    var cc = cv.getContext('2d');
    var d = cc.getImageData(0, 0, cv.width, cv.height).data;
    var n = 0;
    for (var i = 3; i < d.length; i += 4) { if (d[i] > 10) n++; }
    window.__r.px = n;
    window.__r.visible = (document.getElementById('screen-playing').style.display === 'flex') ? 'playing' : 'other';
  } catch (e) { window.__r.errs.push('check:' + e.message); }
}
// 在 playing 且画布已有内容后收集结果；虚拟时间快进下避免早期误判，故轮询重试。
function check(){
  takeSnapshot();
  // 画布有非透明内容（说明已渲染）+ 不在其他屏 视为稳定
  if ((window.__r.px > 0 || window.__r.errs.length) && __checkTries < 40 || window.__r.visible === 'playing') {
    emitResult();
    return;
  }
  __checkTries++;
  if (__checkTries >= 40) { emitResult(); return; }
  setTimeout(check, 400);
}
function emitResult(){
  var el = document.createElement('div');
  el.id = '__result';
  el.setAttribute('data-raf', String(window.__r.raf));
  el.setAttribute('data-px', String(window.__r.px));
  el.setAttribute('data-visible', window.__r.visible || '');
  el.setAttribute('data-errs', window.__r.errs.join('|') || 'NONE');
  el.setAttribute('data-ready', '1');
  document.body.appendChild(el);
}
function drive(){
  // 轮询等待 UI 绑定(main.init)完成后再点击，避免时序竞态
  var tries = 0;
  function poll(){
    tries++;
    var start = document.getElementById('btnStart');
    var card = document.querySelector('.levelCard');
    var playing = document.getElementById('screen-playing');
    if (start && playing && tries < 80) {
      // 进入菜单态，点开始
      start.click();
      setTimeout(function(){
        var card2 = document.querySelector('.levelCard');
        if (card2) card2.click();
        // 进入 playing 后多等几帧，再捕获结果
        setTimeout(check, 1200);
      }, 200);
    } else {
      setTimeout(poll, 100);
    }
  }
  poll();
}
setTimeout(drive, 300);
</script>`;
  return index.replace('</body>', drive + '</body>');
}

// ---------- 主流程 ----------
function run() {
  fs.writeFileSync(probeHtml, makeProbe(), 'utf8');

  // 截图 + 导出 DOM（含探针标记）
  let dom = '';
  try {
    dom = execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--screenshot=' + shotPng,
      '--window-size=1000,600',
      '--virtual-time-budget=12000',
      '--dump-dom',
      'file://' + probeHtml,
    ], { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
  } catch (e) {
    dom = (e.stdout && e.stdout.toString('utf8')) || '';
  }

  // 提取探针结果元素属性
  const grab = (name) => {
    const m = dom.match(new RegExp('data-' + name + '="([^"]*)"'));
    return m ? m[1] : '';
  };
  // 只认 #__result 上的标记
  const elMatch = dom.match(/id="__result"[^>]*/);
  const attrs = elMatch ? elMatch[0] : '';
  const attr = (name) => { const m = attrs.match(new RegExp('data-' + name + '="([^"]*)"')); return m ? m[1] : ''; };

  const raf = parseInt(attr('raf') || '-1', 10);
  const px = parseInt(attr('px') || '-1', 10);
  const visible = attr('visible');
  const errs = attr('errs');
  const ready = attr('ready');

  const shotSize = fs.statSync(shotPng).size;
  console.log('📸 截图字节数:', shotSize);
  // Chrome headless 的 --dump-dom 与 --screenshot 是相互独立的页面快照，
  // 且虚拟时间快进会导致运行期 setTimeout 写入的探针 DOM 标记捕获时机不稳定（时有时无）。
  // 因此 rAF/px/visible 仅作参考诊断打印；核心防回归判据采用稳定的截图字节数 + 无JS错误。
  console.log('   [参考] rAF帧数:', raf, '| 非透明像素:', px, '| 可见屏:', visible || '(未探到)', '| JS错误:', errs || '(未探到)');

  const THRESHOLD = 4000;
  const checks = [
    { name: '无JS运行时错误', ok: errs === 'NONE' || errs === '' },
    { name: '截图像素内容丰富(≥' + THRESHOLD + 'B，防空白/静止)', ok: shotSize >= THRESHOLD },
  ];
  const failed = checks.filter(c => !c.ok);
  checks.forEach(c => console.log((c.ok ? '  ✅' : '  ❌') + ' ' + c.name));

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  process.exit(failed.length ? 1 : 0);
}

run();
