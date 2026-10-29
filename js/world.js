/* =====================================================================
 *  ĐẢO SÁNG THẾ — Lõi mô phỏng Trái Đất (không phụ thuộc đồ họa)
 *
 *  Bản đồ: lưới 256×128 ô, chiếu kinh–vĩ độ (mỗi ô ≈ 1,4°), nối vòng Đông–Tây.
 *  Mỗi ô lưu: độ cao, dung nham, nhiệt độ, hơi nước, mưa, độ ẩm đất, băng, độ phì,
 *  sinh vật biển, thực vật thấp, rừng, thú ăn cỏ, thú săn mồi, lửa, dịch bệnh, con người.
 *
 *  Mỗi tick:
 *    lịch sử (thời gian, khí hậu nền, sự kiện theo mốc)  → js/history.js
 *    kiến tạo mảng (lục địa trôi theo cổ địa lý thật)   → js/tectonics.js
 *    khí quyển → mực nước biển → nhiệt độ → dung nham → gió/mưa → đất/băng
 *    → sinh thái → sự kiện của Thần → tiến hóa → con người
 *
 *  Nếu Thần không can thiệp, lịch sử diễn ra như Trái Đất thật và kết thúc ở hiện tại.
 *  Mọi sự kiện Thần thêm vào chỉ "nhiễu" trạng thái; các quy luật tự nhiên quyết định
 *  hệ quả, nên dòng lịch sử có thể rẽ nhánh.
 * ===================================================================== */
