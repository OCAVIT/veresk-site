// Касса: именной билет на поезд № 13 Москва — Вереск. Вагон, место и номер вычисляются из имени, так что одно и то
// же имя всегда получает один и тот же билет. Превью рисуется на canvas, а «Скачать билет» сохраняет PNG 1200×630
// (формат картинки для поста). Имя никуда не отправляется: билет рисуется в браузере.
(() => {
  'use strict';

  const forms = Array.from(document.querySelectorAll('[data-ticket]'));
  if (!forms.length) return;

  const PAPER_W = 1040, PAPER_H = 470, STUB = 800;
  const NAME_OK = /^[\p{L}][\p{L}\s.'’-]*$/u;
  const INK = '#23262E', LABEL = '#5B6672', PAPER = '#E6ECE3', RED = '#B3262A', NIGHT = '#0D2138';
  let fonts = null;

  function fontsReady() {
    if (!fonts) {
      fonts = Promise.all([
        document.fonts.load('700 40px "Old Standard TT"'),
        document.fonts.load('400 24px "PT Mono"'),
        document.fonts.load('700 18px "Arsenal"'),
        document.fonts.load('400 18px "Arsenal"')
      ]).catch(() => {});
    }
    return fonts;
  }

  function hash(text) {
    let h = 2166136261;
    for (const ch of text) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function details(raw) {
    const name = raw.trim().replace(/\s+/g, ' ');
    const h = hash(name.toLocaleLowerCase('ru') || 'вереск');
    let seat = 1 + (h % 53);
    if (seat >= 13) seat += 1; // 13-е место занято мальчиком
    const number = String(h % 1000000).padStart(6, '0');
    return {
      name,
      print: name.toLocaleUpperCase('ru'),
      seat: String(seat).padStart(2, '0'),
      number: `ВЕ ${number.slice(0, 3)} ${number.slice(3)}`
    };
  }

  // ---------- рисование билета ----------

  function paperPath(c) {
    const r = 14, n = 15;
    c.beginPath();
    c.moveTo(r, 0);
    c.lineTo(STUB - n, 0);
    c.arc(STUB, 0, n, Math.PI, 0, true);
    c.lineTo(PAPER_W - r, 0);
    c.arcTo(PAPER_W, 0, PAPER_W, r, r);
    c.lineTo(PAPER_W, PAPER_H - r);
    c.arcTo(PAPER_W, PAPER_H, PAPER_W - r, PAPER_H, r);
    c.lineTo(STUB + n, PAPER_H);
    c.arc(STUB, PAPER_H, n, 0, Math.PI, true);
    c.lineTo(r, PAPER_H);
    c.arcTo(0, PAPER_H, 0, PAPER_H - r, r);
    c.lineTo(0, r);
    c.arcTo(0, 0, r, 0, r);
    c.closePath();
  }

  function spaced(c, text, x, y, spacing, align) {
    let width = 0;
    for (const ch of text) width += c.measureText(ch).width + spacing;
    width -= spacing;
    let cx = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    for (const ch of text) {
      c.fillText(ch, cx, y);
      cx += c.measureText(ch).width + spacing;
    }
  }

  // Точечная печать, как у матричного принтера кассы: текст растрируется и печатается кружками.
  function dots(c, text, x, y, size, color, align) {
    const off = document.createElement('canvas');
    const o = off.getContext('2d');
    o.font = `400 ${size}px "PT Mono"`;
    const w = Math.ceil(o.measureText(text).width) + 6, h = Math.ceil(size * 1.3);
    off.width = w;
    off.height = h;
    o.font = `400 ${size}px "PT Mono"`;
    o.textBaseline = 'top';
    o.fillStyle = '#000';
    o.strokeStyle = '#000';
    o.lineWidth = size * 0.07;
    o.fillText(text, 3, size * 0.12);
    o.strokeText(text, 3, size * 0.12);
    const data = o.getImageData(0, 0, w, h).data;
    const step = Math.max(2.2, size / 9.5), rad = step * 0.43;
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    const r = rng(hash(text) + size);
    c.fillStyle = color;
    for (let yy = step / 2; yy < h; yy += step) {
      for (let xx = step / 2; xx < w; xx += step) {
        if (data[((yy | 0) * w + (xx | 0)) * 4 + 3] > 90) {
          c.globalAlpha = 0.72 + r() * 0.28;
          c.beginPath();
          c.arc(left + xx, y + yy, rad, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    c.globalAlpha = 1;
  }

  function label(c, text, x, y, align) {
    c.font = '700 15px "Arsenal"';
    c.fillStyle = LABEL;
    spaced(c, text, x, y, 1.6, align);
  }

  function stamp(d) {
    const s = 190, c = document.createElement('canvas');
    c.width = c.height = s;
    const x = c.getContext('2d');
    x.translate(s / 2, s / 2);
    x.strokeStyle = RED;
    x.fillStyle = RED;
    x.lineWidth = 4;
    x.beginPath(); x.arc(0, 0, 80, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 1.6;
    x.beginPath(); x.arc(0, 0, 58, 0, Math.PI * 2); x.stroke();
    x.font = '700 15px "Arsenal"';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const ring = 'КАССА СТАНЦИИ ВЕРЕСК ✶ ПОЕЗД 13 ✶ ';
    const step = (Math.PI * 2) / ring.length;
    [...ring].forEach((ch, i) => {
      x.save();
      x.rotate(i * step);
      x.translate(0, -69);
      x.fillText(ch, 0, 0);
      x.restore();
    });
    x.font = '700 34px "Old Standard TT"';
    x.fillText(`№ ${d.seat}`, 0, -2);
    x.font = '700 13px "Arsenal"';
    x.fillText('ПРИНЯТ', 0, 28);
    // Неровный оттиск: часть краски не легла.
    x.globalCompositeOperation = 'destination-out';
    const r = rng(hash(d.number));
    for (let i = 0; i < 420; i++) {
      x.globalAlpha = 0.25 + r() * 0.75;
      x.beginPath();
      x.arc((r() - 0.5) * s, (r() - 0.5) * s, 0.6 + r() * 2.2, 0, Math.PI * 2);
      x.fill();
    }
    return c;
  }

  function drawPaper(c, d) {
    c.save();
    paperPath(c);
    c.clip();
    c.fillStyle = PAPER;
    c.fillRect(0, 0, PAPER_W, PAPER_H);

    // Защитная сетка бланка.
    c.strokeStyle = 'rgba(52,112,98,0.16)';
    c.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      c.beginPath();
      for (let x = 0; x <= STUB; x += 8) {
        const y = 92 + i * 17 + Math.sin(x / 38 + i * 0.7) * 7 + Math.sin(x / 13 + i) * 1.6;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    const r = rng(7);
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(35,38,46,0.05)' : 'rgba(255,255,255,0.22)';
      c.fillRect(r() * PAPER_W, r() * PAPER_H, 1.2, 1.2);
    }

    // Шапка бланка.
    c.fillStyle = NIGHT;
    c.fillRect(0, 0, STUB, 74);
    c.fillStyle = '#E9EFF5';
    c.font = '700 38px "Old Standard TT"';
    c.textBaseline = 'alphabetic';
    spaced(c, 'VERESK', 34, 50, 7);
    c.font = '700 17px "Arsenal"';
    c.fillStyle = '#C9D6E2';
    spaced(c, 'ПРОЕЗДНОЙ ДОКУМЕНТ', STUB - 30, 45, 1.6, 'right');
    c.fillStyle = RED;
    c.fillRect(0, 74, STUB, 4);

    label(c, 'ПОЕЗД', 34, 112);
    label(c, 'ВАГОН', 196, 112);
    label(c, 'МЕСТО', 318, 112);
    label(c, 'ОТПРАВЛЕНИЕ', 448, 112);
    dots(c, '013А', 32, 122, 30, INK);
    dots(c, '06', 194, 122, 30, INK);
    dots(c, d.seat, 316, 122, 30, INK);
    dots(c, '31.12 23:59', 446, 122, 30, INK);

    c.fillStyle = INK;
    c.font = '700 52px "Old Standard TT"';
    c.fillText('Москва — Вереск', 32, 238);

    label(c, 'ПАССАЖИР', 34, 286);
    if (d.print) dots(c, d.print, 30, 296, d.print.length > 18 ? 30 : 38, INK);
    else dots(c, 'ВПИШИТЕ ИМЯ', 30, 296, 38, 'rgba(35,38,46,0.28)');

    dots(c, 'ОБРАТНЫЙ БИЛЕТ НЕ ПРЕДУСМОТРЕН', 30, 372, 20, RED);
    c.font = '400 15px "Arsenal"';
    c.fillStyle = LABEL;
    c.fillText('Прибытие не указано. Билет действителен до рассвета.', 34, 438);
    c.textAlign = 'right';
    c.fillText('ocavit.github.io/veresk-site', STUB - 30, 438);
    c.textAlign = 'left';

    // Контрольный корешок.
    c.fillStyle = 'rgba(13,33,56,0.06)';
    c.fillRect(STUB, 0, PAPER_W - STUB, PAPER_H);
    label(c, 'КОНТРОЛЬ', 920, 48, 'center');
    dots(c, d.number, 920, 60, 22, INK, 'center');
    label(c, 'ВАГОН / МЕСТО', 920, 128, 'center');
    dots(c, `06/${d.seat}`, 920, 138, 34, INK, 'center');
    c.save();
    c.translate(920, 330);
    c.rotate(-0.24);
    c.globalAlpha = 0.86;
    const st = stamp(d);
    c.drawImage(st, -st.width / 2, -st.height / 2);
    c.restore();

    // Перфорация.
    c.fillStyle = 'rgba(35,38,46,0.32)';
    for (let y = 22; y < PAPER_H - 18; y += 12) {
      c.beginPath();
      c.arc(STUB, y, 2.3, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function preview(canvas, d) {
    canvas.width = PAPER_W;
    canvas.height = PAPER_H;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, PAPER_W, PAPER_H);
    drawPaper(c, d);
    canvas.setAttribute('aria-label', d.name
      ? `Билет до Вереска на имя ${d.name}: поезд 013А, вагон 06, место ${d.seat}`
      : 'Билет до Вереска: впишите имя пассажира');
  }

  function exportPng(d) {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 630;
    const x = c.getContext('2d');
    x.fillStyle = NIGHT;
    x.fillRect(0, 0, 1200, 630);
    const g = x.createRadialGradient(600, 330, 60, 600, 330, 720);
    g.addColorStop(0, 'rgba(240,164,58,0.18)');
    g.addColorStop(1, 'rgba(4,12,22,0.5)');
    x.fillStyle = g;
    x.fillRect(0, 0, 1200, 630);
    const r = rng(2026);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = `rgba(214,228,242,${0.2 + r() * 0.5})`;
      const s = 0.8 + r() * 2.2;
      x.fillRect(r() * 1200, r() * 630, s, s);
    }
    x.save();
    x.translate(600, 318);
    x.rotate(-0.038);
    x.translate(-PAPER_W / 2, -PAPER_H / 2);
    x.shadowColor = 'rgba(0,0,0,0.55)';
    x.shadowBlur = 40;
    x.shadowOffsetY = 18;
    paperPath(x);
    x.fillStyle = PAPER;
    x.fill();
    x.shadowColor = 'transparent';
    drawPaper(x, d);
    x.restore();
    return c;
  }

  // ---------- форма ----------

  let current = '';
  let pending = 0;
  function renderAll() {
    pending = 0;
    const d = details(current);
    forms.forEach((form) => preview(form.querySelector('[data-ticket-canvas]'), d));
  }
  function schedule() {
    if (!pending) pending = requestAnimationFrame(renderAll);
  }

  function setNote(form, text, state) {
    const note = form.querySelector('[data-ticket-note]');
    note.textContent = text;
    if (state) note.dataset.state = state; else delete note.dataset.state;
  }

  function slug(name) {
    return name.toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'passazhir';
  }

  function save(canvas, filename) {
    return new Promise((resolve) => {
      const done = (url, revoke) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (revoke) setTimeout(() => URL.revokeObjectURL(url), 4000);
        resolve();
      };
      if (canvas.toBlob) canvas.toBlob((blob) => (blob ? done(URL.createObjectURL(blob), true) : done(canvas.toDataURL('image/png'), false)), 'image/png');
      else done(canvas.toDataURL('image/png'), false);
    });
  }

  forms.forEach((form) => {
    const input = form.querySelector('input');
    const button = form.querySelector('button[type="submit"]');
    const initialNote = form.querySelector('[data-ticket-note]').textContent;
    const buttonText = button.textContent;

    input.addEventListener('input', () => {
      current = input.value;
      forms.forEach((other) => {
        const field = other.querySelector('input');
        if (field !== input) field.value = input.value;
        if (field.getAttribute('aria-invalid') === 'true') {
          field.removeAttribute('aria-invalid');
          setNote(other, other.querySelector('[data-ticket-note]').dataset.initial || '', null);
        }
      });
      schedule();
    });

    form.querySelector('[data-ticket-note]').dataset.initial = initialNote;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (!name) {
        input.setAttribute('aria-invalid', 'true');
        setNote(form, 'Впишите имя: без него касса не печатает билет.', 'error');
        input.focus();
        return;
      }
      if (!NAME_OK.test(name)) {
        input.setAttribute('aria-invalid', 'true');
        setNote(form, 'Касса печатает только буквы, пробел, точку, апостроф и дефис. Уберите цифры и другие знаки.', 'error');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Печатаем…';
      await fontsReady();
      const d = details(name);
      const filename = `veresk-bilet-${slug(name)}.png`;
      await save(exportPng(d), filename);
      (window.dataLayer = window.dataLayer || []).push({ event: 'ticket_download', seat: d.seat });
      button.removeAttribute('aria-busy');
      button.textContent = 'Билет скачан';
      setNote(form, `Готово: файл ${filename} в папке загрузок. Вагон 06, место ${d.seat}.`, 'done');
      setTimeout(() => { button.textContent = buttonText; }, 2600);
    });
  });

  // Тестовый доступ для превью ссылки (og.png) и проверки: рисует PNG без скачивания.
  window.vereskTicket = { exportPng: (name) => fontsReady().then(() => exportPng(details(name)).toDataURL('image/png')) };

  fontsReady().then(renderAll);
  renderAll();
})();
