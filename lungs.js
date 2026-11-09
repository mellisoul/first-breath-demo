class LungsViz {
  constructor(canvas, opts = {}) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.count = opts.particles || 90;
    this.b = 0;
    this.prevB = 0;
    this.flow = 0;
    this.level = 0;
    this.t = 0;
    this.rand = LungsViz.rng(7);
    this.lobeL = new Path2D('M165 150 C110 160 70 230 62 320 C58 390 80 440 140 450 C175 455 190 430 192 400 L192 210 C192 180 185 155 165 150 Z');
    this.lobeR = new Path2D('M235 150 C290 160 330 230 338 320 C342 390 320 440 260 450 C225 455 208 430 208 400 L208 210 C208 180 215 155 235 150 Z');
    this.clipPath = new Path2D();
    this.clipPath.addPath(this.lobeL);
    this.clipPath.addPath(this.lobeR);
    this.clipPath.rect(186, 0, 28, 170);
    this.clipPath.moveTo(188, 150);
    this.clipPath.lineTo(212, 150);
    this.clipPath.lineTo(262, 214);
    this.clipPath.lineTo(138, 214);
    this.clipPath.closePath();
    this.build();
    this.particles = Array.from({ length: this.count }, () => this.spawn(this.rand()));
  }

  static rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  build() {
    const r = this.rand;
    const left = [
      [[200, 158], [182, 176], [146, 206]],
      [[146, 206], [125, 228], [104, 254]],
      [[104, 254], [90, 270], [80, 290]],
      [[104, 254], [107, 276], [98, 298]],
      [[146, 206], [145, 240], [134, 270]],
      [[134, 270], [121, 290], [120, 312]],
      [[120, 312], [110, 330], [108, 346]],
      [[134, 270], [144, 296], [140, 318]],
      [[140, 318], [150, 338], [146, 358]],
      [[146, 206], [160, 232], [170, 262]],
      [[170, 262], [176, 300], [168, 336]],
      [[168, 336], [172, 370], [160, 400]],
      [[104, 254], [92, 240], [84, 226]],
      [[120, 312], [100, 326], [86, 334]],
      [[140, 318], [128, 360], [118, 392]],
      [[118, 392], [110, 410], [104, 428]],
      [[168, 336], [150, 380], [146, 420]]
    ];
    const mirror = (seg) => seg.map(([x, y]) => [400 - x, y]);
    const segs = [...left, ...left.map(mirror)];
    const key = (p) => p[0] + ',' + p[1];
    const children = new Map();
    segs.forEach((s) => {
      const k = key(s[0]);
      if (!children.has(k)) children.set(k, []);
      children.get(k).push(s);
    });
    const twigs = [];
    const leaves = [];
    segs.forEach((s) => {
      if (children.has(key(s[2]))) return;
      const [x, y] = s[2];
      const [px, py] = s[1];
      const base = Math.atan2(y - py, x - px);
      for (let i = 0; i < 3; i++) {
        const a = base + (i - 1) * 0.65 + (r() - 0.5) * 0.3;
        const len = 10 + r() * 12;
        const end = [x + Math.cos(a) * len, y + Math.sin(a) * len];
        const mid = [x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 3, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 3];
        const tw = [[x, y], mid, end];
        twigs.push(tw);
        leaves.push({ x: end[0], y: end[1], cells: Array.from({ length: 5 }, () => ({ dx: (r() - 0.5) * 11, dy: (r() - 0.5) * 11, r: 1.6 + r() * 2.2, ph: r() * 6.28 })) });
      }
    });
    this.segs = segs;
    this.twigs = twigs;
    this.leaves = leaves;

    const trachea = [[200, 22], [200, 90], [200, 158]];
    const paths = [];
    const walk = (pts, seg, depth) => {
      const next = pts.concat([seg[1], seg[2]]);
      const kids = children.get(key(seg[2]));
      if (!kids || depth > 8) {
        twigs.filter((tw) => key(tw[0]) === key(seg[2])).forEach((tw) => paths.push(next.concat([tw[1], tw[2]])));
        return;
      }
      kids.forEach((k) => walk(next, k, depth + 1));
    };
    children.get('200,158').forEach((s) => walk(trachea.slice(), s, 0));
    this.paths = paths.map((pts) => {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts, cum, len: cum[cum.length - 1] };
    });
    this.depthOf = (y) => Math.min(1, Math.max(0, (y - 150) / 290));
  }

  spawn(u) {
    return { p: Math.floor(this.rand() * this.paths.length), u, sp: 0.75 + this.rand() * 0.6, sz: 0.8 + this.rand() * 0.9 };
  }

  at(path, u) {
    const d = Math.min(1, Math.max(0, u)) * path.len;
    const c = path.cum;
    let i = 1;
    while (i < c.length - 1 && c[i] < d) i++;
    const f = (d - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]);
    const a = path.pts[i - 1];
    const b = path.pts[i];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(this.cv.clientWidth * dpr);
    const h = Math.round(this.cv.clientHeight * dpr);
    if (w && h && (this.cv.width !== w || this.cv.height !== h)) {
      this.cv.width = w;
      this.cv.height = h;
    }
    return { w: this.cv.width, h: this.cv.height };
  }

  frame(b, dt, level = 0.5) {
    dt = Math.min(0.1, Math.max(0, dt));
    this.t += dt;
    this.prevB = this.b;
    this.b = b;
    const inst = dt > 0 ? (b - this.prevB) / dt : 0;
    this.flow += (inst - this.flow) * Math.min(1, dt * 8);
    this.level += (level - this.level) * Math.min(1, dt * 6);
    this.step(dt);
    this.draw();
  }

  step(dt) {
    const f = this.flow;
    this.particles.forEach((q) => {
      q.u += f * 1.35 * q.sp * dt;
      if (q.u > 1.02) Object.assign(q, this.spawn(-0.02 - this.rand() * 0.15));
      else if (q.u < -0.2) Object.assign(q, this.spawn(1 - this.rand() * 0.05));
    });
  }

  draw() {
    const { w, h } = this.resize();
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    const s = Math.min(w / 400, h / 470);
    g.setTransform(s, 0, 0, s, (w - 400 * s) / 2, (h - 470 * s) / 2);

    const b = this.b;
    const inhale = this.flow >= 0;
    const flowAmt = Math.min(1, Math.abs(this.flow) * 3.2);
    const lv = 0.35 + 0.65 * this.level;

    const halo = g.createRadialGradient(200, 300, 20, 200, 300, 230);
    halo.addColorStop(0, 'rgba(159,211,207,' + (0.05 + 0.13 * b * lv).toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(159,211,207,0)');
    g.fillStyle = halo;
    g.fillRect(-40, 60, 480, 440);

    const sx = 0.9 + 0.1 * b;
    const sy = 0.88 + 0.12 * b;
    g.save();
    g.translate(200, 170);
    g.scale(sx, sy);
    g.translate(-200, -170);

    const fill = g.createLinearGradient(0, 150, 0, 455);
    fill.addColorStop(0, 'rgba(159,211,207,' + (0.05 + 0.1 * b).toFixed(3) + ')');
    fill.addColorStop(1, 'rgba(159,211,207,' + (0.1 + 0.22 * b).toFixed(3) + ')');
    g.fillStyle = fill;
    g.fill(this.lobeL);
    g.fill(this.lobeR);
    g.lineWidth = 1.8;
    g.strokeStyle = 'rgba(159,211,207,' + (0.55 + 0.35 * b).toFixed(3) + ')';
    g.stroke(this.lobeL);
    g.stroke(this.lobeR);

    g.save();
    g.clip(this.clipPath);
    const front = b * 1.15;
    const drawSeg = (seg, width) => {
      const depth = this.depthOf(seg[2][1]);
      const lit = Math.max(0, Math.min(1, (front - depth) * 3));
      g.beginPath();
      g.moveTo(seg[0][0], seg[0][1]);
      g.quadraticCurveTo(seg[1][0], seg[1][1], seg[2][0], seg[2][1]);
      g.strokeStyle = 'rgba(159,211,207,' + (0.22 + 0.55 * lit).toFixed(3) + ')';
      g.lineWidth = width;
      g.stroke();
    };
    g.lineCap = 'round';
    this.segs.forEach((seg) => drawSeg(seg, seg[0][1] < 215 ? 3 : 1.7));
    this.twigs.forEach((tw) => drawSeg(tw, 1));

    this.leaves.forEach((lf) => {
      const depth = this.depthOf(lf.y);
      const lit = Math.max(0, Math.min(1, (front - depth) * 2.5));
      lf.cells.forEach((c) => {
        const wob = 1 + 0.08 * Math.sin(this.t * 2 + c.ph);
        const rr = c.r * (0.55 + 0.6 * b) * wob;
        g.beginPath();
        g.arc(lf.x + c.dx, lf.y + c.dy, rr, 0, Math.PI * 2);
        g.fillStyle = 'rgba(159,211,207,' + (0.08 + 0.4 * lit * lv).toFixed(3) + ')';
        g.fill();
      });
    });
    this.drawParticles(g, flowAmt, lv, inhale);
    g.restore();
    g.restore();

    g.lineCap = 'round';
    g.strokeStyle = 'rgba(159,211,207,0.85)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(193, 24);
    g.lineTo(193, 160);
    g.moveTo(207, 24);
    g.lineTo(207, 160);
    g.stroke();
    g.strokeStyle = 'rgba(159,211,207,0.35)';
    g.lineWidth = 1.2;
    g.beginPath();
    for (let y = 34; y < 156; y += 12) {
      g.moveTo(193, y);
      g.quadraticCurveTo(200, y + 4, 207, y);
    }
    g.stroke();

  }

  drawParticles(g, flowAmt, lv, inhale) {
    if (flowAmt <= 0.02) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const col = inhale ? '159,211,207' : '233,176,100';
    this.particles.forEach((q) => {
      if (q.u < 0 || q.u > 1) return;
      const [x, y] = this.at(this.paths[q.p], q.u);
      const fade = Math.min(1, q.u * 8, (1 - q.u) * 6);
      const a = flowAmt * lv * fade;
      if (a < 0.02) return;
      g.fillStyle = 'rgba(' + col + ',' + (0.18 * a).toFixed(3) + ')';
      g.beginPath();
      g.arc(x, y, 5 * q.sz, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(' + col + ',' + (0.9 * a).toFixed(3) + ')';
      g.beginPath();
      g.arc(x, y, 1.6 * q.sz, 0, Math.PI * 2);
      g.fill();
    });
    g.restore();
  }
}

if (typeof module !== 'undefined') module.exports = { LungsViz };