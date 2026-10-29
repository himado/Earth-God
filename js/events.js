/* =====================================================================
 *  ĐẢO SÁNG THẾ — Quyền năng của Thần & các sự kiện tự nhiên
 *
 *  Mỗi sự kiện gồm:
 *    start(w, e)  : tác động tức thời, trả về câu "chẩn đoán" dựa trên
 *                   trạng thái hiện tại của vùng (vì sao nó sẽ thành công / thất bại)
 *    tick(w, e)   : tác động kéo dài mỗi tick (mưa, bão di chuyển, núi lửa phun…)
 *    end(w, e)    : khi sự kiện kết thúc
 *    settle       : số tick chờ hệ sinh thái phản ứng trước khi báo "kết quả"
 *  Kết quả cuối cùng do World.report() đo bằng cách so sánh vùng trước/sau.
 *  Một sự kiện có thể kích hoạt sự kiện khác (w.request) → chuỗi hệ quả.
 * ===================================================================== */
(function (global) {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Tìm yếu tố giới hạn chính cho thực vật trong vùng
  function diagnosePlants(w, e) {
    let land = 0, lava = 0, cold = 0, hot = 0, dry = 0, ice = 0;
    w.forDisk(e.x, e.y, e.r, (i) => {
      if (w.isOcean[i]) return;
      land++;
      if (w.lava[i] > 0.05) lava++;
      if (w.temp[i] < 0) cold++;
      if (w.temp[i] > 42) hot++;
      if (w.moist[i] < 0.12) dry++;
      if (w.ice[i] > 0.3) ice++;
    });
    if (!land) return 'Hạt giống rơi xuống biển và chìm mất.';
    if (lava / land > 0.3) return 'Hạt giống bị dung nham thiêu rụi.';
    if (w.ozone < 0.3) return 'Chưa có tầng ozone — tia cực tím sẽ giết mầm non. Hãy chờ sinh vật quang hợp tạo đủ oxy.';
    if (ice / land > 0.4) return 'Hạt nằm ngủ dưới lớp băng, sẽ nảy mầm khi khí hậu ấm lên.';
    if (cold / land > 0.5) return 'Quá lạnh — hạt ngủ đông trong đất.';
    if (hot / land > 0.5) return 'Quá nóng — mầm non khó sống sót.';
    if (dry / land > 0.5) return 'Đất quá khô — hạt nằm chờ một cơn mưa để nảy mầm.';
    return 'Điều kiện thuận lợi — mầm xanh sẽ sớm lan rộng.';
  }

  function diagnoseAnimals(w, e, kind) {
    let land = 0, food = 0, cold = 0, hot = 0;
    w.forDisk(e.x, e.y, e.r, (i) => {
      if (w.isOcean[i]) return;
      land++;
      food += kind === 'pred' ? w.herb[i] * 3 : w.grass[i] + 0.3 * w.tree[i];
      if (w.temp[i] < -10) cold++;
      if (w.temp[i] > 42 || w.lava[i] > 0.1) hot++;
    });
    if (!land) return 'Thả xuống biển — các con vật chết đuối.';
    if (w.O2 < 0.25) return 'Khí quyển gần như chưa có oxy — động vật ngạt thở.';
    if (hot / land > 0.4) return 'Quá nóng — đàn thú khó sống sót.';
    if (cold / land > 0.5) return 'Quá lạnh — đàn thú chết cóng dần.';
    if (food / land < 0.1) return kind === 'pred'
      ? 'Không có con mồi — thú săn mồi sẽ chết đói hoặc phải di cư.'
      : 'Không có cây cỏ — đàn thú sẽ chết đói hoặc phải di cư.';
    return kind === 'pred'
      ? 'Con mồi dồi dào — thú săn mồi sẽ sinh sôi và kiềm chế đàn thú ăn cỏ.'
      : 'Đồng cỏ dồi dào — đàn thú sẽ sinh sôi và lan rộng.';
  }

  const fuelAt = (w, i) => w.grass[i] + 1.5 * w.tree[i];

  const EVENTS = {
    seed: {
      name: 'Gieo hạt giống', icon: '🌱', kind: 'local', r: 6, settle: 120, color: 0x7ddc5a,
      desc: 'Rải hạt cỏ và cây gỗ xuống đất. Hạt ngủ trong đất và chỉ nảy mầm khi đủ ẩm, đủ ấm và đã có tầng ozone.',
      start(w, e) {
        w.forDisk(e.x, e.y, e.r, (i, k) => {
          if (w.isOcean[i] || w.lava[i] > 0.1) return;
          w.seedbank[i] = Math.min(1, w.seedbank[i] + 0.7 * k * e.p);
        });
        return diagnosePlants(w, e);
      },
    },

    life: {
      name: 'Mầm sống', icon: '🧬', kind: 'local', r: 5, settle: 100, color: 0x6fe3c8,
      desc: 'Gieo vi sinh vật nguyên thủy vào biển. Chỉ sống được trong nước lỏng, dưới ~95°C.',
      start(w, e) {
        let ocean = 0, ok = 0;
        w.forDisk(e.x, e.y, e.r, (i, k) => {
          if (!w.isOcean[i]) return;
          ocean++;
          if (w.temp[i] > -2 && w.temp[i] < 95) { w.sea[i] = Math.max(w.sea[i], 0.08 * k * e.p + 0.02); ok++; }
        });
        if (!ocean) return w.oceanVol < 1 ? 'Chưa có đại dương — mầm sống khô héo trên đá nóng.' : 'Mầm sống rơi lên đất khô và chết. Hãy gieo xuống biển.';
        if (!ok) return 'Nước biển quá nóng (>95°C) — phân tử hữu cơ bị phân hủy.';
        w.lifeEver = true;
        return 'Vi sinh vật bắt đầu sinh sôi và trôi dạt theo dòng nước.';
      },
    },

    herbivore: {
      name: 'Thả thú ăn cỏ', icon: '🦌', kind: 'local', r: 4, settle: 120, color: 0xe8c48a,
      desc: 'Thả một đàn thú ăn cỏ. Chúng cần oxy, cây cỏ và nhiệt độ vừa phải; sẽ di cư tìm thức ăn.',
      start(w, e) {
        w.forDisk(e.x, e.y, e.r, (i, k) => { if (!w.isOcean[i]) w.herb[i] = Math.min(1.5, w.herb[i] + 0.35 * k * e.p); });
        return diagnoseAnimals(w, e, 'herb');
      },
    },

    predator: {
      name: 'Thả thú săn mồi', icon: '🐺', kind: 'local', r: 4, settle: 120, color: 0xd9534f,
      desc: 'Thả thú săn mồi. Chúng chỉ sống được khi có đủ thú ăn cỏ (mô hình Lotka–Volterra).',
      start(w, e) {
        w.forDisk(e.x, e.y, e.r, (i, k) => { if (!w.isOcean[i]) w.pred[i] = Math.min(1, w.pred[i] + 0.2 * k * e.p); });
        return diagnoseAnimals(w, e, 'pred');
      },
    },

    rain: {
      name: 'Mưa lớn', icon: '🌧️', kind: 'local', r: 8, settle: 50, color: 0x6aa8ff,
      duration: (p) => Math.round(40 * p),
      desc: 'Đẩy hơi nước vào vùng trời. Mưa làm ẩm đất, dập lửa, làm nguội dung nham; ở nơi quá nóng nước sẽ bốc hơi trước khi chạm đất.',
      start(w, e) {
        if (w.T > 100) return 'Hành tinh quá nóng — nước bốc hơi trước khi chạm đất.';
        let land = 0, lava = 0, dry = 0, fire = 0, cold = 0;
        w.forDisk(e.x, e.y, e.r, (i) => {
          if (w.isOcean[i]) return;
          land++; if (w.lava[i] > 0.1) lava++; if (w.moist[i] < 0.2) dry++; if (w.fire[i] > 0.1) fire++; if (w.temp[i] < 0) cold++;
        });
        if (!land) return 'Mưa rơi trên biển.';
        if (lava) return 'Mưa xối xuống dung nham — hơi nước bốc lên nghi ngút, dung nham đông cứng nhanh hơn.';
        if (fire) return 'Mưa trút xuống đám cháy — lửa sẽ sớm bị dập tắt.';
        if (cold / land > 0.5) return 'Trời lạnh — mưa biến thành tuyết, băng dày thêm.';
        if (dry / land > 0.4) return 'Đất khô hạn được tưới mát — hạt giống ngủ trong đất sẽ thức dậy.';
        return 'Đất ẩm hơn, cây cỏ phát triển mạnh.';
      },
      tick(w, e) {
        w.forDisk(e.x, e.y, e.r, (i, k) => {
          w.vap[i] += 0.1 * k * e.p;
          if (w.lava[i] > 0) w.lava[i] = Math.max(0, w.lava[i] - 0.01 * k);
          w.fire[i] *= 1 - 0.3 * k;
          w.tmod[i] -= 0.05 * k;
        });
      },
    },

    storm: {
      name: 'Bão nhiệt đới', icon: '🌀', kind: 'local', r: 7, settle: 30, reportR: 22, color: 0x9fb7d9,
      duration: () => 140,
      desc: 'Tạo một cơn bão di chuyển theo gió. Bão mạnh lên trên biển ấm (>24°C), yếu đi khi vào đất liền; gây mưa to, đổ cây, sét và nước dâng.',
      start(w, e) {
        e.data.s = e.p;
        const i = w.idx(e.x, e.y);
        if (!w.isOcean[i]) return 'Bão hình thành trên đất liền sẽ nhanh chóng suy yếu vì thiếu hơi nước.';
        if (w.temp[i] < 24) return 'Biển ở đây khá lạnh — bão khó mạnh lên.';
        return 'Biển ấm cung cấp năng lượng — bão đang mạnh dần.';
      },
      tick(w, e) {
        const d = e.data;
        const S = global.GOD_SCALE, c0 = w.idx(e.x, e.y);
        e.x = w.wrapX(e.x + (w.windX[c0] * 0.6 + (w.rand() - 0.5) * 0.4) * S);
        e.y += (w.windY[c0] * 0.6 - 0.15 * Math.sign(w.lat[c0]) + (w.rand() - 0.5) * 0.4) * S;   // bão trôi theo gió mậu dịch rồi quặt về cực
        const c = w.idx(e.x, e.y);
        if (e.y < 1 || e.y > w.H - 2 || w.temp[c] < 5) { e.dur = e.age + 1; d.gone = 'Bão đi vào vùng biển lạnh và tan dần.'; return; }
        if (w.isOcean[c]) d.s = Math.min(2.5, d.s + (w.temp[c] > 24 ? 0.015 : -0.005));
        else {
          d.s -= 0.02;
          if (!d.landfall) { d.landfall = true; w.log(`🌀 Bão đổ bộ vào ${w.placeName(e.x, e.y)}.`, 'chain'); }
        }
        if (d.s < 0.15) { e.dur = e.age + 1; d.gone = 'Bão suy yếu và tan dần.'; return; }
        const s = d.s;
        w.forDisk(e.x, e.y, e.r * 1.3, (i, k) => {
          w.vap[i] += 0.2 * s * k;
          if (w.isOcean[i]) return;
          w.tree[i] -= 0.006 * s * k * w.tree[i];
          w.herb[i] *= 1 - 0.01 * s * k;
          if (w.h[i] - w.seaLevel < 0.04 * s) {     // nước dâng do bão
            w.herb[i] *= 0.9; w.grass[i] *= 0.98; w.fert[i] = Math.max(0, w.fert[i] - 0.003 * s); w.moist[i] = 1;
          }
        });
        if (w.rand() < 0.25 * s) {    // sét
          const lx = e.x + (w.rand() - 0.5) * e.r * 2, ly = e.y + (w.rand() - 0.5) * e.r * 2, j = w.idx(lx, ly);
          if (w.mask[j] && !w.isOcean[j] && fuelAt(w, j) > 0.2 && w.moist[j] < 0.5) w.fire[j] = Math.max(w.fire[j], 0.6);
          w.visuals.push({ kind: 'bolt', x: lx, y: ly });
        }
      },
      end(w, e) { return e.data.gone || 'Bão tan.'; },
    },

    drought: {
      name: 'Hạn hán', icon: '☀️', kind: 'local', r: 10, settle: 40, color: 0xf0b44a,
      duration: (p) => Math.round(160 * p),
      desc: 'Chặn mây mưa và đốt nóng vùng đất. Đất khô dần, cây chết, nguy cơ cháy rừng tăng.',
      start(w, e) {
        const st = w.regionStats(e.x, e.y, e.r);
        if (st.land < 0.2) return 'Vùng này chủ yếu là biển — hạn hán ít tác động.';
        if (st.plant > 0.3) return 'Thảm thực vật dày sẽ khô héo — nguy cơ cháy rừng rất cao.';
        return 'Đất nứt nẻ, hơi ẩm bốc hơi hết.';
      },
      tick(w, e) {
        w.forDisk(e.x, e.y, e.r * 1.2, (i, k) => {
          w.vap[i] *= 1 - 0.08 * k;
          w.tmod[i] = Math.min(8, w.tmod[i] + 0.12 * k * e.p);
          w.moist[i] = Math.max(0, w.moist[i] - 0.003 * k);
        });
      },
    },

    lightning: {
      name: 'Sét đánh', icon: '⚡', kind: 'local', r: 2, settle: 40, color: 0xfff2a0,
      desc: 'Giáng sét xuống. Trên đất có cây khô → cháy rừng lan theo gió. Xuống biển nguyên thủy → kích thích phản ứng hóa học tạo sự sống (Miller–Urey).',
      start(w, e) {
        w.visuals.push({ kind: 'bolt', x: e.x, y: e.y });
        const c = w.idx(e.x, e.y);
        if (w.isOcean[c]) {
          if (!w.lifeEver && w.T < 100) { w.prebiotic += 0.5; return 'Tia sét kích hoạt phản ứng trong "nồi súp nguyên thủy" (thí nghiệm Miller–Urey) — sự sống dễ hình thành hơn.'; }
          return 'Sét đánh xuống biển, tan vào sóng nước.';
        }
        let fuel = 0, wet = 0, n = 0;
        w.forDisk(e.x, e.y, e.r + 1, (i, k) => {
          if (w.isOcean[i]) return;
          fuel += fuelAt(w, i); wet += w.moist[i]; n++;
          if (fuelAt(w, i) > 0.1) w.fire[i] = Math.max(w.fire[i], 0.8 * k * e.p);
        });
        if (fuel < 0.3) return 'Sét đánh vào đất trống — không có gì để cháy.';
        if (wet / n > 0.55) return 'Thảm thực vật ẩm ướt — lửa bén nhưng khó lan.';
        return 'Cỏ cây khô bắt lửa — cháy rừng sẽ lan theo hướng gió!';
      },
    },

    volcano: {
      name: 'Núi lửa', icon: '🌋', kind: 'local', r: 5, settle: 60, color: 0xff6a2a,
      duration: (p) => Math.round(90 * p),
      desc: 'Mở một miệng núi lửa. Dung nham chảy xuống chỗ thấp và đông thành đá (tạo núi, tạo đảo), tro bụi làm lạnh khí hậu, CO₂ làm ấm về lâu dài, đất tro rất màu mỡ.',
      start(w, e) {
        e.data.c = w.idx(e.x, e.y);
        return w.isOcean[e.data.c]
          ? 'Núi lửa ngầm phun trào dưới đáy biển — dung nham nguội đi có thể dựng nên một hòn đảo mới.'
          : 'Dung nham tuôn trào, chảy xuống các sườn thấp, thiêu rụi mọi thứ trên đường đi.';
      },
      tick(w, e) {
        const c = e.data.c;
        w.lava[c] = Math.min(1.5, w.lava[c] + 0.3 * e.p);
        w.forDisk(e.x, e.y, 3, (i, k) => { w.deform[i] += 0.0025 * k * e.p; });
        w.aerosol = Math.min(1, w.aerosol + 0.0012 * e.p);
        w.volcOut += 0.008 * e.p;
        w.forDisk(e.x, e.y, e.r * 2, (i, k) => {
          if (w.isOcean[i]) return;
          w.fert[i] = Math.min(1, w.fert[i] + 0.002 * k);
          w.grass[i] *= 1 - 0.004 * k;
        });
      },
      end() { return 'Núi lửa ngừng phun — lớp tro để lại vùng đất màu mỡ.'; },
    },

    meteor: {
      name: 'Thiên thạch', icon: '☄️', kind: 'local', r: 6, settle: 80, color: 0xffa040,
      desc: 'Thả một thiên thạch. Tạo hố va chạm, thiêu rụi sinh vật, bụi che nắng gây "mùa đông va chạm". Rơi xuống biển → sóng thần. Thời sơ khai, thiên thạch còn mang theo nước và phân tử hữu cơ.',
      start(w, e) {
        const p = e.p, R = e.r, cr = R * 0.55;
        const oceanHit = !!w.isOcean[w.idx(e.x, e.y)];
        let killed = 0;
        w.forDisk(e.x, e.y, R * 1.7, (i, k, d) => {
          if (d < cr) {
            const q = d / cr;
            w.deform[i] -= 0.16 * p * (1 - q * q);
            if (p > 1.2) w.lava[i] = Math.max(w.lava[i], 0.7 * (1 - q));
          }
          w.deform[i] += 0.05 * p * Math.exp(-((d - cr * 1.1) ** 2) / (2 * (cr * 0.18) ** 2));   // gờ miệng hố
          const kill = d < R ? 1 : 1 - (d - R) / (R * 0.7);
          if (d >= R * 0.8 && !w.isOcean[i] && fuelAt(w, i) > 0.05 && w.rand() < 0.6) w.fire[i] = 0.8;
          killed += (w.grass[i] + w.tree[i] + w.herb[i] + w.pred[i] + w.sea[i]) * kill;
          for (const f of ['grass', 'tree', 'herb', 'pred', 'seedbank', 'ice']) w[f][i] *= 1 - kill;
          w.sea[i] *= 1 - 0.8 * kill;
          w.tmod[i] += 40 * k * p;
        });
        w.aerosol = Math.min(1, w.aerosol + 0.12 * p * p);
        if (w.internalHeat > 50) w.atmoWater += 0.004 * w.waterTotal * p;
        const msgs = [];
        if (oceanHit) { w.request('tsunami', e.x, e.y, { p, chain: true }); msgs.push('rơi xuống biển gây sóng thần'); }
        if (!w.lifeEver && w.T < 100 && w.rand() < 0.3) { w.prebiotic += 0.6; msgs.push('mang theo phân tử hữu cơ từ vũ trụ'); }
        if (w.internalHeat > 50) msgs.push('mang thêm nước cho hành tinh');
        msgs.push(`bụi che kín bầu trời (≈ −${Math.round(0.12 * p * p * 30)}°C)`);
        if (killed > 1) msgs.push('hủy diệt sinh vật trong vùng va chạm');
        return 'Va chạm khoét một hố lớn, ' + msgs.join(', ') + '.';
      },
    },

    tsunami: {
      name: 'Sóng thần', icon: '🌊', kind: 'local', r: 6, settle: 40, reportR: 30, color: 0xd8f3ff,
      duration: () => 45,
      desc: 'Một con sóng khổng lồ lan ra từ tâm. Tràn vào vùng đất thấp ven biển: cuốn trôi động vật, cây cối và làm đất nhiễm mặn.',
      start(w, e) {
        e.data.hit = 0;
        if (!w.isOcean[w.idx(e.x, e.y)]) return 'Tâm sóng nằm trên đất liền — chỉ vùng trũng gần biển bị ảnh hưởng.';
        return 'Sóng lan ra mọi hướng với tốc độ khủng khiếp.';
      },
      tick(w, e) {
        const S = global.GOD_SCALE, R = e.age * 1.3 * S, height = (0.14 * e.p) / (1 + (R / S) * 0.04);
        e.data.R = R;
        w.forDisk(e.x, e.y, R + 1.5, (i, k, d) => {
          if (d < R - 1.5 || w.isOcean[i]) return;
          const elev = w.h[i] - w.seaLevel;
          if (elev >= height) return;
          const dmg = 1 - elev / height;
          w.herb[i] *= 1 - 0.8 * dmg; w.pred[i] *= 1 - 0.8 * dmg; w.grass[i] *= 1 - 0.4 * dmg; w.tree[i] *= 1 - 0.25 * dmg;
          w.fert[i] = Math.max(0, w.fert[i] - 0.04 * dmg); w.moist[i] = 1; w.seedbank[i] *= 1 - 0.3 * dmg; w.fire[i] = 0;
          e.data.hit++;
        });
      },
      end(w, e) { return e.data.hit ? `Sóng thần đã tràn qua khoảng ${Math.round(e.data.hit / 3)} km² đất ven biển.` : 'Sóng thần tan trên biển, không chạm tới đất liền.'; },
    },

    earthquake: {
      name: 'Động đất', icon: '🌍', kind: 'local', r: 7, settle: 40, color: 0xc89060,
      desc: 'Đứt gãy kiến tạo: một bên nâng lên, một bên sụt xuống. Rung chấn làm sạt lở sườn dốc; đứt gãy dưới đáy biển gây sóng thần.',
      start(w, e) {
        const a = w.rand() * Math.PI, dx = Math.cos(a), dy = Math.sin(a), L = e.r * 2, W = 2 + 2 * global.GOD_SCALE;
        let underSea = null, slides = 0;
        w.forDisk(e.x, e.y, L + 3, (i, k, d, x, y) => {
          const rx = w.dx(x, e.x), ry = y - e.y, along = rx * dx + ry * dy, cross = -rx * dy + ry * dx;
          if (Math.abs(along) > L) return;
          const fall = 1 - Math.abs(along) / L;
          if (Math.abs(cross) < W) {
            w.deform[i] += Math.sign(cross || 1) * 0.035 * e.p * fall * (1 - Math.abs(cross) / W);
            if (w.isOcean[i] && !underSea) underSea = [x, y];
          }
          const shake = fall * Math.max(0, 1 - Math.abs(cross) / e.r);
          if (shake <= 0 || w.isOcean[i]) return;
          w.herb[i] *= 1 - 0.15 * shake * e.p; w.pred[i] *= 1 - 0.15 * shake * e.p;
          let slope = 0;
          for (let q = 0; q < 4; q++) { const j = w.nb[i * 4 + q]; if (j >= 0) slope = Math.max(slope, Math.abs(w.h[i] - w.h[j])); }
          if (slope > 0.06) { w.tree[i] *= 1 - 0.5 * shake; w.grass[i] *= 1 - 0.3 * shake; w.fert[i] *= 0.8; slides++; }
        });
        const msgs = ['Mặt đất nứt toác, một bên nâng lên, một bên sụt xuống'];
        if (slides) msgs.push(`sạt lở ở ${slides} sườn dốc`);
        if (underSea) { w.request('tsunami', underSea[0], underSea[1], { p: e.p * 0.8, chain: true }); msgs.push('đứt gãy dưới đáy biển gây sóng thần'); }
        return msgs.join(', ') + '.';
      },
    },

    plague: {
      name: 'Dịch bệnh', icon: '☣️', kind: 'local', r: 5, settle: 120, color: 0xb36cff,
      desc: 'Thả mầm bệnh vào quần thể động vật. Bệnh lây theo mật độ: đàn càng đông lây càng nhanh, đàn thưa thì dịch tự tắt.',
      start(w, e) {
        let host = 0, dense = 0;
        w.forDisk(e.x, e.y, e.r, (i, k) => {
          if (w.herb[i] > 0.01 || w.pred[i] > 0.01) { w.plague[i] = Math.max(w.plague[i], 0.6 * k * e.p + 0.2); host++; if (w.herb[i] > 0.12) dense++; }
        });
        if (!host) return 'Không có vật chủ — mầm bệnh tự biến mất.';
        return dense > host / 3 ? 'Mật độ thú cao — dịch sẽ lây lan nhanh!' : 'Quần thể thưa — dịch có thể tự lụi tàn.';
      },
    },

    iceage: {
      name: 'Kỷ băng hà', icon: '❄️', kind: 'global', settle: 220, color: 0xcfefff,
      desc: 'Quỹ đạo dao động làm nắng yếu đi. Băng lan từ hai cực và đỉnh núi; băng phản chiếu ánh nắng → càng lạnh hơn (vòng phản hồi). Mực nước biển hạ do nước bị khóa trong băng.',
      start(w, e) {
        w.forcing -= 14 * e.p;
        return 'Ánh nắng yếu đi — băng bắt đầu lan từ hai cực và các đỉnh núi.';
      },
    },

    warming: {
      name: 'Nóng lên toàn cầu', icon: '🌡️', kind: 'global', settle: 220, color: 0xff7a5a,
      desc: 'Bơm CO₂ vào khí quyển. Hiệu ứng nhà kính làm nóng hành tinh, băng tan, nước biển dâng; dần dần phong hóa đá và cây xanh sẽ hút bớt CO₂.',
      start(w, e) {
        w.CO2 *= 1 + 1.5 * e.p; w.forcing += 3 * e.p;
        return 'Khí CO₂ tăng vọt — hiệu ứng nhà kính bao trùm hành tinh.';
      },
    },
  };

  global.GOD_SCALE = 1.5;     // bán kính sự kiện (ô) = r × GOD_SCALE
  global.GOD_EVENTS = EVENTS;
  global.GOD_POWER_ORDER = ['seed', 'life', 'herbivore', 'predator', 'rain', 'storm', 'drought', 'lightning',
    'volcano', 'meteor', 'earthquake', 'tsunami', 'plague', 'iceage', 'warming'];
})(typeof window !== 'undefined' ? window : globalThis);
