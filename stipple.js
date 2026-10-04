/* taste · stippled dot field
   Solid dots in two hues whose density follows two soft waves: a cool band low on the
   left, a warm band high on the right. Every dot is one flat color; nothing is blended.
   Usage: <canvas class="stipple" aria-hidden="true"></canvas> as the first child of a
   position:relative parent; the canvas fills that parent.
   Colors: CSS vars --dot-a / --dot-b (themes and dark mode just work).
   Options: data-density="1" (0.3-2), data-drift="off".
   Static under prefers-reduced-motion; pauses offscreen and in background tabs. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Seeded random so the field looks the same on every load.
  const seeded = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Bands in normalized coordinates: centre line y(x), thickness s(x), horizontal extent.
  const BANDS = [
    { y: (x) => 0.86 - 0.42 * x + 0.06 * Math.sin(x * 6.0 + 0.4), s: (x) => 0.055 + 0.03 * Math.sin(x * 3.4 + 1), x0: -0.08, x1: 0.66 },
    { y: (x) => 0.50 - 0.30 * (x - 0.45) + 0.05 * Math.sin(x * 7.0 + 2.2), s: (x) => 0.05 + 0.025 * Math.cos(x * 2.6), x0: 0.46, x1: 1.08 },
  ];

  function field(canvas) {
    const ctx = canvas.getContext('2d');
    const density = Math.min(2, Math.max(0.3, parseFloat(canvas.dataset.density || '1')));
    const drift = canvas.dataset.drift !== 'off';
    let w = 0, h = 0, dpr = 1, sets = [[], []], colors = ['#4D6B99', '#C47A3A'];
    let visible = true, raf = 0, last = 0;

    function readColors() {
      const cs = getComputedStyle(canvas);
      colors = [cs.getPropertyValue('--dot-a').trim() || colors[0], cs.getPropertyValue('--dot-b').trim() || colors[1]];
    }

    function build() {
      const box = canvas.parentElement.getBoundingClientRect();
      w = Math.max(1, Math.round(box.width));
      h = Math.max(1, Math.round(box.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const rnd = seeded(11);
      const step = 3 / Math.sqrt(density);
      sets = [[], []];
      for (let py = 0; py < h; py += step) {
        for (let px = 0; px < w; px += step) {
          const x = px + (rnd() - 0.5) * step;
          const y = py + (rnd() - 0.5) * step;
          const nx = x / w, ny = y / h;
          BANDS.forEach((b, k) => {
            if (nx < b.x0 || nx > b.x1) return;
            const t = (nx - b.x0) / (b.x1 - b.x0);
            const taper = Math.pow(Math.sin(Math.PI * t), 0.9);
            const dy = (ny - b.y(nx)) / b.s(nx);
            const p = Math.exp(-0.5 * dy * dy) * taper * 0.9;
            if (rnd() < p) sets[k].push({ x, y, a: 0.3 + 0.6 * p * rnd(), ph: rnd() * 6.283 });
          });
        }
      }
    }

    function draw(time) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const moving = drift && !reduced.matches;
      const size = 1.15;
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = colors[k];
        for (const d of sets[k]) {
          ctx.globalAlpha = d.a;
          const y = moving ? d.y + Math.sin(d.x * 0.006 + time * 0.00035 + d.ph * 0.12) * 4 : d.y;
          ctx.fillRect(d.x, y, size, size);
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      if (now - last > 48) { draw(now); last = now; }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && drift && !reduced.matches && visible && !document.hidden) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function refresh() { readColors(); build(); draw(performance.now()); start(); }

    new ResizeObserver(() => refresh()).observe(canvas.parentElement);
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    reduced.addEventListener('change', () => { stop(); draw(performance.now()); start(); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); draw(performance.now()); });
    new MutationObserver(() => { readColors(); draw(performance.now()); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    refresh();
  }

  const init = () => document.querySelectorAll('canvas.stipple').forEach(field);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
