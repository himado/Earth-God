/* =====================================================================
 *  ĐẢO SÁNG THẾ — Kiến tạo mảng theo lịch sử thật (tái dựng cổ địa lý)
 *
 *  Đường bờ biển hiện tại (Natural Earth) được chia thành 10 khối lục địa theo
 *  ranh giới mảng. Mỗi khối được QUAY TRÊN MẶT CẦU theo các mốc thời gian
 *  (vị trí điểm tham chiếu + góc xoay), nội suy giữa các mốc — giống cách các
 *  phần mềm cổ địa lý (GPlates/PALEOMAP) làm. Ở mốc 0 triệu năm mọi khối về đúng
 *  vị trí ngày nay.
 *
 *  Tái dựng ngược: với mỗi ô bản đồ, quay ngược về hiện tại theo từng khối để
 *  biết ô đó đang chứa mảnh vỏ nào. Đất, cây, thú… trôi theo mảnh vỏ của chúng.
 *
 *  • Lục địa lớn dần từ các NHÂN CỔ (craton: Kaapvaal, Pilbara, Khiên Canada…)
 *  • Dãy núi có "tuổi": Appalachia/Ural cao nhất khi Pangaea hợp nhất rồi mòn dần,
 *    Himalaya mọc lên từ 50 triệu năm trước khi Ấn Độ đâm vào châu Á…
 *  • Đáy biển: thềm lục địa → sườn dốc → đồng bằng biển thẳm; sống núi giữa đại
 *    dương ở nơi hai mảng tách xa; rãnh sâu nơi hút chìm (vành đai lửa).
 * ===================================================================== */
