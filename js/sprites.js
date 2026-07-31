/* ============================================================
 * sprites.js — 程序化像素风卡通形象生成器
 * 通过离屏 Canvas 绘制小尺寸图形并放大（像素风）
 * ============================================================ */
(function (global) {
  'use strict';

  const S = global.Sniper = global.Sniper || {};

  // 创建一个像素画布的辅助函数
  function pixelCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // 把 2D 像素数组绘制到画布 —— 每个像素一格
  // data: {w, h, palette, pixels} pixels 为字符串数组，字符->调色板颜色
  function drawFromMap(canvas, map, scale) {
    const ctx = canvas.getContext('2d');
    const px = scale || 1;
    canvas.width = map.w * px;
    canvas.height = map.h * px;
    if (scale) ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const ch = map.pixels[y][x];
        if (!ch || ch === '.') continue;
        const col = map.palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * px, y * px, px, px);
      }
    }
    return canvas;
  }

  // ============ 像素地图定义 ============

  // 干练的作战小队战士（背包+头盔）  敌人采用不同配色
  function fighterMap() {
    return {
      w: 10, h: 14,
      palette: {
        'S': '#2f3640', // 皮肤
        'K': '#e8b16c', // 头
        'H': '#4a5568', // 头盔
        'B': '#718096', // 靴
        'V': '#2980b9', // 主衣敌人蓝
        'G': '#3f7d44', // 主衣队友绿
        'A': '#2c3e50', // 深色
        'W': '#ffffff',
        'O': '#e6a23c', // 枪/配饰
      },
      pixels: [
        '..........',
        '..HHHHHH..',
        '.HHHHHHHH.',
        '.HKKKKKKH.',
        '.HKKKKKKH.',
        '..KSSSSK..',
        '..KSSSSK..',
        '..KKKKKK..',
        '..GGGGGG..',
        '.GGGGGGGG.',
        '.GGGGGGGG.',
        '.GG.AAGG..',
        '..BB..BB..',
        '.BB....BB.',
      ],
    };
  }

  // 敌人(红系) —— 与队友共用骨架改色
  function enemyMap() {
    const m = fighterMap();
    m.palette['V'] = '#c0392b';
    m.palette['G'] = '#c0392b';
    m.palette['A'] = '#7b241c';
    m.palette['H'] = '#922b21';
    return m;
  }

  // 重型敌人（更多生命）
  function heavyEnemyMap() {
    const m = fighterMap();
    m.palette['V'] = '#e74c3c';
    m.palette['G'] = '#e74c3c';
    m.palette['A'] = '#4a0000';
    m.palette['H'] = '#a93226';
    // 更壮，加宽
    m.w = 12;
    m.pixels.forEach((row, i) => {
      m.pixels[i] = '..' + row + '..';
    });
    return m;
  }

  // Boss 机甲 —— 巨大人形机甲
  function bossMap() {
    return {
      w: 22, h: 26,
      palette: {
        'D': '#1c1c1c',  // 机身主暗
        'R': '#8a2be2',  // 能量紫
        'R2': '#c026d3', // 亮紫
        'A': '#6b6b6b',  // 金属灰/装甲
        'L': '#22c55e',  // 发光
        'Y': '#facc15',  // 眼睛
        'O': '#f97316',  // 警示
      },
      pixels: [
        '......................',
        '......DRRRRRRRRD......',
        '.....DRR........RRD...',
        '....DR...........RD...',
        '....DR..YY...YY..RD...',
        '....DR..YY...YY..RD...',
        '....DR...........RD...',
        '.....DRRRRRRRRRRRD....',
        '......DAAAAaaaAAD.....',
        '.....DAALAAaaAAaAD....',
        '....DAAALAAaaAAAaAD...',
        '...DRAAAAAAaaAAAAARD..',
        '...DR..AAA..AA..ARD...',
        '..DRR..AAA..AA..RRD...',
        '..RR...AAA..AA...RR...',
        '..RR..DAA....AA..RR...',
        '.RRR.DDAA....AADDRRR..',
        '.RR.DD.AA..AA.AA.DRR..',
        '.RR.D..AA..AA..A.DRR..',
        '.RR.....AA..AA....RR..',
        '.RR....AAA..AAA...RR..',
        '.RR...DAAAA..AAA.DRR..',
        '..R..DDDAA..AAADDD.R..',
        '..RRDDD.AAAAAAADDD.RR.',
        '...OOOOO.OOOOO.OOOOO..',
        '..........OOOO........',
      ],
    };
  }

  // 掩体（沙袋/铁桶/墙）
  function barrierMap(type) {
    if (type === 'sandbag') {
      return {
        w: 18, h: 6,
        palette: { 'T': '#c2a06a', 'T2': '#a9865a', '.': '' },
        pixels: [
          'TTTTTTTTTTTTTTTTTT',
          'TTTTTTTTTTTTTTTTTT',
          'TTTTTTTTTTTTTTTTTT',
          'T2TT2TT2TT2TT2TT2T',
          'TT2TT2TT2TT2TT2TT2',
          '.T2TT2TT2TT2TT2TT.',
        ],
      };
    }
    if (type === 'barrel') {
      return {
        w: 8, h: 10,
        palette: { 'O': '#e67e22', 'G': '#95a5a6', 'D': '#7f8c8d' },
        pixels: [
          '.DDDD.',
          'DOOOOD',
          'DOOOOD',
          'DOOOOD',
          'DOOOOD',
          'DOOOOD',
          'DOOOOD',
          'DGGGGD',
          '.DDDD.',
          '......',
        ],
      };
    }
    // crate 木箱
    return {
      w: 12, h: 8,
      palette: { 'W': '#c08a4e', 'W2': '#a06e36', 'D': '#7a5427' },
      pixels: [
        'WWWWWWWWWWWW',
        'WWWWWWWWWWWW',
        'WWWWWWWWWWWW',
        'WWWDWWWWWDWW',
        'WWWWWWWWWWWW',
        'WWWWWDWWWWWW',
        'WWWWWWWWWWWW',
        'DDDDDDDDDDDD',
      ],
    };
  }

  // 战场地面草/土
  function groundMap() {
    return {
      w: 12, h: 3,
      palette: { 'G': '#789b5a', 'G2': '#6b8f4e', 'E': '#b5c97a' },
      pixels: [
        'GGGGGGGGGGGG',
        'GGEGGGEGGGGG',
        'GGGGGGGGEGGG',
      ],
    };
  }

  // ============ 对外 API ============
  S.sprites = {
    pixelCanvas,
    drawFromMap,
    // 返回已放大渲染的 canvas 图像
    fighter(colorKey) {
      const map = colorKey === 'enemy' ? enemyMap() :
                  colorKey === 'heavy' ? heavyEnemyMap() : fighterMap();
      const c = pixelCanvas(map.w, map.h);
      drawFromMap(c, map, 1);
      return c;
    },
    boss() {
      const c = pixelCanvas(bossMap().w, bossMap().h);
      drawFromMap(c, bossMap(), 1);
      return c;
    },
    barrier(type) {
      const c = pixelCanvas(12, 8);
      drawFromMap(c, barrierMap(type), 1);
      return c;
    },
    ground() {
      const c = pixelCanvas(12, 3);
      drawFromMap(c, groundMap(), 1);
      return c;
    },
    // 构造放大版（sprite 用，返回 canvas 或多倍放大）
    scaled(mapOrCanvas, scale) {
      const m = typeof mapOrCanvas === 'object' && mapOrCanvas.pixels ? mapOrCanvas : null;
      const c = pixelCanvas(1, 1);
      if (m) drawFromMap(c, m, scale);
      else {
        c.width = mapOrCanvas.width;
        c.height = mapOrCanvas.height;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(mapOrCanvas, 0, 0, c.width * scale, c.height * scale);
      }
      return c;
    },
    maps: { fighterMap, enemyMap, heavyEnemyMap, bossMap, barrierMap, groundMap },
  };
})(typeof window !== 'undefined' ? window : this);
