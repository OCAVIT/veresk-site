// Ночной лес за окном вагона: берёзы, ельник, снег, Берёзовый Смотритель с зелёными фонарями.
// Курсор (или палец) — это фонарь: тёплый свет выхватывает деревья и снег. Если долго светить на Смотрителя,
// «глаз» в углу открывается, фонари вспыхивают, и он уходит за деревья. Сцена декоративная (canvas aria-hidden).
(() => {
  'use strict';

  const win = document.querySelector('[data-window]');
  const canvas = document.getElementById('night');
  if (!win || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const eye = document.querySelector('[data-eye]');
  const shutter = document.querySelector('[data-shutter]');
  const whisper = document.querySelector('[data-whisper]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const MOON = { bark: '#a7b6c4', shade: '#56697d', mark: '#0b1727', twig: '#1a2b40', fog: '#173452' };
  const LAMP = { bark: '#f8e8c8', shade: '#bd8a4f', mark: '#26170b', twig: '#4a3018', fog: '#7a5a34' };

  let W = 0, H = 0, dpr = 1, horizon = 0, scale = 1, mobile = false;
  let back, front, litBack, litFront, temp, tctx, glow;
  let ridge = [], mids = [], nears = [], stars = [], flakes = [];
  const light = { x: 0, y: 0, tx: 0, ty: 0, r: 160, dim: false, pointerAt: -10 };
  const warden = { slots: [], slot: 0, x: 0, fade: 1, target: 1, noticed: 0, seenUntil: 0, height: 0, marks: [], lanterns: [] };
  let running = false, visible = true, last = 0, time = 0;

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, k) {
    const x = hex(a), y = hex(b);
    return `rgb(${Math.round(x[0] + (y[0] - x[0]) * k)},${Math.round(x[1] + (y[1] - x[1]) * k)},${Math.round(x[2] + (y[2] - x[2]) * k)})`;
  }

  const HIDDEN = { bark: mix(MOON.bark, MOON.fog, 0.5), shade: mix(MOON.shade, MOON.fog, 0.45), mark: mix(MOON.mark, MOON.fog, 0.3), twig: MOON.twig };

  function layer() {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * dpr));
    c.height = Math.max(1, Math.round(H * dpr));
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [c, x];
  }

  // ---------- раскладка сцены (одна и та же для лунного и «фонарного» слоя) ----------

  function birch(r, x, w, bottom, depth) {
    const marks = [];
    for (let y = -10 + r() * 20; y < bottom; y += (7 + r() * 24) * (0.55 + w / 34)) {
      const len = w * (0.25 + r() * 0.65);
      marks.push([y, (r() - 0.5) * (w - len), len, 1 + r() * 2.4 * Math.min(2, w / 12)]);
    }
    const knots = [];
    for (let i = 0, n = Math.floor(r() * 3); i < n; i++) {
      knots.push([bottom * (0.25 + r() * 0.65), (r() - 0.5) * w * 0.4, w * (0.35 + r() * 0.35)]);
    }
    const twigs = [];
    for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
      twigs.push([bottom * (0.05 + r() * 0.35), r() < 0.5 ? -1 : 1, (16 + r() * 50) * scale, 0.5 + r() * 0.7]);
    }
    return { x, w, bottom, depth, marks, knots, twigs };
  }

  function buildLayout() {
    const r = rng(1313);
    ridge = [];
    for (let x = -30; x < W + 30; x += (5 + r() * 11) * scale) {
      ridge.push([x, (22 + r() * 76) * scale * (0.75 + 0.5 * Math.sin(x / (W * 0.13)) ** 2)]);
    }
    stars = [];
    for (let i = 0; i < Math.round(W * H / 9000); i++) stars.push([r() * W, r() * horizon * 0.8, r()]);

    const titleRight = mobile ? W : W * 0.42;
    mids = [];
    const count = Math.round(W / (mobile ? 30 : 40));
    for (let i = 0; i < count; i++) {
      const depth = r();
      const x = r() * W;
      // За заголовком деревьев меньше: белые стволы не должны спорить с текстом.
      if (x < titleRight && r() < (mobile ? 0.55 : 0.7)) continue;
      const w = (2.5 + depth * 9 + r() * 2) * scale;
      const bottom = horizon + (3 + depth * 52 + r() * 6) * scale;
      mids.push(birch(r, x, w, bottom, depth));
    }
    mids.sort((a, b) => a.depth - b.depth);

    const nearSpec = mobile
      ? [[0.025, 22], [0.965, 30]]
      : [[0.03, 40], [0.44, 20], [0.885, 30], [0.975, 54]];
    nears = nearSpec.map(([fx, w]) => birch(r, fx * W, w * scale, H + 30, 1));

    // Смотритель: береста на теле и фонари на руках-ветвях.
    warden.marks = [];
    for (let i = 0; i < 26; i++) warden.marks.push([r(), r() - 0.5, 0.3 + r() * 0.6, 1 + r() * 2]);
    warden.lanterns = [];
    for (let i = 0; i < 9; i++) {
      warden.lanterns.push({ arm: i % 2 ? 1 : -1, t: 0.35 + r() * 0.6, len: (10 + r() * 26) * scale, phase: r() * 6.28 });
    }
  }

  // ---------- рисование ----------

  function drawBirch(c, b, pal, fogK) {
    const bark = mix(pal.bark, pal.fog, fogK), shade = mix(pal.shade, pal.fog, fogK);
    const g = c.createLinearGradient(b.x - b.w / 2, 0, b.x + b.w / 2, 0);
    g.addColorStop(0, shade);
    g.addColorStop(0.32, bark);
    g.addColorStop(0.68, bark);
    g.addColorStop(1, shade);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(b.x - b.w * 0.4, -20);
    c.lineTo(b.x + b.w * 0.4, -20);
    c.lineTo(b.x + b.w * 0.5, b.bottom);
    c.lineTo(b.x - b.w * 0.5, b.bottom);
    c.closePath();
    c.fill();
    c.fillStyle = mix(pal.mark, pal.fog, fogK * 0.85);
    for (const [y, off, len, h] of b.marks) {
      if (y > b.bottom - 2) break;
      c.fillRect(b.x + off - len / 2, y, len, h);
    }
    for (const [y, off, s] of b.knots) {
      c.beginPath();
      c.ellipse(b.x + off, y, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = mix(pal.twig, pal.fog, fogK);
    c.lineWidth = Math.max(0.8, b.w * 0.12);
    c.lineCap = 'round';
    for (const [y, side, len, ang] of b.twigs) {
      const x0 = b.x + side * b.w * 0.38;
      c.beginPath();
      c.moveTo(x0, y);
      c.quadraticCurveTo(x0 + side * len * 0.5, y - len * 0.15, x0 + side * len * Math.cos(ang), y - len * Math.sin(ang));
      c.stroke();
    }
  }

  function paintBack(c) {
    const sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#061322');
    sky.addColorStop(0.62, '#0f2741');
    sky.addColorStop(1, '#1c3c5e');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, horizon + 2);

    const mx = W * (mobile ? 0.2 : 0.76), my = H * (mobile ? 0.5 : 0.2);
    const halo = c.createRadialGradient(mx, my, 0, mx, my, H * 0.48);
    halo.addColorStop(0, 'rgba(190,212,236,0.2)');
    halo.addColorStop(1, 'rgba(190,212,236,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, W, horizon);
    for (const [x, y, k] of stars) {
      c.fillStyle = `rgba(220,232,245,${0.15 + k * 0.45})`;
      c.fillRect(x, y, k > 0.85 ? 1.6 : 1, k > 0.85 ? 1.6 : 1);
    }
    c.fillStyle = 'rgba(232,240,248,0.9)';
    c.beginPath();
    c.arc(mx, my, Math.max(9, H * 0.02), 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#0b1e34';
    c.beginPath();
    c.moveTo(-30, horizon + 6);
    for (const [x, h] of ridge) {
      c.lineTo(x - h * 0.2, horizon - h * 0.12);
      c.lineTo(x, horizon - h);
      c.lineTo(x + h * 0.2, horizon - h * 0.12);
    }
    c.lineTo(W + 30, horizon + 6);
    c.closePath();
    c.fill();

    const snow = c.createLinearGradient(0, horizon, 0, H);
    snow.addColorStop(0, '#1d3c5d');
    snow.addColorStop(1, '#2d557c');
    c.fillStyle = snow;
    c.fillRect(0, horizon, W, H - horizon);

    const fog = c.createLinearGradient(0, horizon - H * 0.2, 0, horizon + H * 0.05);
    fog.addColorStop(0, 'rgba(34,66,99,0)');
    fog.addColorStop(0.75, 'rgba(34,66,99,0.6)');
    fog.addColorStop(1, 'rgba(34,66,99,0)');
    c.fillStyle = fog;
    c.fillRect(0, horizon - H * 0.2, W, H * 0.25);

    for (const b of mids) drawBirch(c, b, MOON, 0.15 + (1 - b.depth) * 0.75);
  }

  function paintLitBack(c) {
    const snow = c.createLinearGradient(0, horizon, 0, H);
    snow.addColorStop(0, 'rgba(232,190,128,0.25)');
    snow.addColorStop(1, 'rgba(250,214,156,0.95)');
    c.fillStyle = snow;
    c.fillRect(0, horizon, W, H - horizon);
    for (const b of mids) {
      c.globalAlpha = 0.3 + 0.7 * b.depth;
      drawBirch(c, b, LAMP, 0);
    }
    c.globalAlpha = 1;
  }

  function paintFront(c, pal, lit) {
    for (const b of nears) drawBirch(c, b, pal, lit ? 0 : 0.12);
  }

  function armPoint(side, t) {
    const x = warden.x, foot = horizon + 12 * scale, h = warden.height;
    const sx = x + side * 6 * scale, sy = foot - h * 0.8;
    const cx = x + side * 34 * scale, cy = foot - h * 0.7;
    const ex = x + side * (side > 0 ? 40 : 31) * scale + Math.sin(time * 0.6 + side) * 3 * scale, ey = foot - h * 0.3;
    const u = 1 - t;
    return [u * u * sx + 2 * u * t * cx + t * t * ex, u * u * sy + 2 * u * t * cy + t * t * ey];
  }

  function drawWarden(c, pal, lit) {
    if (warden.fade <= 0.01) return;
    const x = warden.x, foot = horizon + 12 * scale, h = warden.height;
    const sway = Math.sin(time * 0.55) * 3 * scale;
    const w0 = 15 * scale, w1 = 8 * scale, neck = foot - h * 0.84;
    c.save();
    c.globalAlpha = warden.fade;

    const g = c.createLinearGradient(x - w0, 0, x + w0, 0);
    g.addColorStop(0, pal.shade);
    g.addColorStop(0.45, pal.bark);
    g.addColorStop(1, pal.shade);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - w0 / 2, foot);
    c.quadraticCurveTo(x - w0 * 0.6, foot - h * 0.45, x - w1 / 2 + sway, neck);
    c.lineTo(x + w1 / 2 + sway, neck);
    c.quadraticCurveTo(x + w0 * 0.6, foot - h * 0.45, x + w0 / 2, foot);
    c.closePath();
    c.fill();
    c.fillStyle = pal.mark;
    for (const [k, off, len, th] of warden.marks) {
      const y = neck + (foot - neck) * k;
      const wy = w1 + (w0 - w1) * k;
      c.fillRect(x + off * wy * 0.5 - (len * wy) / 2 + sway * (1 - k), y, len * wy, th * scale);
    }

    // Руки-ветви.
    c.strokeStyle = lit ? pal.shade : pal.bark;
    c.lineCap = 'round';
    for (const side of [-1, 1]) {
      c.lineWidth = 3.2 * scale;
      c.beginPath();
      for (let i = 0; i <= 16; i++) {
        const [px, py] = armPoint(side, i / 16);
        if (i === 0) c.moveTo(px + sway, py); else c.lineTo(px + sway * (1 - i / 16), py);
      }
      c.stroke();
      const [ex, ey] = armPoint(side, 1);
      c.lineWidth = 1.4 * scale;
      for (const [dx, dy] of [[-6, 16], [2, 20], [9, 13]]) {
        c.beginPath();
        c.moveTo(ex, ey);
        c.lineTo(ex + dx * scale * side, ey + dy * scale);
        c.stroke();
      }
    }

    // Голова — береста, вместо глаз чёрные сучки.
    const hx = x + sway * 1.2, hy = neck - 15 * scale;
    c.fillStyle = pal.bark;
    c.beginPath();
    c.ellipse(hx, hy, 10.5 * scale, 16 * scale, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = pal.mark;
    c.beginPath();
    c.ellipse(hx - 4 * scale, hy - 2 * scale, 2.6 * scale, 3.6 * scale, 0, 0, Math.PI * 2);
    c.ellipse(hx + 4 * scale, hy - 2 * scale, 2.6 * scale, 3.6 * scale, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(hx - 0.6 * scale, hy + 3 * scale, 1.2 * scale, 7 * scale);
    if (warden.noticed > 0.45) {
      c.fillStyle = `rgba(190,255,150,${(warden.noticed - 0.45) * 1.6})`;
      c.beginPath();
      c.arc(hx - 4 * scale, hy - 2 * scale, 1.1 * scale, 0, Math.PI * 2);
      c.arc(hx + 4 * scale, hy - 2 * scale, 1.1 * scale, 0, Math.PI * 2);
      c.fill();
    }

    // Нити и корпуса фонарей.
    c.lineWidth = 1 * scale;
    for (const l of warden.lanterns) {
      const [ax, ay] = armPoint(l.arm, l.t);
      const swing = Math.sin(time * 1.25 + l.phase) * 0.16;
      const lx = ax + Math.sin(swing) * l.len + sway * (1 - l.t), ly = ay + Math.cos(swing) * l.len;
      l.x = lx; l.y = ly + 4 * scale;
      c.strokeStyle = pal.twig;
      c.beginPath();
      c.moveTo(ax + sway * (1 - l.t), ay);
      c.lineTo(lx, ly);
      c.stroke();
      c.fillStyle = '#1c2a22';
      c.fillRect(lx - 3 * scale, ly, 6 * scale, 8 * scale);
      c.fillStyle = '#c9f5a5';
      c.fillRect(lx - 1.6 * scale, ly + 2 * scale, 3.2 * scale, 4.2 * scale);
    }
    c.restore();
  }

  function drawGlows(c) {
    if (warden.fade <= 0.01) return;
    const seen = warden.seenUntil > 0;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const l of warden.lanterns) {
      if (l.x === undefined) continue;
      const pulse = 0.82 + 0.18 * Math.sin(time * 2.1 + l.phase * 3);
      const k = (0.42 + 0.5 * warden.noticed + (seen ? 0.5 : 0)) * pulse * warden.fade;
      const s = (seen ? 110 : 80) * scale;
      c.globalAlpha = Math.min(1, k);
      c.drawImage(glow, l.x - s / 2, l.y - s / 2, s, s);
    }
    c.restore();
  }

  function radius() {
    const flicker = reduced.matches ? 1 : 1 + 0.025 * Math.sin(time * 11.3) + 0.015 * Math.sin(time * 23.7);
    return light.r * (light.dim ? 0.5 : 1) * flicker;
  }

  function drawLit(R) {
    const size = Math.ceil(2 * R * dpr);
    const x0 = Math.floor((light.x - R) * dpr), y0 = Math.floor((light.y - R) * dpr);
    const sx = Math.max(0, x0), sy = Math.max(0, y0);
    const w = Math.min(canvas.width, x0 + size) - sx, h = Math.min(canvas.height, y0 + size) - sy;
    if (w <= 0 || h <= 0) return;
    if (temp.width < w || temp.height < h) {
      temp.width = Math.max(temp.width, w);
      temp.height = Math.max(temp.height, h);
    }
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(litBack, sx, sy, w, h, 0, 0, w, h);
    tctx.setTransform(dpr, 0, 0, dpr, -sx, -sy);
    drawWarden(tctx, LAMP, true);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.drawImage(litFront, sx, sy, w, h, 0, 0, w, h);
    tctx.globalCompositeOperation = 'destination-in';
    const cx = light.x * dpr - sx, cy = light.y * dpr - sy;
    const k = light.dim ? 0.55 : 0.92;
    const g = tctx.createRadialGradient(cx, cy, 0, cx, cy, R * dpr);
    g.addColorStop(0, `rgba(0,0,0,${k})`);
    g.addColorStop(0.35, `rgba(0,0,0,${k * 0.8})`);
    g.addColorStop(0.7, `rgba(0,0,0,${k * 0.28})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    tctx.fillStyle = g;
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(temp, 0, 0, w, h, sx, sy, w, h);
  }

  function drawSnow(c, dt, R) {
    for (const f of flakes) {
      if (dt) {
        f.y += (14 + 44 * f.z) * dt;
        f.x += (Math.sin(time * 0.6 + f.p) * 14 * f.z - 6) * dt;
        if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
        if (f.x < -4) f.x = W + 4;
      }
      const d = Math.hypot(f.x - light.x, f.y - light.y);
      const lit = Math.max(0, 1 - d / R);
      const s = 0.7 + 1.9 * f.z;
      c.fillStyle = lit > 0.02
        ? `rgba(255,${Math.round(228 - 34 * lit)},${Math.round(196 - 80 * lit)},${Math.min(1, 0.3 + 0.7 * Math.max(f.z * 0.6, lit))})`
        : `rgba(214,228,242,${0.22 + 0.45 * f.z})`;
      c.fillRect(f.x, f.y, s, s);
    }
  }

  function drawBloom(c, R) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(light.x, light.y, 0, light.x, light.y, R);
    const a = light.dim ? 0.06 : 0.12;
    g.addColorStop(0, `rgba(255,190,110,${a})`);
    g.addColorStop(0.5, `rgba(255,160,70,${a * 0.4})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = g;
    c.fillRect(light.x - R, light.y - R, 2 * R, 2 * R);
    c.restore();
  }

  function frame(dt) {
    const R = radius();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(back, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWarden(ctx, HIDDEN, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(front, 0, 0);
    drawLit(R);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGlows(ctx);
    drawSnow(ctx, dt, R);
    drawBloom(ctx, R);
  }

  // ---------- поведение ----------

  function update(dt) {
    if (time - light.pointerAt > 3) {
      light.tx = W * (mobile ? 0.3 : 0.2) + Math.sin(time * 0.23) * W * 0.1;
      light.ty = H * (mobile ? 0.86 : 0.8) + Math.sin(time * 0.37) * H * 0.04;
    }
    const k = reduced.matches ? 1 : Math.min(1, dt * 9);
    light.x += (light.tx - light.x) * k;
    light.y += (light.ty - light.y) * k;

    const headX = warden.x, headY = horizon + 12 * scale - warden.height * 0.72;
    const d = Math.hypot(light.x - headX, light.y - headY);
    const reach = light.r * (light.dim ? 0.3 : 0.75);
    if (warden.seenUntil) {
      if (time > warden.seenUntil) {
        warden.target = 0;
        if (warden.fade < 0.02) {
          warden.slot = (warden.slot + 1) % warden.slots.length;
          warden.x = W * warden.slots[warden.slot];
          warden.noticed = 0;
          warden.seenUntil = 0;
          warden.target = 1;
          if (whisper) whisper.classList.remove('is-on');
        }
      }
    } else if (warden.fade > 0.6 && d < reach) {
      warden.noticed = Math.min(1, warden.noticed + dt * (light.dim ? 0.1 : 0.4));
      if (warden.noticed >= 1) {
        warden.seenUntil = time + 2.6;
        if (whisper) {
          whisper.textContent = light.dim ? 'Оно всё равно заметило.' : 'Оно увидело свет. Прикройте фонарь.';
          whisper.classList.add('is-on');
        }
      }
    } else {
      warden.noticed = Math.max(0, warden.noticed - dt * 0.2);
    }
    const fadeSpeed = warden.target > warden.fade ? 0.5 : 1.4;
    warden.fade += Math.sign(warden.target - warden.fade) * Math.min(Math.abs(warden.target - warden.fade), dt * fadeSpeed);

    if (eye) {
      eye.style.setProperty('--eye', warden.noticed.toFixed(3));
      eye.classList.toggle('is-seen', warden.seenUntil > 0);
    }
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    time += dt;
    update(dt);
    frame(dt);
    requestAnimationFrame(tick);
  }

  function start() {
    if (running || reduced.matches || !visible || document.hidden || !back) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }
  function stop() { running = false; }

  function stillFrame() {
    if (running || !back) return;
    update(1 / 30);
    frame(0);
  }

  function setup() {
    const rect = win.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    mobile = W < 700;
    scale = Math.max(0.62, Math.min(1.35, H / 820));
    horizon = H * (mobile ? 0.75 : 0.64);
    warden.height = H * (mobile ? 0.33 : 0.56);
    warden.slots = mobile ? [0.74, 0.58] : [0.53, 0.47];
    warden.x = W * warden.slots[warden.slot % warden.slots.length];
    light.r = Math.min(W, H) * (mobile ? 0.36 : 0.28);
    if (time - light.pointerAt > 3) {
      light.x = light.tx = W * (mobile ? 0.3 : 0.2);
      light.y = light.ty = H * (mobile ? 0.86 : 0.8);
    }

    buildLayout();
    let x;
    [back, x] = layer(); paintBack(x);
    [front, x] = layer(); paintFront(x, MOON, false);
    [litBack, x] = layer(); paintLitBack(x);
    [litFront, x] = layer(); paintFront(x, LAMP, true);
    temp = document.createElement('canvas');
    temp.width = temp.height = Math.ceil(2 * light.r * dpr) + 2;
    tctx = temp.getContext('2d');

    glow = document.createElement('canvas');
    glow.width = glow.height = 64;
    const gx = glow.getContext('2d');
    const gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gg.addColorStop(0, 'rgba(205,255,170,0.95)');
    gg.addColorStop(0.18, 'rgba(154,216,115,0.55)');
    gg.addColorStop(0.5, 'rgba(120,200,90,0.14)');
    gg.addColorStop(1, 'rgba(120,200,90,0)');
    gx.fillStyle = gg;
    gx.fillRect(0, 0, 64, 64);

    const n = Math.round(Math.min(280, (W * H) / 5200));
    flakes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.25 + Math.random() * 0.75, p: Math.random() * 6.28 }));

    stop();
    frame(0);
    start();
  }

  function aim(e) {
    const rect = canvas.getBoundingClientRect();
    light.tx = e.clientX - rect.left;
    light.ty = e.clientY - rect.top;
    light.pointerAt = time;
    if (reduced.matches) {
      light.x = light.tx;
      light.y = light.ty;
      stillFrame();
    }
  }
  win.addEventListener('pointermove', aim);
  win.addEventListener('pointerdown', aim);

  if (shutter) {
    shutter.addEventListener('click', () => {
      light.dim = !light.dim;
      shutter.setAttribute('aria-pressed', String(light.dim));
      shutter.textContent = light.dim ? 'Открыть фонарь' : 'Прикрыть фонарь';
      if (!running) stillFrame();
    });
  }

  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 120);
  }).observe(win);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start(); else stop();
  }).observe(win);

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduced.addEventListener('change', () => (reduced.matches ? (stop(), stillFrame()) : start()));

  setup();
})();