(function (global) {
  'use strict';
  const { World, clamp, smooth } = global.GodSim;
  const D2R = Math.PI / 180;

  // ---------------------------------------------------------------- khối lục địa
  const BLOCKS = [
    { id: 'a', name: 'Bắc Mỹ (Laurentia)', ref: [48, -100] },
    { id: 's', name: 'Nam Mỹ (Amazonia)', ref: [-15, -60] },
    { id: 'f', name: 'Châu Phi', ref: [5, 20] },
    { id: 'r', name: 'Ả Rập', ref: [23, 46] },
    { id: 'e', name: 'Châu Âu (Baltica)', ref: [52, 20] },
    { id: 'i', name: 'Siberia', ref: [63, 105] },
    { id: 'c', name: 'Đông Á (Hoa Bắc, Hoa Nam, Sunda)', ref: [30, 108] },
    { id: 'd', name: 'Ấn Độ', ref: [21, 78] },
    { id: 'u', name: 'Úc', ref: [-25, 134] },
    { id: 'n', name: 'Nam Cực', ref: [-80, 0] },
  ];
  const PACIFIC = BLOCKS.length;   // mảng đại dương lớn (Thái Bình Dương / Panthalassa)
  const PLATE_NAMES = BLOCKS.map((b) => b.name).concat(['Thái Bình Dương (Panthalassa)']);

  // Vị trí điểm tham chiếu [vĩ độ, kinh độ, góc xoay°] của từng khối theo thời gian (triệu năm trước).
  // Phanerozoi (0–540): theo bản đồ cổ địa lý PALEOMAP (Scotese) đã giản lược.
  // Tiền Cambri: sắp xếp gần đúng các siêu lục địa Vaalbara, Kenorland, Columbia, Rodinia, Pannotia.
  const KEYS = [
    [0, { a: [48, -100, 0], s: [-15, -60, 0], f: [5, 20, 0], r: [23, 46, 0], e: [52, 20, 0], i: [63, 105, 0], c: [30, 108, 0], d: [21, 78, 0], u: [-25, 134, 0], n: [-80, 0, 0] }],
    [20, { a: [48, -98, 0], s: [-15, -58, 0], f: [4, 19, 0], r: [21, 44, 3], e: [51, 19, 0], i: [63, 105, 0], c: [30, 107, 0], d: [16, 76, 0], u: [-30, 128, 0], n: [-80, 0, 0] }],
    [40, { a: [50, -92, 3], s: [-17, -55, -3], f: [2, 17, 2], r: [17, 41, 5], e: [49, 16, 0], i: [63, 104, 0], c: [29, 106, 0], d: [3, 75, -10], u: [-42, 120, 0], n: [-80, 0, 0] }],
    [66, { a: [52, -85, 5], s: [-20, -50, -8], f: [-2, 14, 5], r: [12, 37, 8], e: [46, 12, 0], i: [64, 102, 0], c: [28, 104, 0], d: [-17, 66, -15], u: [-50, 112, 0], n: [-80, 0, -5] }],
    [100, { a: [48, -72, 10], s: [-20, -38, -20], f: [-8, 10, 10], r: [6, 32, 12], e: [41, 8, 5], i: [65, 100, 0], c: [28, 100, 0], d: [-35, 55, -25], u: [-55, 105, -10], n: [-78, 0, -10] }],
    [150, { a: [38, -55, 15], s: [-22, -31, -30], f: [-12, 7, 15], r: [2, 27, 15], e: [37, 2, 10], i: [62, 90, 5], c: [27, 92, 5], d: [-45, 40, -40], u: [-55, 90, -25], n: [-72, 0, -20] }],
    [200, { a: [30, -40, 20], s: [-25, -28, -35], f: [-15, 5, 20], r: [-2, 24, 20], e: [32, -5, 15], i: [58, 75, 10], c: [24, 86, 10], d: [-45, 32, -50], u: [-55, 80, -35], n: [-68, 0, -30] }],
    [250, { a: [22, -35, 25], s: [-28, -26, -40], f: [-20, 3, 25], r: [-6, 22, 25], e: [28, -8, 20], i: [54, 60, 15], c: [16, 90, 20], d: [-48, 30, -55], u: [-55, 72, -40], n: [-68, -5, -35] }],
    [300, { a: [12, -30, 30], s: [-36, -25, -45], f: [-30, 0, 30], r: [-15, 20, 30], e: [20, -10, 25], i: [44, 40, 25], c: [8, 98, 25], d: [-55, 30, -60], u: [-60, 68, -45], n: [-75, -10, -40] }],
    [360, { a: [0, -35, 35], s: [-46, -25, -50], f: [-38, 5, 35], r: [-25, 22, 35], e: [12, -12, 30], i: [35, 30, 40], c: [4, 105, 30], d: [-55, 35, -65], u: [-55, 75, -50], n: [-78, 0, -45] }],
    [420, { a: [-10, -40, 45], s: [-55, -25, 70], f: [-55, 10, 60], r: [-40, 25, 60], e: [-5, -12, 40], i: [20, 20, 90], c: [0, 110, 40], d: [-45, 45, -70], u: [-30, 75, -40], n: [-50, 40, -60] }],
    [480, { a: [-15, -50, 50], s: [-50, -15, 90], f: [-60, 20, 90], r: [-45, 40, 90], e: [-45, -15, 80], i: [10, 30, 150], c: [0, 100, 60], d: [-30, 55, -60], u: [-15, 80, -30], n: [-40, 50, -50] }],
    [540, { a: [-20, -60, 60], s: [-40, 0, 100], f: [-45, 30, 100], r: [-35, 50, 100], e: [-55, -20, 100], i: [0, 30, 180], c: [5, 95, 70], d: [-25, 60, -50], u: [-5, 85, -20], n: [-30, 60, -40] }],
    [600, { a: [-35, -40, 70], s: [-45, 5, 110], f: [-40, 25, 110], r: [-30, 40, 110], e: [-55, -10, 110], i: [-15, 10, 180], c: [0, 80, 80], d: [-25, 55, -40], u: [-10, 75, -10], n: [-30, 55, -30] }],
    [750, { a: [0, -20, 90], s: [-30, 20, 60], f: [-30, 50, 60], r: [-15, 60, 60], e: [10, 30, 120], i: [35, -15, 150], c: [25, -60, 0], d: [-40, 60, 30], u: [10, -60, 10], n: [-15, -60, 20] }],
    [900, { a: [0, 0, 90], s: [-25, 25, 60], f: [-30, 45, 60], r: [-12, 52, 60], e: [10, 35, 120], i: [30, 10, 150], c: [28, -30, 0], d: [-38, 48, 30], u: [10, -35, 10], n: [-12, -35, 20] }],
    [1100, { a: [0, 0, 90], s: [-33, 35, 60], f: [-40, 60, 60], r: [-16, 68, 60], e: [13, 45, 120], i: [40, 10, 150], c: [37, -40, 0], d: [-50, 62, 30], u: [13, -45, 10], n: [-16, -45, 20] }],
    [1400, { a: [20, -60, 40], s: [-20, 10, 30], f: [-10, 80, 30], r: [10, 130, 30], e: [30, 90, 80], i: [50, 40, 100], c: [40, 170, 0], d: [-40, 150, 0], u: [-30, -120, 0], n: [-50, -30, 0] }],
    [1800, { a: [25, 115, 0], s: [0, 155, 30], f: [15, 148, 0], r: [30, 160, 0], e: [40, 140, 40], i: [50, 105, 80], c: [35, 92, 0], d: [10, 95, 0], u: [0, 120, 0], n: [-20, 115, 0] }],
    [2200, { a: [40, 60, 0], s: [-30, 170, 0], f: [20, -140, 0], r: [40, -120, 0], e: [10, -170, 20], i: [60, 150, 60], c: [0, 0, 0], d: [-10, 40, 0], u: [-20, 80, 0], n: [-50, 120, 0] }],
    [2700, { a: [-25, -115, 0], s: [-40, -160, 0], f: [-10, -130, 0], r: [0, -110, 0], e: [-15, -95, 0], i: [-45, -100, 0], c: [-20, -170, 0], d: [-55, -150, 0], u: [-30, -140, 0], n: [-50, -130, 0] }],
    [3000, { a: [30, -60, 0], s: [-40, 120, 0], f: [-5, 10, 0], r: [40, 150, 0], e: [50, 60, 0], i: [60, -150, 0], c: [10, 100, 0], d: [-10, 60, 0], u: [-25, 45, 0], n: [-60, -30, 0] }],
    [3300, { a: [30, -80, 0], s: [-40, 120, 0], f: [5, 20, 0], r: [40, 150, 0], e: [50, 60, 0], i: [60, -150, 0], c: [10, 100, 0], d: [-10, 80, 0], u: [-31, 50, 0], n: [-60, -30, 0] }],
    [4600, { a: [30, -80, 0], s: [-40, 120, 0], f: [5, 20, 0], r: [40, 150, 0], e: [50, 60, 0], i: [60, -150, 0], c: [10, 100, 0], d: [-10, 80, 0], u: [-31, 50, 0], n: [-60, -30, 0] }],
  ];

  // Nhân lục địa cổ (craton): [vĩ độ, kinh độ, bán kính°, tuổi hình thành (triệu năm)] — vỏ lục địa lớn dần quanh chúng
  const CRATONS = [
    [-27, 27, 6, 3600, 'Kaapvaal'], [-21, 119, 5, 3600, 'Pilbara'], [64, -112, 4, 3500, 'Slave'], [15, 77, 5, 3300, 'Dharwar'],
    [50, -85, 9, 3000, 'Superior'], [44, -108, 4, 2900, 'Wyoming'], [72, -40, 8, 3000, 'Greenland'], [63, 28, 7, 3000, 'Khiên Baltic'],
    [65, 110, 9, 3000, 'Siberia'], [-29, 119, 5, 3000, 'Yilgarn'], [-2, 20, 8, 3000, 'Congo'], [12, -5, 7, 2900, 'Tây Phi'],
    [-5, -55, 9, 2800, 'Amazonia'], [-12, -43, 5, 3000, 'São Francisco'], [38, 115, 6, 2800, 'Hoa Bắc'], [-80, 90, 14, 3000, 'Đông Nam Cực'],
    [-20, 30, 5, 2700, 'Zimbabwe'], [56, 37, 6, 2600, 'Sarmatia'], [-30, 135, 6, 2500, 'Gawler'],
  ];

  // Dãy núi: đường trục [vĩ độ, kinh độ]…, bề rộng°, độ cao (1 ≈ 8 km), bắt đầu nâng, đạt đỉnh, phần còn lại hiện nay
  const RANGES = [
    { name: 'Himalaya', pts: [[35, 72], [30, 80], [28, 86], [27.5, 92], [28, 97]], w: 2.2, h: 0.75, born: 50, peak: 0 },
    { name: 'Cao nguyên Tây Tạng', pts: [[34, 80], [33, 88], [33, 95]], w: 5, h: 0.55, born: 45, peak: 0 },
    { name: 'Hoành Đoạn – Vân Quý', pts: [[30, 98], [27, 101], [25, 105]], w: 2.5, h: 0.35, born: 40, peak: 0 },
    { name: 'Thiên Sơn – Altai', pts: [[41, 70], [43, 82], [47, 90], [49, 96]], w: 2.5, h: 0.4, born: 40, peak: 0 },
    { name: 'Andes', pts: [[10, -73], [2, -77], [-8, -78], [-16, -71], [-24, -67], [-33, -70], [-42, -72], [-52, -73]], w: 2.2, h: 0.6, born: 90, peak: 0 },
    { name: 'Cao nguyên Altiplano', pts: [[-15, -69], [-21, -67]], w: 3, h: 0.45, born: 25, peak: 0 },
    { name: 'Rocky', pts: [[64, -145], [58, -128], [50, -117], [44, -110], [38, -106], [32, -106]], w: 3.2, h: 0.38, born: 80, peak: 0 },
    { name: 'Sierra Madre', pts: [[30, -107], [22, -103], [18, -98]], w: 2, h: 0.28, born: 60, peak: 0 },
    { name: 'Alps', pts: [[44, 7], [46.5, 10], [47, 14]], w: 1.6, h: 0.45, born: 35, peak: 0 },
    { name: 'Kavkaz – Zagros – Iran', pts: [[43, 41], [38, 46], [33, 50], [29, 55], [33, 60]], w: 2.4, h: 0.38, born: 30, peak: 0 },
    { name: 'Anatolia', pts: [[38, 30], [39, 38]], w: 2.5, h: 0.25, born: 25, peak: 0 },
    { name: 'Cao nguyên Ethiopia', pts: [[13, 38], [8, 38.5], [2, 37]], w: 3, h: 0.3, born: 30, peak: 0 },
    { name: 'Atlas', pts: [[30.5, -8], [33, -2], [36, 6]], w: 1.6, h: 0.3, born: 60, peak: 0 },
    { name: 'Dãy xuyên Nam Cực', pts: [[-72, 165], [-80, 170], [-86, -170], [-85, -110]], w: 3, h: 0.35, born: 60, peak: 0 },
    { name: 'Cao nguyên Nam Cực', pts: [[-78, 40], [-80, 100], [-76, 140]], w: 10, h: 0.3, born: 34, peak: 0 },
    { name: 'Cao nguyên Greenland', pts: [[78, -40], [70, -40], [64, -45]], w: 6, h: 0.25, born: 30, peak: 0 },
    { name: 'Dãy Phân thủy lớn (Úc)', pts: [[-15, 145], [-25, 151], [-37, 148]], w: 1.8, h: 0.15, born: 300, peak: 250, now: 0.6 },
    { name: 'Mông Cổ', pts: [[47, 95], [46, 105], [44, 115]], w: 4, h: 0.22, born: 50, peak: 0 },
    { name: 'Đông Phi', pts: [[0, 35], [-8, 35], [-14, 34]], w: 2.5, h: 0.22, born: 25, peak: 0 },
    { name: 'Cao nguyên Brazil', pts: [[-12, -45], [-20, -45]], w: 3.5, h: 0.12, born: 500, peak: 450, now: 0.5 },
    // Núi cổ: cao nhất khi Pangaea hợp nhất, nay đã mòn thấp
    { name: 'Appalachia', pts: [[33, -86], [37, -81], [41, -76], [45, -71], [48, -66]], w: 2.5, h: 0.65, born: 480, peak: 300, now: 0.2 },
    { name: 'Ural', pts: [[68, 65], [62, 59], [55, 59], [50, 58]], w: 2, h: 0.55, born: 320, peak: 280, now: 0.2 },
    { name: 'Caledonia (Scandinavia, Scotland)', pts: [[70, 22], [65, 14], [61, 8], [57, -5]], w: 2.5, h: 0.55, born: 480, peak: 420, now: 0.3 },
    { name: 'Variscan (Trung Âu)', pts: [[43, -7], [46, 2], [49, 10], [51, 16]], w: 2.5, h: 0.5, born: 380, peak: 300, now: 0.15 },
  ];

  // ---------------------------------------------------------------- quaternion & hình cầu
  const toVec = (lat, lon) => { const a = lat * D2R, b = lon * D2R; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]; };
  const toLatLon = (v) => [Math.asin(clamp(v[2], -1, 1)) / D2R, Math.atan2(v[1], v[0]) / D2R];
  const qAxis = (ax, ang) => { const s = Math.sin(ang / 2); return [Math.cos(ang / 2), ax[0] * s, ax[1] * s, ax[2] * s]; };
  const qMul = (a, b) => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
  const qConj = (q) => [q[0], -q[1], -q[2], -q[3]];
  const qRot = (q, v) => { const p = qMul(qMul(q, [0, v[0], v[1], v[2]]), qConj(q)); return [p[1], p[2], p[3]]; };
  const qMat = (q) => {
    const [w, x, y, z] = q;
    return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
      2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
      2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
  };
  function qFromTo(a, b) {
    const d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
    let ax = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const l = Math.hypot(ax[0], ax[1], ax[2]);
    if (l < 1e-9) return [1, 0, 0, 0];
    ax = ax.map((x) => x / l);
    return qAxis(ax, Math.acos(d));
  }
  function slerpVec(a, b, t) {
    const d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1), w = Math.acos(d);
    if (w < 1e-6) return a;
    const s = Math.sin(w), ka = Math.sin((1 - t) * w) / s, kb = Math.sin(t * w) / s;
    return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  }
  // Phép quay đưa khối b từ vị trí hiện tại tới vị trí ở thời điểm ma (triệu năm trước; âm = tương lai)
  function blockQuat(bi, ma) {
    const B = BLOCKS[bi];
    if (ma < 0) {                       // tương lai: ngoại suy chuyển động 5 triệu năm gần nhất
      const q5 = qConj(blockQuat(bi, 5)), c = clamp(q5[0], -1, 1), ang = 2 * Math.acos(c);
      const s = Math.sqrt(Math.max(1e-12, 1 - c * c));
      return ang < 1e-9 ? [1, 0, 0, 0] : qAxis([q5[1] / s, q5[2] / s, q5[3] / s], ang * (-ma / 5));
    }
    let k = 0;
    while (k < KEYS.length - 2 && KEYS[k + 1][0] < ma) k++;
    const [m0, f0] = KEYS[k], [m1, f1] = KEYS[k + 1];
    const t = clamp((ma - m0) / (m1 - m0), 0, 1), A = f0[B.id], Bk = f1[B.id];
    const p = slerpVec(toVec(A[0], A[1]), toVec(Bk[0], Bk[1]), t), spin = (A[2] + (Bk[2] - A[2]) * t) * D2R;
    return qMul(qAxis(p, spin), qFromTo(toVec(B.ref[0], B.ref[1]), p));
  }

  const P = World.prototype;

  // ---------------------------------------------------------------- khởi tạo
  P.initEarth = function () {
    const { W, C } = this, D = global.EARTH_DATA;
    const code = new Array(C); let k = 0;
    for (const tok of D.rle.split(',')) { if (!tok) continue; const ch = tok[0], n = +tok.slice(1); for (let j = 0; j < n; j++) code[k++] = ch; }
    // Mảnh vỏ "chuẩn" (vị trí hiện tại): khối, loại (2 đất, 1 thềm lục địa), tuổi, độ cao nền
    this.cBlock = new Int8Array(C).fill(-1); this.cKind = new Uint8Array(C); this.cBirth = new Float32Array(C);
    this.cH = new Float32Array(C); this.cMtn = new Float32Array(C);
    const bIndex = Object.fromEntries(BLOCKS.map((b, i) => [b.id, i]));
    for (let i = 0; i < C; i++) if (code[i] !== '.') { this.cBlock[i] = bIndex[code[i]]; this.cKind[i] = 2; }
    for (let i = 0; i < C; i++) {                    // thềm lục địa: vành 1 ô quanh đất liền
      if (this.cKind[i] !== 2) continue;
      for (let q = 0; q < 8; q++) {
        const j = this.nbr8(i, q); if (j < 0 || this.cKind[j]) continue;
        this.cKind[j] = 1; this.cBlock[j] = this.cBlock[i];
      }
    }
    // Đi sâu vào nội địa → cao hơn (đồng bằng ven biển thấp)
    const dist = this.bfsDistance((i) => this.cKind[i] !== 2, (i) => this.cKind[i] === 2, 12);
    const nz = global.GodSim.makeNoise(this.rand), fbm = global.GodSim.fbm;
    this.cNoise = new Float32Array(C);
    for (let i = 0; i < C; i++) {
      const x = i % W, y = (i / W) | 0;
      this.cNoise[i] = fbm(nz, x / 9, y / 9, 4);
      if (this.cKind[i] === 2) this.cH[i] = 0.012 + 0.028 * smooth(0, 8, dist[i]) + 0.012 * this.cNoise[i];
    }
    // Tuổi vỏ: lớn dần từ các craton cổ ra ngoài
    for (let i = 0; i < C; i++) {
      if (this.cKind[i] !== 2) continue;
      const v = this.vec[i];
      let b = 250;
      for (const [la, lo, r, age] of CRATONS) {
        const u = toVec(la, lo), d = Math.acos(clamp(v[0] * u[0] + v[1] * u[1] + v[2] * u[2], -1, 1)) / D2R;
        b = Math.max(b, age - 55 * Math.max(0, d - r));
      }
      this.cBirth[i] = b;
    }
    for (let i = 0; i < C; i++) {                    // thềm xuất hiện cùng mảnh đất già nhất kề bên
      if (this.cKind[i] !== 1) continue;
      let b = 0;
      for (let q = 0; q < 8; q++) { const j = this.nbr8(i, q); if (j >= 0 && this.cKind[j] === 2) b = Math.max(b, this.cBirth[j]); }
      this.cBirth[i] = b;
    }
    // Vùng bao của từng khối (để bỏ qua nhanh khi tái dựng)
    this.bCap = BLOCKS.map((B) => {
      const r = toVec(B.ref[0], B.ref[1]); let minDot = 1;
      for (let i = 0; i < C; i++) if (this.cBlock[i] >= 0 && BLOCKS[this.cBlock[i]] === B) { const v = this.vec[i]; minDot = Math.min(minDot, v[0] * r[0] + v[1] * r[1] + v[2] * r[2]); }
      return { r, cos: Math.cos(Math.min(Math.PI, Math.acos(minDot) + 3 * D2R)) };
    });
    // Dãy núi: ô chịu ảnh hưởng & trọng số
    for (const R of RANGES) {
      R.cells = []; R.wts = [];
      for (let i = 0; i < C; i++) {
        if (this.cKind[i] !== 2) continue;
        const la = this.lat[i], lo = this.lon[i], cl = Math.cos(la * D2R);
        let best = 1e9;
        for (let s = 0; s + 1 < R.pts.length; s++) {
          const [a1, o1] = R.pts[s], [a2, o2] = R.pts[s + 1];
          const ax = (o1 - lo) * cl, ay = a1 - la, bx = (o2 - lo) * cl, by = a2 - la;
          const dx = bx - ax, dy = by - ay, t = clamp(-(ax * dx + ay * dy) / (dx * dx + dy * dy || 1), 0, 1);
          best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t));
        }
        if (best < R.w * 2.2) { R.cells.push(i); R.wts.push(Math.exp(-((best / R.w) ** 2)) * (0.65 + 1.2 * Math.abs(this.cNoise[i]))); }
      }
    }
    this.src = new Int32Array(C).fill(-1);            // mảnh vỏ chuẩn đang nằm ở ô này (−1 = vỏ đại dương)
    this.prevLoc = new Int32Array(C).fill(-1);
    this.plate = new Int8Array(C).fill(PACIFIC); this.bType = new Int8Array(C); this.oceanT = new Float32Array(C).fill(-0.5);
    this.tect = { quats: BLOCKS.map(() => [1, 0, 0, 0]), lastMa: Infinity, mtnMa: Infinity };
    this.reconstruct(this.ma, true);
    this.updateMountains(this.ma);
    for (let i = 0; i < C; i++) this.h[i] = this.heightTarget(i);
  };

  P.bfsDistance = function (isSource, passable, maxD) {
    const C = this.C, d = new Float32Array(C).fill(maxD), q = new Int32Array(C); let h = 0, t = 0;
    for (let i = 0; i < C; i++) if (isSource(i)) { d[i] = 0; q[t++] = i; }
    while (h < t) {
      const i = q[h++]; if (d[i] >= maxD) continue;
      for (let k = 0; k < 4; k++) { const j = this.nb[i * 4 + k]; if (j >= 0 && d[j] > d[i] + 1 && passable(j)) { d[j] = d[i] + 1; q[t++] = j; } }
    }
    return d;
  };

  P.updateMountains = function (ma) {
    const m = this.cMtn; m.fill(0);
    for (const R of RANGES) {
      let e;
      if (ma >= R.born) e = 0;
      else if (ma >= R.peak) e = smooth(R.born, R.peak, ma);
      else { const now = R.now ?? 1; e = now + (1 - now) * Math.exp(-(R.peak - ma) / 120); }
      if (e <= 0.001) continue;
      for (let k = 0; k < R.cells.length; k++) m[R.cells[k]] += R.h * e * R.wts[k];
    }
    this.tect.mtnMa = ma;
  };

  // Độ cao cân bằng của ô theo mảnh vỏ đang nằm ở đó
  P.heightTarget = function (i) {
    const s = this.src[i];
    let t;
    if (s >= 0 && this.cKind[s] === 2) t = this.cH[s] + Math.min(0.9, this.cMtn[s]);
    else if (s >= 0) t = -0.018;
    else t = this.oceanT[i];
    return t + this.deform[i];
  };
  P.updateTargets = function () {
    const hT = this.hT || (this.hT = new Float32Array(this.C)), d = this.deform;
    for (let i = 0; i < this.C; i++) hT[i] = this.heightTarget(i) - d[i];
  };

  // ---------------------------------------------------------------- tái dựng bản đồ ở thời điểm ma
  const MOVE = ['h', 'lava', 'ice', 'fert', 'moist', 'sea', 'grass', 'tree', 'seedbank', 'herb', 'pred', 'fire', 'plague', 'human', 'deform'];
  P.reconstruct = function (ma, first) {
    const { W, H, C } = this, T = this.tect;
    const quats = BLOCKS.map((_, b) => blockQuat(b, ma));
    const mats = quats.map((q) => qMat(qConj(q)));                 // hiện hành → hiện tại
    const caps = quats.map((q, b) => ({ r: qRot(q, this.bCap[b].r), cos: this.bCap[b].cos }));
    const newSrc = this._src2 || (this._src2 = new Int32Array(C));
    const owner = this._own || (this._own = new Int8Array(C));
    const R2D = 180 / Math.PI;
    for (let i = 0; i < C; i++) {
      const v = this.vec[i], v0 = v[0], v1 = v[1], v2 = v[2];
      let best = -1, bk = 0, bo = -1;
      for (let b = 0; b < BLOCKS.length; b++) {
        const cp = caps[b];
        if (v0 * cp.r[0] + v1 * cp.r[1] + v2 * cp.r[2] < cp.cos) continue;
        const M = mats[b];
        const ux = M[0] * v0 + M[1] * v1 + M[2] * v2, uy = M[3] * v0 + M[4] * v1 + M[5] * v2, uz = M[6] * v0 + M[7] * v1 + M[8] * v2;
        const la = Math.asin(uz < -1 ? -1 : uz > 1 ? 1 : uz) * R2D, lo = Math.atan2(uy, ux) * R2D;
        let y = Math.floor((90 - la) / 180 * H); if (y < 0) y = 0; else if (y >= H) y = H - 1;
        let x = Math.floor((lo + 180) / 360 * W); if (x < 0) x += W; else if (x >= W) x -= W;
        const c = y * W + x;
        if (this.cBlock[c] !== b || this.cBirth[c] < ma) continue;
        const kind = this.cKind[c];
        if (kind > bk || (kind === bk && this.src[i] >= 0 && this.cBlock[this.src[i]] === b)) { best = c; bk = kind; bo = b; }
      }
      newSrc[i] = best; owner[i] = bo;
    }
    // Mang các trường trạng thái theo mảnh vỏ (đất, cây, thú… trôi cùng lục địa)
    if (!first) {
      const F = MOVE.map((f) => this[f]);
      const buf = this._mbuf || (this._mbuf = MOVE.map(() => new Float32Array(C)));
      for (let f = 0; f < F.length; f++) buf[f].set(F[f]);
      for (let i = 0; i < C; i++) {
        const s = newSrc[i], old = this.src[i];
        if (s === old) continue;
        let j = s >= 0 ? this.prevLoc[s] : -1;
        // do làm tròn khi chiếu, mảnh vỏ có thể chưa có vị trí cũ → lấy từ mảnh kề bên
        for (let q = 0; j < 0 && s >= 0 && q < 8; q++) { const c = this.nbr8(s, q); if (c >= 0 && this.cBlock[c] === this.cBlock[s]) j = this.prevLoc[c]; }
        if (j < 0 && s >= 0 && old >= 0) continue;
        if (j >= 0) { for (let f = 0; f < F.length; f++) F[f][i] = buf[f][j]; }
        else if (s >= 0) {                          // mảnh vỏ vừa xuất hiện (mới hình thành / lộ ra)
          for (let f = 1; f < F.length; f++) F[f][i] = 0;
          this.fert[i] = 0.2; this.moist[i] = 0.3;
        } else if (old >= 0) {                      // lục địa rời đi → đáy biển mới
          for (let f = 1; f < F.length; f++) F[f][i] = 0;
          this.moist[i] = 1; this.h[i] = Math.min(this.h[i], -0.05);
        }
      }
    }
    this.src.set(newSrc);
    this.prevLoc.fill(-1);
    for (let i = 0; i < C; i++) if (newSrc[i] >= 0) this.prevLoc[newSrc[i]] = i;

    // Đại dương: chia mảng theo lục địa gần nhất; xa mọi lục địa → mảng Thái Bình Dương
    const plate = this.plate, q = this._bq || (this._bq = new Int32Array(C)), dC = this._dc || (this._dc = new Float32Array(C));
    let hd = 0, tl = 0;
    for (let i = 0; i < C; i++) {
      if (owner[i] >= 0) { plate[i] = owner[i]; dC[i] = this.cKind[newSrc[i]] === 2 ? 0 : 1; q[tl++] = i; }
      else { plate[i] = PACIFIC; dC[i] = 99; }
    }
    while (hd < tl) {
      const i = q[hd++]; if (dC[i] >= 14) continue;
      for (let k = 0; k < 4; k++) { const j = this.nb[i * 4 + k]; if (j >= 0 && dC[j] > dC[i] + 1) { dC[j] = dC[i] + 1; plate[j] = plate[i]; q[tl++] = j; } }
    }
    // Ranh giới mảng & loại (theo vận tốc tương đối của hai mảng)
    const step = BLOCKS.map((_, b) => qMat(qMul(blockQuat(b, ma - 4), qConj(quats[b]))));
    const velAt = (b, v) => {
      if (b === PACIFIC) return [-0.02 * v[1], 0.02 * v[0], 0];
      const M = step[b];
      return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2] - v[0], M[3] * v[0] + M[4] * v[1] + M[5] * v[2] - v[1], M[6] * v[0] + M[7] * v[1] + M[8] * v[2] - v[2]];
    };
    const bType = this.bType; bType.fill(0);
    const conv = [], div = [], trans = [];
    for (let i = 0; i < C; i++) {
      for (let k = 0; k < 4; k++) {
        const j = this.nb[i * 4 + k]; if (j < 0 || plate[j] === plate[i]) continue;
        let type;
        if (plate[i] === PACIFIC || plate[j] === PACIFIC) type = 1;      // vành đai lửa: hút chìm
        else {
          const v = this.vec[i], vi = velAt(plate[i], v), vj = velAt(plate[j], v), w = this.vec[j];
          const n = [w[0] - v[0], w[1] - v[1], w[2] - v[2]];
          const rx = vi[0] - vj[0], ry = vi[1] - vj[1], rz = vi[2] - vj[2];
          const app = rx * n[0] + ry * n[1] + rz * n[2], sp = Math.hypot(rx, ry, rz) * Math.hypot(n[0], n[1], n[2]) + 1e-12;
          type = Math.hypot(rx, ry, rz) < 1e-5 ? 3 : app / sp > 0.3 ? 1 : app / sp < -0.3 ? 2 : 3;
        }
        bType[i] = type; break;
      }
      if (bType[i] === 1) conv.push(i); else if (bType[i] === 2) div.push(i); else if (bType[i] === 3) trans.push(i);
    }
    this.boundary = { conv, div, trans };
    // Đáy biển: thềm → sườn dốc → biển thẳm; sống núi nơi tách giãn; rãnh sâu nơi hút chìm
    const dR = this.bfsDistance((i) => bType[i] === 2 && newSrc[i] < 0, () => true, 10);
    for (let i = 0; i < C; i++) {
      if (newSrc[i] >= 0) continue;
      const slope = -0.03 - 0.5 * smooth(1, 4, dC[i]);
      const ridge = -0.27 - 0.26 * smooth(0, 9, dR[i]);
      let d = Math.max(slope, ridge);
      if (bType[i] === 1 && dC[i] <= 3) d = Math.min(d, -0.66);
      this.oceanT[i] = d + 0.02 * this.cNoise[i];
    }
    T.quats = quats; T.lastMa = ma;
  };

  // Mỗi tick: tái dựng khi các khối đã xoay đủ xa, cập nhật núi, đưa địa hình về cân bằng
  P.stepTectonics = function () {
    const T = this.tect, ma = this.ma;
    let need = false;
    if (Math.abs(ma - T.lastMa) > 1e-6) {
      for (let b = 0; b < BLOCKS.length && !need; b++) {
        const q = blockQuat(b, ma), o = T.quats[b];
        const dot = Math.abs(q[0] * o[0] + q[1] * o[1] + q[2] * o[2] + q[3] * o[3]);
        if ((2 * Math.acos(Math.min(1, dot))) / D2R > 0.65) need = true;
      }
      if (!need && ma > 200 && Math.floor(T.lastMa / 25) !== Math.floor(ma / 25)) need = true;   // vỏ mới quanh craton
    }
    if (need) this.reconstruct(ma);
    const mtn = Math.abs(T.mtnMa - ma) > Math.max(0.05, ma * 0.004);
    if (mtn) this.updateMountains(ma);
    if (need || mtn || !this.hT) this.updateTargets();
    const h = this.h, deform = this.deform, hT = this.hT;
    for (let i = 0; i < this.C; i++) {
      h[i] += (hT[i] + deform[i] - h[i]) * 0.05;
      deform[i] *= 0.997;
    }
  };

  // ---------------------------------------------------------------- tiện ích
  P.plateName = function (p) { return PLATE_NAMES[p] || '—'; };
  // Một điểm (vĩ độ, kinh độ hiện tại) thuộc khối blockId đang nằm ở đâu vào thời điểm hiện hành?
  P.whereNow = function (lat, lon, blockId) {
    const b = BLOCKS.findIndex((x) => x.id === blockId);
    return toLatLon(qRot(blockQuat(b, this.ma), toVec(lat, lon)));
  };

  global.GodSim.BLOCKS = BLOCKS;
  global.GodSim.RANGES = RANGES;
  global.GodSim.CRATONS = CRATONS;
  global.GodSim.PACIFIC = PACIFIC;
  global.GodSim.blockQuat = blockQuat;
})(typeof window !== 'undefined' ? window : globalThis);