(function (global) {
  'use strict';

  const W = 256, H = 128;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gauss = (v, m, s) => Math.exp(-((v - m) * (v - m)) / (2 * s * s));
  const DX8 = [1, -1, 0, 0, 1, 1, -1, -1], DY8 = [0, 0, 1, -1, 1, -1, 1, -1];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeNoise(rand) {
    const P = new Uint8Array(512), G = new Float32Array(256);
    for (let i = 0; i < 256; i++) { P[i] = i; G[i] = rand() * 2 - 1; }
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const a = G[P[P[X] + Y]], b = G[P[P[X + 1] + Y]], c = G[P[P[X] + Y + 1]], d = G[P[P[X + 1] + Y + 1]];
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  function fbm(n, x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f); norm += a; a *= 0.5; f *= 2; }
    return s / norm;
  }

  // Các trường trạng thái theo ô
  const FIELDS = ['h', 'lava', 'temp', 'tbase', 'tmod', 'vap', 'rain', 'cloud', 'moist', 'ice', 'fert', 'sea', 'grass', 'tree',
    'seedbank', 'herb', 'pred', 'fire', 'plague', 'human', 'deform', '_a', '_b'];

  class World {
    constructor(seed) {
      this.W = W; this.H = H; this.C = W * H; this.N = W;
      this.seed = seed ?? ((Math.random() * 1e9) | 0);
      this.rand = mulberry32(this.seed);
      for (const k of FIELDS) this[k] = new Float32Array(this.C);
      this.isOcean = new Uint8Array(this.C);
      this.mask = new Uint8Array(this.C).fill(1);
      this.cells = Array.from({ length: this.C }, (_, i) => i);
      this.buildGrid();
      this.historyInit();          // js/history.js — đặt this.ma (triệu năm trước) = 4540
      this.initEarth();            // js/tectonics.js — vỏ Trái Đất & lục địa
      this.initState();
    }

    // ---------------------------------------------------------------- lưới cầu
    buildGrid() {
      const C = this.C;
      this.lat = new Float32Array(C); this.lon = new Float32Array(C); this.latN = new Float32Array(C); this.wgt = new Float32Array(C);
      this.vec = new Array(C);
      this.nb = new Int32Array(C * 4).fill(-1);
      this.windX = new Float32Array(C); this.windY = new Float32Array(C); this.dryBelt = new Float32Array(C);
      let ws = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, la = 90 - ((y + 0.5) * 180) / H, lo = -180 + ((x + 0.5) * 360) / W;
        this.lat[i] = la; this.lon[i] = lo; this.latN[i] = la / 90; this.wgt[i] = Math.cos((la * Math.PI) / 180); ws += this.wgt[i];
        const a = (la * Math.PI) / 180, b = (lo * Math.PI) / 180;
        this.vec[i] = [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
        for (let q = 0; q < 4; q++) {
          const ny = y + DY8[q]; if (ny < 0 || ny >= H) continue;
          this.nb[i * 4 + q] = ny * W + ((x + DX8[q] + W) % W);
        }
        // Hoàn lưu khí quyển: gió mậu dịch (0–30°), gió Tây (30–60°), gió Đông cực (>60°)
        const al = Math.abs(la), hemi = la >= 0 ? 1 : -1;
        if (al < 30) { this.windX[i] = -0.6; this.windY[i] = 0.2 * hemi; }
        else if (al < 60) { this.windX[i] = 0.7; this.windY[i] = -0.15 * hemi; }
        else { this.windX[i] = -0.4; this.windY[i] = 0.1 * hemi; }
        // Vành đai khô cận chí tuyến (khí chìm của vòng Hadley) & mưa xích đạo (ITCZ)
        this.dryBelt[i] = 1.2 * gauss(al, 24, 8) - 0.45 * gauss(la, 3, 6);
      }
      this.wsum = ws;
      this.wind = { x: 0.5, y: 0 };
      this.monsoon = new Float32Array(C); this.maritime = new Float32Array(C);
      // Tính sẵn (gió & vĩ độ không đổi): nguồn bình lưu, điểm đón gió, hệ số nhiệt
      this.advI = new Int32Array(C * 4); this.advW = new Float32Array(C * 4); this.upI = new Int32Array(C);
      this.latT = new Float32Array(C); this.amp = new Float32Array(C); this.westerly = new Float32Array(C);
      for (let i = 0; i < C; i++) {
        const x = i % W, y = (i / W) | 0, ax = Math.abs(this.latN[i]);
        let fx = x - this.windX[i], fy = clamp(y - this.windY[i], 0, H - 1);
        fx = ((fx % W) + W) % W;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % W, y1 = Math.min(H - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
        this.advI.set([y0 * W + x0, y0 * W + x1, y1 * W + x0, y1 * W + x1], i * 4);
        this.advW.set([(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty], i * 4);
        this.upI[i] = this.idx(x - this.windX[i] * 2, y - this.windY[i] * 2);
        this.latT[i] = 13.6 - 52.5 * Math.pow(ax, 1.84);
        this.amp[i] = 1 + 2.5 * ax;
        this.westerly[i] = smooth(30, 45, Math.abs(this.lat[i])) * (1 - smooth(62, 75, Math.abs(this.lat[i])));
      }
    }
    nbr8(i, q) {
      const x = i % W, y = (i / W) | 0, ny = y + DY8[q];
      if (ny < 0 || ny >= H) return -1;
      return ny * W + ((x + DX8[q] + W) % W);
    }

    // ---------------------------------------------------------------- trạng thái ban đầu
    initState() {
      this.tick = 0;
      this.T = 1700; this.CO2 = 100; this.O2 = 0; this.ozone = 0;
      this.aerosol = 0.3; this.forcing = 0; this.volcOut = 0; this.fireCO2 = 0;
      this.prebiotic = 0; this.condensing = 0;
      let V = 0;
      for (const i of this.cells) if (this.h[i] < 0) V -= this.h[i];
      this.waterTotal = V; this.atmoWater = V; this.oceanVol = 0; this.oceansDone = false;
      for (const i of this.cells) { this.lava[i] = 1; this.vap[i] = 0.3; }
      this.photosynthesis = false; this.lifeEver = false;
      this.present = { sea: false, grass: false, tree: false, herb: false, pred: false, human: false };
      this.milestones = {};
      this.events = []; this.incoming = []; this.visuals = []; this.logs = []; this.history = [];
      this.natural = true; this.eventId = 1; this.logSeq = 0; this.lastExtinction = -9999;
      this.godActs = 0;
      this.updateSeaLevel(); this.computeTemp(); this.computeStats();
      this.log('🌑 4,54 tỷ năm trước — Trái Đất ngưng tụ từ đĩa bụi khí quanh Mặt Trời non trẻ.', 'milestone');
    }

    // ---------------------------------------------------------------- tiện ích
    wrapX(x) { return ((x % W) + W) % W; }
    idx(x, y) { return clamp(Math.round(y), 0, H - 1) * W + this.wrapX(Math.round(x)); }
    dx(a, b) { let d = a - b; if (d > W / 2) d -= W; else if (d < -W / 2) d += W; return d; }
    forDisk(cx, cy, r, fn) {
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) for (let ox = Math.floor(-r) - 1; ox <= Math.ceil(r) + 1; ox++) {
        const x = Math.floor(cx) + ox, d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        fn(y * W + this.wrapX(x), 1 - (d / r) * (d / r), d, this.wrapX(x), y);
      }
    }
    bil(arr, fx, fy, def) {
      if (fy < 0 || fy > H - 1) return def;
      fx = ((fx % W) + W) % W;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % W, y1 = Math.min(H - 1, y0 + 1);
      const tx = fx - x0, ty = fy - y0;
      return (arr[y0 * W + x0] * (1 - tx) + arr[y0 * W + x1] * tx) * (1 - ty) + (arr[y1 * W + x0] * (1 - tx) + arr[y1 * W + x1] * tx) * ty;
    }
    randomCell(pred, tries = 60) {
      for (let k = 0; k < tries; k++) {
        const i = (this.rand() * this.C) | 0;
        if (!pred || pred(i)) return i;
      }
      return -1;
    }
    log(text, kind = 'info', extra) {
      this.logs.push(Object.assign({ seq: ++this.logSeq, tick: this.tick, ma: this.ma, text, kind }, extra));
      if (this.logs.length > 400) this.logs.shift();
    }
    request(type, x, y, opts = {}) { this.incoming.push({ type, x, y, opts }); }
    flushIncoming() { while (this.incoming.length) { const r = this.incoming.shift(); this.addEvent(r.type, r.x, r.y, r.opts); } }

    // ---------------------------------------------------------------- vòng lặp chính
    step() {
      if (this.ended && !this.future) return;
      this.tick++;
      this.historyStep();           // thời gian & khí hậu nền theo lịch sử, sự kiện theo mốc
      this.updateGlobals();
      this.stepTectonics();
      this.updateSeaLevel();
      this.computeTemp();
      this.stepLava();
      this.stepAtmosphere();
      this.stepSurface();
      this.stepLife();
      this.stepHumans();
      this.stepEvents();
      this.computeStats();
      this.stepEvolution();
      this.checkMilestones();
      if (this.natural) this.stepNatural();
      if (this.tick % 4 === 0) {
        const s = this.stats;
        this.history.push({ ma: this.ma, T: this.T, CO2: this.CO2, O2: this.O2, plant: s.grass + s.tree, animal: s.herb + s.pred, sea: s.sea, ice: s.iceAvg });
        if (this.history.length > 400) this.history.shift();
      }
    }

    // Khí quyển toàn cầu: nhiệt độ, nước, carbon, oxy
    updateGlobals() {
      const hist = this.hist;
      this.condensing = 0;
      if (this.T < 100 && this.atmoWater > 0.001) {
        const c = this.atmoWater * 0.03 * clamp((100 - this.T) / 40, 0.15, 1);
        this.atmoWater -= c; this.oceanVol += c; this.condensing = c / this.waterTotal;
      } else if (this.T > 115 && this.oceanVol > 0) {
        const c = this.oceanVol * 0.02 * clamp((this.T - 115) / 60, 0, 1);
        this.oceanVol -= c; this.atmoWater += c;
      }
      const s = this.stats, light = 1 - 0.7 * this.aerosol;
      const photo = ((this.photosynthesis ? s.sea : 0) + 1.2 * s.grass + 2 * s.tree) * light;
      if (!this.future) {
        // Khí hậu nền theo dữ liệu cổ khí hậu; tác động của Thần cộng thêm và tắt dần
        this.CO2 += (hist.CO2 - this.CO2) * (this.ma < 0.0003 ? 0.4 : 0.15) + this.volcOut + this.fireCO2;
        this.O2 += ((this.photosynthesis || hist.O2 > 0.05 ? hist.O2 : 0) - this.O2) * 0.04 - this.fireCO2 * 0.5;
        const target = hist.T + 9 * Math.log2(Math.max(0.05, this.CO2) / hist.CO2) + this.forcing - 30 * this.aerosol;
        this.T += (target - this.T) * 0.2;
      } else {
        // Tương lai: chu trình carbon tự do (núi lửa, phong hóa, quang hợp) + phản hồi băng
        const weather = 0.004 * this.CO2 * s.oceanFrac * clamp(1 + (this.T - 15) / 25, 0.2, 3);
        this.CO2 += 0.004 + this.volcOut - weather - 0.004 * photo * this.CO2 / (this.CO2 + 1) + this.fireCO2 + this.humanCO2;
        this.CO2 = clamp(this.CO2, 0.08, 200);
        this.O2 += 0.012 * photo - 0.012 * this.O2 - this.fireCO2 * 0.5;
        const target = 14.5 + 9 * Math.log2(this.CO2 / 1.5) + this.forcing - 22 * (s.iceAvg - 0.06) - 30 * this.aerosol;
        this.T += (target - this.T) * 0.06;
      }
      this.CO2 = clamp(this.CO2, 0.08, 300); this.O2 = clamp(this.O2, 0, 1.8);
      this.volcOut = 0; this.fireCO2 = 0;
      this.ozone = smooth(0.02, 0.25, this.O2);
      this.aerosol *= 0.985; this.forcing *= 0.99; this.prebiotic *= 0.995;
    }

    // Mực nước biển: thời sơ khai tính theo thể tích nước; sau đó theo đường cong lịch sử + băng tan/đóng
    updateSeaLevel() {
      const { h, C } = this;
      if (!this.oceansDone) {
        const vol = this.oceanVol;
        if (vol <= 1e-6) this.seaLevel = -2;
        else {
          let lo = -2, hi = 2;
          for (let it = 0; it < 20; it++) {
            const mid = (lo + hi) / 2;
            let v = 0;
            for (let i = 0; i < C; i++) { const d = mid - h[i]; if (d > 0) v += d; }
            if (v > vol) hi = mid; else lo = mid;
          }
          this.seaLevel = lo;
        }
        if (this.atmoWater < 0.03 * this.waterTotal && this.seaLevel > -0.05) this.oceansDone = true;
      } else {
        const dT = this.T - this.hist.Tq;           // so với khí hậu "chuẩn" của thời kỳ
        const ice = this.hist.icehouse;             // có các khối băng lục địa không?
        let s = this.hist.sea;
        if (ice) s += dT < 0 ? Math.max(-0.016, dT * 0.0028) : Math.min(0.009, dT * 0.0022);
        this.seaLevel += (s - this.seaLevel) * 0.2;
      }
      for (let i = 0; i < C; i++) this.isOcean[i] = h[i] < this.seaLevel ? 1 : 0;
    }

    // Nhiệt độ cục bộ: toàn cầu + vĩ độ (khuếch đại ở cực) – độ cao + biến động cục bộ
    computeTemp() {
      const { h, latT: LT, amp, temp, tbase, tmod, lava, fire, isOcean } = this;
      const sea = this.seaLevel, T = this.T, anom = T - 14.5;
      for (let i = 0; i < this.C; i++) {
        const latT = LT[i];
        const g = 14.5 + anom * amp[i];
        let t = isOcean[i] ? g + 0.75 * latT + 2 : g + latT - 45 * Math.max(0, h[i] - sea) + 5 * this.maritime[i] * this.westerly[i];
        t += tmod[i];
        tmod[i] *= 0.985;
        tbase[i] = t;
        temp[i] = t + lava[i] * 700 + fire[i] * 40;
      }
    }

    // Dung nham: nguội → đông thành đá, chảy xuống chỗ thấp, thiêu rụi sự sống
    stepLava() {
      const { nb, h, lava, tbase, isOcean } = this;
      const d = this._a; d.fill(0);
      for (let i = 0; i < this.C; i++) {
        const l = lava[i];
        if (l <= 0.001) { lava[i] = 0; continue; }
        let cool = tbase[i] < 1100 ? 0.012 * (1 + (1100 - tbase[i]) / 250) : 0;
        if (isOcean[i]) cool += 0.05;
        cool = Math.min(l, cool);
        d[i] -= cool;
        if (this.oceansDone) this.deform[i] += cool * 0.03;      // dung nham đông lại thành núi/đảo
        this.fert[i] = Math.min(1, this.fert[i] + cool * 0.15);
        if (this.oceansDone && l > 0.15) {
          let best = -1, bestLvl = h[i] + l * 0.05;
          for (let q = 0; q < 4; q++) {
            const j = nb[i * 4 + q]; if (j < 0) continue;
            const lv = h[j] + lava[j] * 0.05;
            if (lv < bestLvl) { bestLvl = lv; best = j; }
          }
          if (best >= 0) {
            const amt = Math.min(0.2 * l, (h[i] + l * 0.05 - bestLvl) * 4);
            if (amt > 0) { d[i] -= amt; d[best] += amt; }
          }
        }
        if (l > 0.1) {
          this.grass[i] = this.tree[i] = this.herb[i] = this.pred[i] = this.seedbank[i] = this.human[i] = 0;
          this.sea[i] *= 0.5; this.ice[i] = 0;
        }
      }
      for (let i = 0; i < this.C; i++) lava[i] = clamp(lava[i] + d[i], 0, 1.5);
    }

    // Gió mùa: biển ở phía xích đạo + cao nguyên lớn ở phía cực bị nắng hè đốt nóng hút gió ẩm vào
    // (Ấn Độ & Đông Nam Á nhờ Tây Tạng). Ả Rập, Sahara không có cao nguyên như vậy nên vẫn khô.
    updateMonsoon() {
      const { isOcean, monsoon, h } = this, sea0 = this.seaLevel;
      for (let i = 0; i < this.C; i++) {
        const x = i % W, y = (i / W) | 0, la = this.lat[i], al = Math.abs(la);
        monsoon[i] = 0;
        if (al < 5 || al > 32 || isOcean[i]) continue;
        const eq = la > 0 ? 1 : -1;
        let sea = 0, top = 0;
        for (let d = 1; d <= 9; d++) { const yy = y + eq * d; if (yy >= 0 && yy < H && isOcean[yy * W + x]) { sea = 1; break; } }
        for (let d = 2; d <= 16; d += 2) { const yy = y - eq * d; if (yy >= 0 && yy < H) top = Math.max(top, h[yy * W + x] - sea0); }
        monsoon[i] = sea * smooth(0.3, 0.5, top);
      }
      // Tính "hải dương" của khí hậu: tỉ lệ biển ở phía đón gió (≤ 10 ô)
      const { maritime, windX } = this;
      for (let i = 0; i < this.C; i++) {
        if (isOcean[i]) { maritime[i] = 1; continue; }
        const x = i % W, y = (i / W) | 0, sx = windX[i] > 0 ? -1 : 1;
        let n = 0; for (let d = 1; d <= 10; d++) if (isOcean[y * W + ((x + sx * d + W) % W)]) n += 1 / d;
        maritime[i] = Math.min(1, n / 1.5);
      }
    }

    // Gió theo đới vĩ độ – bốc hơi – mây – mưa (mưa địa hình, bóng mưa, vành đai sa mạc)
    stepAtmosphere() {
      if (this.tick % 20 === 1) this.updateMonsoon();
      const { h, isOcean, temp, vap, rain, cloud, moist, ice, grass, tree, dryBelt, upI, advI, advW } = this;
      const sea = this.seaLevel;
      for (let i = 0; i < this.C; i++) {
        const t = temp[i];
        let e;
        if (isOcean[i]) e = 0.03 * clamp((t + 5) / 35, 0, 1.6) * (1 - 0.9 * ice[i]);
        else e = 0.01 * moist[i] * clamp((t + 5) / 35, 0, 1.3) * (0.3 + grass[i] + tree[i]) * (1 - 0.8 * Math.min(1, Math.max(0, dryBelt[i]) * (1 - this.monsoon[i])));
        let v = vap[i] + e;
        let cap = 0.5 * Math.exp(0.03 * (clamp(t, -40, 80) - 15)) * (1 + dryBelt[i]);
        const hu = Math.max(sea, h[upI[i]]);
        const lift = Math.max(sea, h[i]) - hu;
        if (lift > 0) cap /= 1 + lift * 20;
        const dry = Math.max(0, dryBelt[i]) * (1 - 0.75 * this.monsoon[i]);
        const r = Math.max(0, v - cap) * 0.3 + v * 0.003 * (1 - 0.85 * Math.min(1, dry));
        v -= r + v * 0.03 * dry;                       // khí chìm khô nóng của vòng Hadley
        vap[i] = v; rain[i] = r; cloud[i] = v / cap;
      }
      const out = this._a;
      for (let i = 0, k = 0; i < this.C; i++, k += 4) out[i] = vap[advI[k]] * advW[k] + vap[advI[k + 1]] * advW[k + 1] + vap[advI[k + 2]] * advW[k + 2] + vap[advI[k + 3]] * advW[k + 3];
      vap.set(out);
    }

    // Độ ẩm đất, băng tuyết (chỉ tích tụ khi MÙA HÈ đủ lạnh), độ phì, xói mòn
    stepSurface() {
      const { nb, h, isOcean, temp, rain, moist, ice, fert, lava, grass, tree, latN } = this;
      for (let i = 0; i < this.C; i++) {
        const t = temp[i], ax = Math.abs(latN[i]);
        if (isOcean[i]) {
          moist[i] = 1;
          const summer = t + 4 * ax;
          if (summer < -1.5) ice[i] = Math.min(1, ice[i] + 0.02 * clamp((-1.5 - summer) / 4, 0.1, 1));
          else if (ice[i] > 0) ice[i] = Math.max(0, ice[i] - 0.03 * (0.3 + Math.max(0, summer) / 4));
          continue;
        }
        const r = rain[i], cover = Math.min(1, grass[i] + tree[i]);
        let avg = 0, k = 0, slope = 0;
        for (let q = 0; q < 4; q++) {
          const j = nb[i * 4 + q]; if (j < 0) continue;
          avg += isOcean[j] ? 0.6 : moist[j]; k++;
          const dh = Math.abs(h[i] - h[j]); if (dh > slope) slope = dh;
        }
        const conv = t > 15 ? Math.max(0, -this.dryBelt[i]) * 0.012 : 0;     // mưa đối lưu xích đạo (ITCZ)
        let m = moist[i] + r * 0.8 + this.monsoon[i] * 0.006 + conv - 0.005 * moist[i] * clamp((t + 10) / 30, 0.05, 2.5) * (1 - 0.35 * cover) * (1 + 5 * Math.max(0, this.dryBelt[i]) * (1 - 0.75 * this.monsoon[i]));
        if (k) m += 0.04 * (avg / k - m);
        if (lava[i] > 0.05) m *= 0.8;
        moist[i] = clamp(m, 0, 1);
        const summer = t + 14 * ax;
        if (lava[i] > 0.05) ice[i] = 0;
        else if (summer < 0) ice[i] = Math.min(1, ice[i] + 0.0015 + r * 3);     // băng lớn theo lượng tuyết rơi (vùng khô như Siberia ít băng)
        else if (ice[i] > 0 && summer > 1) ice[i] = Math.max(0, ice[i] - 0.02 * (0.5 + summer / 3));
        fert[i] = clamp(fert[i] + 0.0015 * cover - 0.0004 * fert[i] - r * slope * 3 * (1 - cover) * fert[i], 0, 1);
      }
    }

    // Sinh thái: sinh vật biển, thực vật thấp, rừng, thú ăn cỏ, thú săn mồi, lửa, dịch bệnh
    stepLife() {
      const { nb, isOcean, temp, moist, fert, ice, lava, sea, grass, tree, seedbank, herb, pred, fire, plague, rain, windX, windY } = this;
      const R = this.rand;
      const uvShield = this.ozone, light = 1 - 0.7 * this.aerosol, o2ok = smooth(0.15, 0.5, this.O2);
      const fireN = this._a, plN = this._b;
      fireN.fill(0); plN.fill(0);
      for (let i = 0; i < this.C; i++) {
        const t = temp[i];
        if (isOcean[i]) {
          const suit = (t > -2 && t < 95 ? gauss(t, 26, 24) : 0) * (1 - 0.7 * ice[i]) * light;
          let avg = 0, k = 0;
          for (let q = 0; q < 4; q++) { const j = nb[i * 4 + q]; if (j >= 0 && isOcean[j]) { avg += sea[j]; k++; } }
          let s = sea[i];
          avg = k ? avg / k : s;
          s += 0.05 * s * (1 - s) * suit - 0.012 * s * (1 - suit) + 0.12 * (avg - s) * (suit > 0.05 ? 1 : 0.3);
          if (lava[i] > 0.2) s *= 0.5;
          sea[i] = s < 1e-5 ? 0 : Math.min(1, s);
          if (grass[i] || tree[i] || herb[i] || pred[i]) grass[i] = tree[i] = herb[i] = pred[i] = 0;
          seedbank[i] *= 0.9;
          continue;
        }
        if (sea[i] > 0) { fert[i] = Math.min(1, fert[i] + sea[i] * 0.3); sea[i] = 0; }

        const m = moist[i], f = fert[i], alive = lava[i] < 0.05 ? 1 : 0, summer = t + 14 * Math.abs(this.latN[i]);
        // cỏ cần mùa hè > 0°C; cây gỗ cần mùa hè > ~8°C (giới hạn rừng taiga ↔ đài nguyên)
        const suitG = alive * gauss(t, 18, 18) * smooth(-1, 6, summer) * smooth(0.09, 0.32, m) * (1 - 0.9 * ice[i]) * uvShield * light * (0.5 + 0.5 * Math.min(1, f * 3));
        const suitT = alive * gauss(t, 14, 17) * smooth(4, 11, summer) * smooth(0.28, 0.6, m) * (1 - ice[i]) * uvShield * light * (0.3 + 0.7 * Math.min(1, f * 2.5)) * (this.treesOK ? 1 : 0);

        let aG = 0, aT = 0, aH = 0, aP = 0, k = 0;
        for (let q = 0; q < 4; q++) {
          const j = nb[i * 4 + q];
          if (j >= 0 && !isOcean[j]) { aG += grass[j]; aT += tree[j]; aH += herb[j]; aP += pred[j]; k++; }
        }
        if (k) { aG /= k; aT /= k; aH /= k; aP /= k; }
        let g = grass[i], tr = tree[i], hb = herb[i], pd = pred[i];

        const sb = seedbank[i];
        if (sb > 0.001) {
          const germ = sb * 0.06 * suitG;
          g += germ; if (suitT > 0.25) tr += germ * 0.3;
          seedbank[i] = sb - germ - sb * 0.004;
        } else seedbank[i] = 0;

        g += 0.1 * g * (1 - g - 0.5 * tr) * suitG - 0.03 * g * (1 - suitG) + 0.06 * aG * suitG * (1 - g);
        tr += 0.05 * tr * (1 - tr) * suitT - 0.012 * tr * (1 - suitT) + 0.05 * aT * suitT * (1 - tr);

        if (hb > 0 || aH > 0) {
          const food = g + 0.3 * tr, tOK = gauss(t, 20, 17) * o2ok;
          hb += 0.08 * hb * (food / (food + 0.25)) * tOK - 0.03 * hb - 0.07 * hb * hb - 0.25 * hb * pd
            - 0.04 * hb * (1 - tOK) + 0.12 * (aH - hb);
          g -= 0.025 * hb * g / (g + 0.15);
          tr -= 0.006 * hb * tr / (tr + 0.3);
        }
        if (pd > 0 || aP > 0) {
          const tOK = gauss(t, 18, 18) * o2ok;
          pd += 0.3 * hb * pd * tOK - 0.022 * pd - 0.03 * pd * pd + 0.1 * (aP - pd);
        }

        const pl = plague[i];
        if (pl > 0) {
          hb -= 0.15 * pl * hb; pd -= 0.06 * pl * pd; this.human[i] *= 1 - 0.05 * pl;
          const np = pl * 0.985 - (hb < 0.03 ? 0.1 : 0);
          if (np > 0.01) plN[i] = Math.max(plN[i], np);
          for (let q = 0; q < 4; q++) {
            const j = nb[i * 4 + q];
            if (j >= 0 && !isOcean[j] && R() < 0.3) plN[j] = Math.max(plN[j], pl * 0.9 * Math.min(1, (herb[j] + this.human[j]) * 8));
          }
        }

        const fi = fire[i];
        if (fi > 0) {
          const fuel = g + 1.5 * tr;
          g *= 1 - 0.35 * fi; tr *= 1 - 0.12 * fi; hb *= 1 - 0.3 * fi; pd *= 1 - 0.3 * fi;
          seedbank[i] *= 1 - 0.1 * fi;
          fert[i] = Math.min(1, f + 0.01 * fi);
          this.fireCO2 += 0.00002 * fi * fuel;
          const nf = fi * 0.9 * Math.min(1, fuel * 2.5) * (1 - 0.5 * m) - rain[i] * 15;
          if (nf > 0.03) fireN[i] = Math.max(fireN[i], Math.min(1, nf));
          for (let q = 0; q < 4; q++) {
            const j = nb[i * 4 + q];
            if (j < 0 || isOcean[j] || fire[j] > 0.3) continue;
            const fuelJ = grass[j] + 1.5 * tree[j], dry = 1 - moist[j];
            const align = 1 + (DX8[q] * windX[i] + DY8[q] * windY[i]);
            if (R() < 0.3 * fi * fuelJ * dry * dry * align) fireN[j] = Math.max(fireN[j], 0.6);
          }
        } else if (g + tr > 0.3 && m < 0.2 && t > 22 && R() < 0.000012) fireN[i] = 0.6;

        grass[i] = g < 1e-5 ? 0 : clamp(g, 0, 1);
        tree[i] = tr < 1e-5 ? 0 : clamp(tr, 0, 1);
        herb[i] = hb < 1e-5 ? 0 : clamp(hb, 0, 1.5);
        pred[i] = pd < 1e-5 ? 0 : clamp(pd, 0, 1);
      }
      fire.set(fireN); plague.set(plN);
      // Hải lưu & phát tán hạt đường xa (gió, chim)
      if (this.stats.sea > 0) for (let k = 0; k < 90; k++) {
        const j = this.randomCell((c) => isOcean[c], 3); if (j < 0) continue;
        const x = (j % W) + (R() - 0.5) * 40, y = ((j / W) | 0) + (R() - 0.5) * 20;
        const src = this.bil(sea, x, y, 0);
        if (src > 0.05) sea[j] = Math.min(1, sea[j] + 0.1 * src);
      }
      if (this.stats.grass + this.stats.tree > 0) for (let k = 0; k < 120; k++) {
        const j = this.randomCell((c) => !isOcean[c], 3); if (j < 0) continue;
        const d = 2 + R() * 10, x = (j % W) - windX[j] * d + (R() - 0.5) * 6, y = ((j / W) | 0) - windY[j] * d + (R() - 0.5) * 6;
        const src = this.bil(grass, x, y, 0) + this.bil(tree, x, y, 0);
        if (src > 0.05) seedbank[j] = Math.min(1, seedbank[j] + 0.25 * src);
      }
    }

    // ---------------------------------------------------------------- sự kiện
    addEvent(type, x, y, opts = {}) {
      const def = global.GOD_EVENTS[type];
      if (!def) return null;
      const p = opts.p ?? 1, S = global.GOD_SCALE || 1.5;
      const e = {
        id: this.eventId++, type, x, y, x0: x, y0: y, p, age: 0,
        r: opts.r ?? (def.r ?? 6) * S, natural: !!opts.natural, chain: !!opts.chain, scripted: !!opts.scripted, data: {},
      };
      e.dur = typeof def.duration === 'function' ? def.duration(p) : (def.duration ?? 1);
      e.repR = def.reportR ? def.reportR * S : e.r * 1.6;
      e.before = def.kind === 'global' ? this.globalSnapshot() : this.regionStats(x, y, e.repR);
      if (!e.natural && !e.chain && !e.scripted) this.godActs++;
      const where = def.kind === 'global' ? 'toàn hành tinh' : this.placeName(x, y);
      if (!opts.quiet) {
        const who = e.scripted ? 'lịch sử' : e.chain ? 'hệ quả' : e.natural ? 'tự nhiên' : 'Thần';
        this.log(`${def.icon} ${opts.title || def.name} — ${where} (${who})`, e.scripted ? 'history' : e.chain ? 'chain' : e.natural ? 'natural' : 'god');
      }
      const msg = def.start ? def.start(this, e) : null;
      if (msg && !opts.quiet) this.log('↳ ' + msg, 'effect');
      this.events.push(e);
      this.visuals.push({ kind: 'start', type, id: e.id, x: e.x, y: e.y, r: e.r, p });
      return e;
    }
    stepEvents() {
      for (let k = this.events.length - 1; k >= 0; k--) {
        const e = this.events[k], def = global.GOD_EVENTS[e.type];
        if (e.age < e.dur && def.tick) def.tick(this, e);
        e.age++;
        if (e.age === e.dur && def.end) { const m = def.end(this, e); if (m) this.log('↳ ' + m, 'effect'); }
        if (e.age >= e.dur + (def.settle ?? 40)) { if (!e.natural || e.type === 'meteor') this.report(e); this.events.splice(k, 1); }
      }
    }
    report(e) {
      const def = global.GOD_EVENTS[e.type], b = e.before;
      const a = def.kind === 'global' ? this.globalSnapshot() : this.regionStats(e.x0, e.y0, e.repR);
      const out = [];
      const pct = (key, label) => {
        const bv = b[key], av = a[key];
        if (bv < 0.004 && av < 0.004) return;
        if (bv < 0.004) { out.push(`${label} xuất hiện`); return; }
        if (av < 0.0005) { out.push(`${label} biến mất`); return; }
        const d = (av - bv) / bv;
        if (Math.abs(d) >= 0.1) out.push(`${label} ${d > 0 ? '+' : ''}${Math.round(d * 100)}%`);
      };
      if (def.kind === 'global') out.push(`nhiệt độ ${b.T.toFixed(0)}→${a.T.toFixed(0)}°C`);
      pct('plant', 'thực vật'); pct('animal', 'động vật'); pct('sea', 'sinh vật biển'); pct('ice', 'băng'); pct('human', 'con người');
      const dl = a.land - b.land;
      const geo = ['volcano', 'meteor', 'earthquake', 'tsunami', 'iceage', 'warming'].includes(e.type);   // lục địa trôi không tính là do sự kiện
      if (geo && Math.abs(dl) > 0.02) out.push(def.kind === 'global' ? (dl > 0 ? 'mực nước biển hạ' : 'mực nước biển dâng') : `đất liền ${dl > 0 ? '+' : ''}${Math.round(dl * 100)}% diện tích`);
      if (def.kind !== 'global') { if (a.fert - b.fert > 0.04) out.push('đất màu mỡ hơn'); else if (b.fert - a.fert > 0.04) out.push('đất bạc màu'); }
      this.log(`📋 Kết quả ${def.icon} ${def.name}: ${out.length ? out.join(', ') : 'hệ sinh thái gần như không đổi'}.`, 'result');
    }
    regionStats(x, y, r) {
      let n = 0, land = 0, plant = 0, animal = 0, sea = 0, ice = 0, fert = 0, human = 0;
      this.forDisk(x, y, r, (i) => {
        n++; if (!this.isOcean[i]) land++;
        plant += this.grass[i] + this.tree[i]; animal += this.herb[i] + this.pred[i]; human += this.human[i];
        sea += this.sea[i]; ice += this.ice[i]; fert += this.fert[i];
      });
      n = n || 1;
      return { land: land / n, plant: plant / n, animal: animal / n, sea: sea / n, ice: ice / n, fert: fert / n, human: human / n };
    }
    globalSnapshot() {
      const s = this.stats;
      return { T: this.T, CO2: this.CO2, O2: this.O2, plant: s.grass + s.tree, animal: s.herb + s.pred, sea: s.sea, ice: s.iceAvg, land: 1 - s.oceanFrac, human: s.human };
    }

    // Thiên nhiên tự sinh sự kiện (quá trình Poisson), núi lửa/động đất ở ranh giới mảng
    stepNatural() {
      const R = this.rand, s = this.stats, B = this.boundary || { conv: [], div: [], trans: [] }, S = global.GOD_SCALE || 1.5;
      if (this.events.filter((e) => e.natural).length >= 6) return;
      const fire = (p, type, pick, opts) => {
        if (R() >= p) return;
        const i = pick();
        if (i >= 0) this.request(type, i % W, (i / W) | 0, Object.assign({ natural: true, p: 0.5 + R() * 0.6 }, opts));
      };
      const any = () => this.randomCell();
      const land = () => this.randomCell((i) => !this.isOcean[i]);
      const pick = (list) => (list.length ? list[(R() * list.length) | 0] : any());
      fire(this.hist.meteorRate, 'meteor', any, { r: (2 + R() * 3) * S, p: 0.4 + R() * 0.5 });
      if (s.lavaFrac < 0.5) {
        fire(0.004, 'volcano', () => pick(R() < 0.75 ? B.conv : B.div));
        fire(0.004, 'earthquake', () => pick(R() < 0.6 ? B.conv : B.trans));
      }
      if (s.oceanFrac > 0.1 && this.T > 5 && this.T < 60) fire(0.01, 'storm', () => this.randomCell((i) => this.isOcean[i] && this.temp[i] > 26 && Math.abs(this.lat[i]) > 6 && Math.abs(this.lat[i]) < 25), { r: 5 * S });
      if (s.grass + s.tree > 0.02) fire(0.002, 'drought', land, { r: 7 * S });
      if (s.herb > 0.02) fire(0.0008, 'plague', () => this.randomCell((i) => this.herb[i] > 0.1));
    }

    checkMilestones() {
      const s = this.stats, m = this.milestones;
      const once = (key, cond, text) => { if (!m[key] && cond) { m[key] = this.tick; this.log(text, 'milestone'); } };
      once('crust', s.lavaFrac < 0.3, '🪨 Bề mặt nguội dần — lớp vỏ đá đầu tiên hình thành.');
      once('rain', this.condensing > 0, '🌧️ Nhiệt độ xuống dưới 100°C — trận mưa kéo dài hàng triệu năm bắt đầu.');
      const NAMES = { sea: 'Sinh vật biển', grass: 'Thực vật trên cạn', tree: 'Rừng', herb: 'Động vật ăn cỏ trên cạn', pred: 'Động vật săn mồi trên cạn', human: 'Con người' };
      for (const k of Object.keys(NAMES)) {
        const v = s[k];
        if (!this.present[k] && v > 1e-4) {
          this.present[k] = true;
          if (m['first_' + k]) this.log(`🔁 ${NAMES[k]} tái xuất hiện.`, 'event');
          m['first_' + k] = m['first_' + k] || this.tick;
        } else if (this.present[k] && v === 0) {
          this.present[k] = false;
          this.log(`💀 Tuyệt chủng: ${NAMES[k]} đã biến mất khỏi Trái Đất.`, 'extinct');
        }
      }
      const bio = s.grass + s.tree + 3 * (s.herb + s.pred) + 0.5 * s.sea;
      const hist = this.history.slice(-30);
      const peak = hist.reduce((mx, h) => Math.max(mx, h.plant + 3 * h.animal + 0.5 * h.sea), 0);
      if (peak > 0.05 && bio < 0.5 * peak && this.tick - this.lastExtinction > 150) {
        this.lastExtinction = this.tick;
        this.log(`☠️ Sinh khối toàn cầu sụt ${Math.round((1 - bio / peak) * 100)}% — một cuộc khủng hoảng sinh thái lớn.`, 'extinct');
      }
    }

    computeStats() {
      let ws = 0, lava = 0, ocean = 0, ice = 0, sea = 0, grass = 0, tree = 0, herb = 0, pred = 0, fire = 0, human = 0;
      for (let i = 0; i < this.C; i++) {
        const w = this.wgt[i]; ws += w;
        if (this.lava[i] > 0.3) lava += w;
        if (this.isOcean[i]) ocean += w;
        ice += this.ice[i] * w; sea += this.sea[i] * w; grass += this.grass[i] * w; tree += this.tree[i] * w;
        herb += this.herb[i] * w; pred += this.pred[i] * w; human += this.human[i] * w; if (this.fire[i] > 0.1) fire++;
      }
      this.stats = {
        lavaFrac: lava / ws, oceanFrac: ocean / ws, iceAvg: ice / ws, sea: sea / ws, grass: grass / ws,
        tree: tree / ws, herb: herb / ws, pred: pred / ws, human: human / ws, fireCells: fire,
      };
    }

    // ---------------------------------------------------------------- mô tả
    biomeAt(i) {
      const t = this.temp[i], m = this.moist[i], elev = this.h[i] - this.seaLevel;
      if (this.lava[i] > 0.3) return 'Dung nham';
      if (this.isOcean[i]) {
        if (this.ice[i] > 0.5) return 'Biển băng';
        if (this.bType[i] === 2 && this.src[i] < 0) return 'Sống núi giữa đại dương';
        return elev < -0.2 ? 'Biển sâu' : 'Biển nông, thềm lục địa';
      }
      if (this.fire[i] > 0.2) return 'Đám cháy';
      if (this.ice[i] > 0.5) return 'Băng hà';
      if (this.human[i] > 0.55 && this.ma < 0.006) return 'Đô thị & đồng ruộng';
      if (this.human[i] > 0.3 && this.ma < 0.011) return 'Đồng ruộng & làng mạc';
      if (this.tree[i] > 0.45) return t > 22 && m > 0.6 ? 'Rừng mưa nhiệt đới' : t < 5 ? 'Rừng lá kim (taiga)' : 'Rừng ôn đới';
      if (this.grass[i] > 0.3) return t > 22 && m < 0.45 ? 'Xavan' : t < 2 ? 'Đài nguyên' : 'Đồng cỏ';
      if (elev > 0.4) return 'Núi đá';
      if (m < 0.18 && t > 10) return 'Sa mạc';
      if (t < 0) return 'Hoang mạc lạnh';
      return 'Đất trống';
    }
    placeName(x, y) {
      const i = this.idx(x, y), la = this.lat[i], lo = this.lon[i];
      const ns = la >= 0 ? 'Bắc' : 'Nam', ew = lo >= 0 ? 'Đông' : 'Tây';
      return `${this.biomeAt(i).toLowerCase()} (${Math.abs(la).toFixed(0)}°${ns}, ${Math.abs(lo).toFixed(0)}°${ew})`;
    }
    cellInfo(i) {
      const p = this.plate[i];
      return {
        biome: this.biomeAt(i), temp: this.temp[i], moist: this.moist[i], fert: this.fert[i],
        elev: (this.h[i] - this.seaLevel) * 8000, grass: this.grass[i], tree: this.tree[i],
        herb: this.herb[i], pred: this.pred[i], sea: this.sea[i], ice: this.ice[i], lava: this.lava[i],
        fire: this.fire[i], plague: this.plague[i], human: this.human[i], ocean: !!this.isOcean[i], rain: this.rain[i],
        lat: this.lat[i], lon: this.lon[i], plate: this.plateName(p), boundary: this.bType[i],
      };
    }
  }

  global.GodSim = { World, clamp, smooth, gauss, makeNoise, fbm, W, H };
})(typeof window !== 'undefined' ? window : globalThis);
