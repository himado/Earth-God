/* =====================================================================
 *  ĐẢO SÁNG THẾ — Đạo diễn lịch sử Trái Đất (4,54 tỷ năm → hôm nay)
 *
 *  • Lịch thời gian: các giai đoạn gần đây được "giãn" ra để kịp quan sát
 *    (Hỏa Thành trôi rất nhanh, Kỷ Đệ Tứ & loài người chậm hơn).
 *  • Khí hậu nền theo dữ liệu cổ khí hậu (nhiệt độ toàn cầu, CO₂, O₂, mực nước
 *    biển — giản lược từ Scotese 2021, Berner GEOCARBSULF, Haq…).
 *    Tác động của Thần CỘNG THÊM lên khí hậu nền rồi tắt dần → lịch sử có thể rẽ nhánh.
 *  • Các mốc tiến hóa: một nhóm sinh vật chỉ có thể xuất hiện sau mốc thật của nó.
 *  • Sự kiện lịch sử: đến đúng mốc thì xảy ra (thiên thạch Chicxulub, bẫy Siberia…)
 *    kèm thẻ giải thích hiện tượng.
 * ===================================================================== */
(function (global) {
  'use strict';
  const { World, clamp, smooth, gauss } = global.GodSim;

  // [từ (triệu năm trước), đến, số tick]
  const SCHEDULE = [[4540, 4000, 300], [4000, 2500, 420], [2500, 1000, 420], [1000, 541, 360], [541, 252, 800],
    [252, 66, 800], [66, 2.6, 450], [2.6, 0.3, 250], [0.3, 0.012, 220], [0.012, 0.0003, 110], [0.0003, 0, 30]];
  const TOTAL_TICKS = SCHEDULE.reduce((a, s) => a + s[2], 0);
  function tickToMa(t) {
    for (const [a, b, n] of SCHEDULE) { if (t <= n) return a + (b - a) * (t / n); t -= n; }
    return 0;
  }
  function maToTick(ma) {
    let t = 0;
    for (const [a, b, n] of SCHEDULE) { if (ma >= b) return t + n * ((a - ma) / (a - b)); t += n; }
    return TOTAL_TICKS;
  }

  // Bảng nội suy tuyến tính theo thời gian (triệu năm trước)
  const lerpTable = (tab, ma) => {
    if (ma >= tab[0][0]) return tab[0][1];
    for (let k = 0; k + 1 < tab.length; k++) {
      const [a, va] = tab[k], [b, vb] = tab[k + 1];
      if (ma <= a && ma >= b) return va + (vb - va) * ((a - ma) / (a - b));
    }
    return tab[tab.length - 1][1];
  };
  // Nhiệt độ trung bình toàn cầu (°C)
  const T_TAB = [[4540, 1700], [4520, 1400], [4500, 900], [4480, 450], [4460, 200], [4440, 120], [4420, 98], [4400, 85], [4300, 75],
    [4000, 60], [3800, 50], [3500, 40], [3000, 30], [2500, 24], [2420, 16], [2400, -6], [2300, -12], [2200, -6], [2100, 12], [2000, 22],
    [1500, 20], [1000, 18], [760, 16], [720, -25], [700, -30], [670, -28], [660, 8], [650, -22], [640, -25], [635, 18], [600, 17],
    [560, 20], [541, 22], [500, 26], [470, 22], [450, 16], [445, 7], [440, 18], [420, 22], [400, 24], [370, 22], [360, 18], [340, 14],
    [320, 12], [300, 12], [280, 14], [260, 18], [253, 22], [252, 32], [245, 27], [230, 25], [200, 24], [150, 22], [100, 26], [90, 28],
    [70, 22], [66.2, 21], [66, 17], [65.5, 22], [60, 22], [56.1, 26], [56, 31], [55, 27], [50, 28], [45, 24], [35, 20], [34, 16], [25, 17],
    [15, 19], [10, 17], [5, 16], [3, 15.5], [2.6, 15]];
  // CO₂ (1 = 280 ppm, mức tiền công nghiệp)
  const CO2_TAB = [[4540, 100], [4000, 60], [3000, 30], [2500, 20], [2400, 10], [2350, 3], [2200, 8], [1500, 8], [1000, 6], [730, 4], [720, 1],
    [650, 1.5], [635, 20], [600, 10], [541, 16], [450, 12], [445, 4], [420, 12], [400, 8], [360, 3], [320, 1.2], [300, 1], [260, 2],
    [253, 3], [252, 8], [200, 6], [150, 6], [100, 4], [66, 3], [56, 6], [50, 4], [34, 2.5], [20, 1.4], [3, 1.3], [2.6, 1]];
  // O₂ (1 = 21%)
  const O2_TAB = [[2450, 0], [2300, 0.05], [2000, 0.08], [800, 0.1], [600, 0.4], [540, 0.6], [420, 0.7], [380, 0.9], [300, 1.5], [260, 1.2],
    [252, 0.75], [200, 0.8], [100, 1.1], [0, 1]];
  // Mực nước biển (1 ≈ 8 km; 0,0125 ≈ 100 m)
  const SEA_TAB = [[541, 0.02], [480, 0.04], [446, 0.03], [445, 0], [400, 0.02], [300, 0], [250, -0.005], [200, 0], [100, 0.03],
    [80, 0.03], [66, 0.015], [34, 0.005], [3, 0], [0, 0]];

  // Chu kỳ băng hà Kỷ Đệ Tứ (Milankovitch): 41 nghìn năm trước 1 triệu năm, 100 nghìn năm sau đó
  function glacial(ma) {
    if (ma > 2.6) return 0;
    const ka = ma * 1000;
    if (ka < 11.7) return 0;                                          // Holocen ấm
    if (ma > 1) return 0.45 * (0.5 + 0.5 * Math.sin((ka / 41) * Math.PI * 2));
    const u = (((ka - 11) % 100) + 100) % 100;                        // răng cưa: lạnh dần ~90 nghìn năm, ấm vụt ~10 nghìn năm
    return u >= 88 ? 0 : u >= 10 ? (88 - u) / 78 : u / 10;
  }
  function icehouseAt(ma) {
    return ma < 34 || (ma >= 260 && ma <= 340) || (ma >= 443 && ma <= 447) || (ma >= 635 && ma <= 720) || (ma >= 2100 && ma <= 2400);
  }
  function climateAt(ma) {
    let T = lerpTable(T_TAB, ma), CO2 = lerpTable(CO2_TAB, ma), Tq = T;
    if (ma <= 2.6) {
      const g = glacial(ma);
      T = 14.3 - g * (ma > 1 ? 7 : 8.5); CO2 = 1 - 0.32 * g; Tq = 14.3;
      if (ma < 0.00025) { const k = (0.00025 - ma) / 0.00025; T = 14.3 + 1.2 * Math.pow(k, 1.6); CO2 = 1 + 0.52 * Math.pow(k, 1.6); }   // cách mạng công nghiệp
    }
    let meteorRate = 0.0006;
    if (ma > 4100) meteorRate = 0.05; else if (ma > 3800) meteorRate = 0.09;     // Đợt bắn phá muộn
    return { T, Tq, CO2, O2: lerpTable(O2_TAB, ma), sea: lerpTable(SEA_TAB, ma), icehouse: icehouseAt(ma), meteorRate };
  }

  // ---------------------------------------------------------------- niên đại địa chất (màu theo ICS)
  const EONS = [
    { from: 4540, to: 4000, name: 'Liên đại Hỏa Thành', color: '#AE027E' },
    { from: 4000, to: 2500, name: 'Liên đại Thái Cổ', color: '#F0047F' },
    { from: 2500, to: 538.8, name: 'Liên đại Nguyên Sinh', color: '#F73563' },
    { from: 538.8, to: 0, name: 'Liên đại Hiển Sinh', color: '#9AD9DD' },
  ];
  const PERIODS = [
    { from: 538.8, to: 485.4, name: 'Kỷ Cambri', era: 'Đại Cổ Sinh', color: '#7FA056' },
    { from: 485.4, to: 443.8, name: 'Kỷ Ordovic', era: 'Đại Cổ Sinh', color: '#009270' },
    { from: 443.8, to: 419.2, name: 'Kỷ Silur', era: 'Đại Cổ Sinh', color: '#B3E1B6' },
    { from: 419.2, to: 358.9, name: 'Kỷ Devon', era: 'Đại Cổ Sinh', color: '#CB8C37' },
    { from: 358.9, to: 298.9, name: 'Kỷ Than Đá', era: 'Đại Cổ Sinh', color: '#67A599' },
    { from: 298.9, to: 251.9, name: 'Kỷ Permi', era: 'Đại Cổ Sinh', color: '#F04028' },
    { from: 251.9, to: 201.4, name: 'Kỷ Trias', era: 'Đại Trung Sinh', color: '#812B92' },
    { from: 201.4, to: 145, name: 'Kỷ Jura', era: 'Đại Trung Sinh', color: '#34B2C9' },
    { from: 145, to: 66, name: 'Kỷ Phấn Trắng', era: 'Đại Trung Sinh', color: '#7FC64E' },
    { from: 66, to: 23.03, name: 'Kỷ Paleogen', era: 'Đại Tân Sinh', color: '#FD9A52' },
    { from: 23.03, to: 2.58, name: 'Kỷ Neogen', era: 'Đại Tân Sinh', color: '#FFE619' },
    { from: 2.58, to: 0, name: 'Kỷ Đệ Tứ', era: 'Đại Tân Sinh', color: '#F9F97F' },
  ];
  const SUPERCONTINENTS = [[3600, 2800, 'Vaalbara'], [2700, 2100, 'Kenorland'], [1800, 1450, 'Columbia (Nuna)'], [1100, 750, 'Rodinia'],
    [620, 545, 'Pannotia'], [335, 175, 'Pangaea']];

  function faunaAt(ma) {
    if (ma > 375) return { herb: 'Động vật trên cạn', pred: 'Động vật săn mồi', kind: 'none' };
    if (ma > 312) return { herb: 'Lưỡng cư ăn thực vật', pred: 'Lưỡng cư săn mồi', kind: 'amphibian' };
    if (ma > 233) return { herb: 'Bò sát & thú răng chó ăn cỏ', pred: 'Bò sát săn mồi', kind: 'reptile' };
    if (ma > 66) return { herb: 'Khủng long ăn cỏ', pred: 'Khủng long ăn thịt', kind: 'dino' };
    return { herb: 'Thú có vú ăn cỏ', pred: 'Thú săn mồi', kind: 'mammal' };
  }
  function floraAt(ma) {
    return {
      grass: ma > 420 ? 'Rêu & thực vật thấp' : ma > 25 ? 'Dương xỉ & cây bụi' : 'Đồng cỏ',
      tree: ma > 300 ? 'Rừng dương xỉ khổng lồ' : ma > 130 ? 'Rừng hạt trần (thông, tuế)' : 'Rừng cây có hoa',
      sea: ma > 541 ? 'Vi sinh vật biển' : 'Sinh vật biển',
    };
  }

  // ---------------------------------------------------------------- sự kiện lịch sử
  const at = (w, lat, lon, block) => { const [la, lo] = w.whereNow(lat, lon, block); return [((lo + 180) / 360) * w.W, ((90 - la) / 180) * w.H]; };
  function extinction(w, f) {
    const R = w.rand;
    for (let i = 0; i < w.C; i++) {
      const k = 1 - f.k * (0.7 + 0.6 * R());
      if (f.sea) w.sea[i] *= 1 - f.sea * (0.7 + 0.6 * R());
      if (f.land) { w.herb[i] *= 1 - f.land * (0.7 + 0.6 * R()); w.pred[i] *= 1 - f.land * (0.8 + 0.4 * R()); }
      if (f.plant) { w.tree[i] *= 1 - f.plant * (0.6 + 0.8 * R()); w.grass[i] *= 1 - f.plant * 0.5 * R(); }
      void k;
    }
    w.lastExtinction = w.tick;
  }
  const EVENTS = [
    { ma: 4540, icon: '🌑', title: 'Trái Đất ra đời', major: true, text: 'Bụi và khí quanh Mặt Trời non trẻ va vào nhau, kết dính thành các tiểu hành tinh rồi thành Trái Đất. Năng lượng va chạm và phóng xạ làm cả hành tinh nóng chảy thành biển dung nham.' },
    { ma: 4510, icon: '🌕', title: 'Va chạm Theia — Mặt Trăng ra đời', major: true, text: 'Một hành tinh cỡ Sao Hỏa (Theia) đâm sượt vào Trái Đất. Mảnh vỡ văng ra quỹ đạo tụ lại thành Mặt Trăng. Cú va chạm làm nghiêng trục Trái Đất — nguồn gốc của các mùa.',
      act: (w) => w.request('meteor', w.W * 0.3, w.H * 0.4, { p: 3, r: 30, scripted: true, title: 'Va chạm Theia' }) },
    { ma: 4400, icon: '🌊', title: 'Đại dương đầu tiên', major: true, text: 'Khi bề mặt nguội dưới 100°C, hơi nước trong khí quyển ngưng tụ thành những trận mưa kéo dài hàng triệu năm, lấp đầy các lòng chảo thành đại dương. Tinh thể zircon 4,4 tỷ năm ở Jack Hills (Úc) cho thấy nước lỏng đã có từ rất sớm.' },
    { ma: 4100, icon: '☄️', title: 'Đợt bắn phá muộn', text: 'Quỹ đạo của các hành tinh khổng lồ thay đổi, hất hàng loạt tiểu hành tinh vào phía trong Hệ Mặt Trời. Trái Đất và Mặt Trăng hứng chịu mưa thiên thạch dày đặc — dấu vết còn thấy rõ trên các hố ở Mặt Trăng.' },
    { ma: 3800, icon: '🧬', title: 'Sự sống đầu tiên', major: true, text: 'Trong các miệng phun thủy nhiệt dưới đáy biển, phân tử tự nhân bản (có thể là RNA) xuất hiện rồi được bọc trong màng — tế bào đầu tiên. Dấu vết sự sống cổ nhất là các trụ đá vôi stromatolite ~3,5 tỷ năm.' },
    { ma: 3600, icon: '🧩', title: 'Vaalbara — lục địa sơ khai', text: 'Vỏ lục địa đầu tiên là các "craton" nhỏ như Kaapvaal (Nam Phi) và Pilbara (Úc). Đá cổ ở hai nơi giống nhau đến kinh ngạc — có thể chúng từng là một khối: Vaalbara.' },
    { ma: 2700, icon: '🦠', title: 'Vi khuẩn lam quang hợp', major: true, text: 'Vi khuẩn lam (cyanobacteria) dùng ánh sáng Mặt Trời tách nước, thải ra oxy. Ban đầu oxy bị sắt hòa tan trong biển "nuốt" hết, tạo nên các lớp quặng sắt dải khổng lồ.',
      act: (w) => { w.photosynthesis = true; } },
    { ma: 2650, icon: '🧩', title: 'Siêu lục địa Kenorland', text: 'Các craton gom lại thành Kenorland. Lục địa lớn làm tăng phong hóa đá — quá trình hút CO₂ khỏi khí quyển.' },
    { ma: 2400, icon: '💨', title: 'Đại sự kiện Oxy hóa', major: true, text: 'Khi sắt trong biển đã bị oxy hóa hết, oxy bắt đầu tích tụ trong không khí. Tầng ozone hình thành, chắn tia cực tím. Với nhiều vi sinh vật kỵ khí, oxy là chất độc — cuộc tuyệt chủng đầu tiên.' },
    { ma: 2380, icon: '❄️', title: 'Băng hà Huron', major: true, text: 'Oxy phá hủy khí mê-tan — một khí nhà kính mạnh. Nhiệt độ lao dốc, băng có thể phủ tới gần xích đạo suốt hàng trăm triệu năm.' },
    { ma: 1800, icon: '🧩', title: 'Siêu lục địa Columbia (Nuna)', text: 'Hầu hết vỏ lục địa thời ấy hợp lại thành Columbia. Cũng khoảng thời gian này xuất hiện tế bào nhân thực — tổ tiên của mọi động, thực vật, nấm.' },
    { ma: 1500, icon: '😴', title: '"Tỷ năm nhàm chán"', text: 'Khí hậu ổn định, oxy thấp, sự sống tiến hóa chậm. Nhưng âm thầm, sinh sản hữu tính và sinh vật đa bào đầu tiên đã ra đời.' },
    { ma: 1100, icon: '🧩', title: 'Siêu lục địa Rodinia', major: true, text: 'Các lục địa va vào nhau tạo thành Rodinia, bao quanh bởi đại dương toàn cầu Mirovia. Laurentia (Bắc Mỹ) nằm ở trung tâm.' },
    { ma: 750, icon: '💥', title: 'Rodinia tách giãn', text: 'Nhiệt tích tụ dưới siêu lục địa làm vỏ nứt vỡ. Nhiều đường bờ biển mới, nhiều đá bazan mới bị phong hóa — CO₂ bị hút mạnh khỏi khí quyển.' },
    { ma: 717, icon: '🥶', title: 'Trái Đất quả cầu tuyết', major: true, text: 'Băng Sturtian rồi Marinoan phủ gần như toàn bộ hành tinh, kể cả xích đạo. Băng trắng phản xạ ánh nắng làm càng lạnh hơn (phản hồi suất phản chiếu). Chỉ khi núi lửa tích đủ CO₂ (~635 triệu năm trước), Trái Đất mới tan băng.' },
    { ma: 635, icon: '🌡️', title: 'Tan băng & bùng nổ oxy', text: 'Băng tan nhanh dưới hiệu ứng nhà kính. Dinh dưỡng từ đá bị băng nghiền đổ ra biển, oxy tăng vọt — mở đường cho động vật lớn.' },
    { ma: 600, icon: '🧩', title: 'Pannotia', text: 'Một siêu lục địa ngắn ngủi gồm Gondwana, Laurentia, Baltica. Sinh vật Ediacara — những "tấm đệm" mềm kỳ lạ — sống dưới đáy biển.' },
    { ma: 538.8, icon: '🐚', title: 'Bùng nổ kỷ Cambri', major: true, text: 'Trong ~20 triệu năm, gần như mọi ngành động vật hiện đại xuất hiện: mắt, vỏ cứng, chân khớp (bọ ba thùy). Nguyên nhân: oxy đủ cao, cuộc chạy đua giữa kẻ săn và con mồi, biển nông ấm rộng lớn.' },
    { ma: 470, icon: '🌿', title: 'Thực vật lên cạn', major: true, text: 'Rêu và thực vật thấp từ tảo lục rời nước, chinh phục đất liền. Rễ cây phá đá thành đất, hút CO₂ — Trái Đất bắt đầu xanh.' },
    { ma: 445, icon: '☠️', title: 'Tuyệt chủng Ordovic–Silur', major: true, text: 'Gondwana trôi qua Nam Cực, băng hà phủ Bắc Phi. Mực nước biển tụt hàng trăm mét, biển nông khô cạn — ~85% loài sinh vật biển biến mất (cuộc đại tuyệt chủng thứ nhất).',
      act: (w) => extinction(w, { k: 0, sea: 0.75, land: 0, plant: 0.1 }) },
    { ma: 420, icon: '🏔️', title: 'Va chạm Caledonia', text: 'Laurentia (Bắc Mỹ) và Baltica (châu Âu) va nhau, dựng lên dãy núi Caledonia — nay là núi Scandinavia, Scotland. Lục địa Laurussia (Lục địa Đỏ cổ) hình thành.' },
    { ma: 385, icon: '🌳', title: 'Những khu rừng đầu tiên', major: true, text: 'Cây có gỗ và rễ sâu (như Archaeopteris) mọc cao hàng chục mét. Rừng hút CO₂, làm lạnh khí hậu và tăng oxy.' },
    { ma: 375, icon: '🐸', title: 'Cá bước lên bờ', major: true, text: 'Cá vây thùy như Tiktaalik có vây khỏe như chân, dần thành động vật bốn chân (lưỡng cư) — tổ tiên của mọi động vật có xương sống trên cạn.' },
    { ma: 372, icon: '☠️', title: 'Tuyệt chủng Devon muộn', major: true, text: 'Thực vật phát triển bùng nổ đẩy dinh dưỡng xuống biển gây thiếu oxy; khí hậu biến động. Rạn san hô sụp đổ, ~75% loài biến mất (lần thứ hai).',
      act: (w) => extinction(w, { k: 0, sea: 0.6, land: 0.3, plant: 0.15 }) },
    { ma: 340, icon: '🪵', title: 'Rừng Than Đá & côn trùng khổng lồ', major: true, text: 'Đầm lầy rừng dương xỉ khổng lồ phủ vùng xích đạo. Gỗ chết chưa bị nấm phân hủy hết, bị vùi lấp thành than đá. Oxy đạt ~35% — chuồn chuồn Meganeura sải cánh 70 cm.' },
    { ma: 335, icon: '🌐', title: 'Siêu lục địa Pangaea', major: true, text: 'Gondwana va vào Laurussia, Siberia nhập vào ở dãy Ural — mọi lục địa hợp thành Pangaea ("toàn bộ đất"), bao quanh bởi đại dương Panthalassa. Nội địa khổng lồ xa biển trở nên khô hạn.' },
    { ma: 300, icon: '❄️', title: 'Băng hà Karoo', text: 'Phần nam Gondwana nằm ở cực Nam, rừng Than Đá hút CO₂ — băng phủ Nam Phi, Ấn Độ, Úc, Nam Cực. Vết băng cào giống nhau trên các lục địa nay cách xa là bằng chứng cho thuyết trôi dạt lục địa.' },
    { ma: 252, icon: '🌋', title: 'Đại tuyệt chủng Permi–Trias', major: true, text: 'Bẫy Siberia phun trào hàng triệu km³ dung nham, đốt cả mỏ than: CO₂ vọt lên, Trái Đất nóng ~10°C, đại dương axit hóa và thiếu oxy. ~90% loài biển và ~70% loài trên cạn biến mất — "Đại Diệt Vong", lần thứ ba và tồi tệ nhất.',
      act: (w) => { const [x, y] = at(w, 62, 95, 'i'); w.request('volcano', x, y, { p: 2.5, r: 14, scripted: true, title: 'Bẫy Siberia' }); extinction(w, { k: 0, sea: 0.9, land: 0.75, plant: 0.6 }); } },
    { ma: 233, icon: '🦖', title: 'Khủng long xuất hiện', major: true, text: 'Sau Đại Diệt Vong, những bò sát nhỏ chạy bằng hai chân (như Eoraptor) tiến hóa thành khủng long. Chúng sẽ thống trị đất liền suốt 165 triệu năm.' },
    { ma: 201.4, icon: '☠️', title: 'Tuyệt chủng Trias–Jura', major: true, text: 'Pangaea bắt đầu nứt; Tỉnh magma Trung Đại Tây Dương (CAMP) phun trào dọc vết nứt. Biến đổi khí hậu xóa sổ ~75% loài — mở đường cho khủng long trở nên khổng lồ (lần thứ tư).',
      act: (w) => { const [x, y] = at(w, 33, -78, 'a'); w.request('volcano', x, y, { p: 2, r: 12, scripted: true, title: 'Phun trào CAMP' }); extinction(w, { k: 0, sea: 0.5, land: 0.6, plant: 0.3 }); } },
    { ma: 180, icon: '💥', title: 'Pangaea tách giãn — Đại Tây Dương ra đời', major: true, text: 'Bắc Mỹ tách khỏi châu Phi; sống núi giữa Đại Tây Dương bắt đầu đẩy hai bờ ra xa vài cm mỗi năm (bằng tốc độ móng tay mọc). Gondwana cũng vỡ: Nam Cực–Úc, Ấn Độ, Madagascar tách khỏi châu Phi.' },
    { ma: 150, icon: '🦕', title: 'Khủng long khổng lồ & chim đầu tiên', text: 'Khủng long chân thằn lằn như Brachiosaurus nặng hàng chục tấn. Archaeopteryx — nửa khủng long nửa chim — cho thấy chim chính là khủng long có lông vũ.' },
    { ma: 130, icon: '🌸', title: 'Thực vật có hoa', text: 'Cây hạt kín (có hoa, có quả) xuất hiện và lan nhanh nhờ côn trùng thụ phấn — chúng nay chiếm ~90% loài thực vật.' },
    { ma: 100, icon: '🌊', title: 'Biển nội địa kỷ Phấn Trắng', text: 'Sống núi giữa đại dương hoạt động mạnh làm đáy biển phồng lên, nước biển dâng cao hơn ngày nay ~250 m. Một biển nông chia đôi Bắc Mỹ (Western Interior Seaway). Không có băng ở hai cực.' },
    { ma: 66, icon: '☄️', title: 'Thiên thạch Chicxulub — khủng long tuyệt chủng', major: true, text: 'Một tiểu hành tinh rộng ~10 km đâm xuống bán đảo Yucatán (Mexico). Bụi và lưu huỳnh che Mặt Trời nhiều năm, quang hợp sụp đổ; cùng lúc bẫy Deccan ở Ấn Độ phun trào. ~76% loài biến mất, kể cả mọi khủng long không biết bay (lần thứ năm).',
      act: (w) => { const [x, y] = at(w, 21.3, -89.5, 'a'); w.request('meteor', x, y, { p: 2.4, r: 9, scripted: true, title: 'Thiên thạch Chicxulub' }); const [x2, y2] = at(w, 19, 74, 'd'); w.request('volcano', x2, y2, { p: 1.5, r: 9, scripted: true, title: 'Bẫy Deccan', quiet: false }); extinction(w, { k: 0, sea: 0.6, land: 0.92, plant: 0.4 }); } },
    { ma: 65.5, icon: '🐭', title: 'Thú có vú lên ngôi', major: true, text: 'Những loài thú nhỏ sống sót nhờ đào hang, ăn tạp. Khi khủng long biến mất, chúng nhanh chóng tiến hóa thành đủ mọi hình dạng — từ dơi, cá voi đến loài linh trưởng.' },
    { ma: 56, icon: '🔥', title: 'Cực đại nhiệt Paleocen–Eocen', text: 'Lượng lớn carbon (có thể từ mê-tan đáy biển) thoát ra trong vài nghìn năm: Trái Đất nóng thêm 5–8°C. Rừng nhiệt đới mọc tới Bắc Cực — một "phiên bản cổ" của biến đổi khí hậu ngày nay.' },
    { ma: 50, icon: '🏔️', title: 'Ấn Độ đâm vào châu Á — Himalaya mọc lên', major: true, text: 'Sau hành trình ~5.000 km về phía bắc (nhanh tới 15 cm/năm), mảng Ấn Độ đâm vào châu Á. Vỏ lục địa quá nhẹ không chìm được nên bị nén dày, dựng lên Himalaya và cao nguyên Tây Tạng — vẫn đang cao thêm vài mm mỗi năm.' },
    { ma: 34, icon: '🧊', title: 'Nam Cực đóng băng', major: true, text: 'Eo biển Drake mở ra khi Nam Mỹ tách khỏi Nam Cực; dòng hải lưu vòng quanh Nam Cực cô lập lục địa khỏi nước ấm. CO₂ giảm, băng bắt đầu phủ Nam Cực — Trái Đất bước vào "nhà băng".' },
    { ma: 20, icon: '🌾', title: 'Đồng cỏ lan rộng', text: 'Khí hậu khô và mát hơn; cỏ (thực vật C4) lan khắp các lục địa. Thú ăn cỏ tiến hóa răng cao, chân dài để chạy trên thảo nguyên — như ngựa, linh dương.' },
    { ma: 7, icon: '🐒', title: 'Tổ tiên loài người tách khỏi tinh tinh', text: 'Ở châu Phi, một nhánh vượn bắt đầu đi bằng hai chân (Sahelanthropus, sau đó Australopithecus — "Lucy" 3,2 triệu năm).' },
    { ma: 2.58, icon: '❄️', title: 'Kỷ băng hà Đệ Tứ', major: true, text: 'Eo Panama khép lại làm thay đổi hải lưu; kết hợp với dao động quỹ đạo Trái Đất (chu kỳ Milankovitch), băng phủ Bắc Mỹ và châu Âu rồi tan theo nhịp 41.000 năm, sau đó 100.000 năm. Mỗi lần băng lan, nước biển hạ ~120 m.' },
    { ma: 0.3, icon: '🧑', title: 'Homo sapiens ra đời', major: true, text: 'Người hiện đại xuất hiện ở châu Phi (hóa thạch Jebel Irhoud, Maroc ~300.000 năm). Biết dùng lửa, chế tác công cụ đá, sống thành bầy săn bắt – hái lượm.' },
    { ma: 0.07, icon: '🚶', title: 'Rời khỏi châu Phi', major: true, text: 'Một nhóm nhỏ Homo sapiens vượt eo Bab-el-Mandeb sang Ả Rập rồi lan khắp Á–Âu, tới Úc (~65.000–50.000 năm trước bằng thuyền) và gặp người Neanderthal, Denisova.' },
    { ma: 0.026, icon: '🧊', title: 'Cực đại băng hà cuối cùng', major: true, text: 'Băng dày 3 km phủ Canada và Bắc Âu. Nước biển thấp hơn ~120 m: cầu đất Bering nối châu Á với châu Mỹ, Anh nối với châu Âu, Indonesia nối với lục địa Á.' },
    { ma: 0.016, icon: '🌉', title: 'Người tới châu Mỹ', text: 'Con người theo cầu đất Bering và dọc bờ Thái Bình Dương tràn xuống châu Mỹ, tới mũi Nam Mỹ chỉ trong vài nghìn năm. Nhiều thú lớn (voi ma mút, lười đất khổng lồ) biến mất theo sau bước chân người.' },
    { ma: 0.0117, icon: '🌾', title: 'Thế Holocen — nông nghiệp ra đời', major: true, text: 'Băng tan, khí hậu ấm và ổn định bất thường. Ở Lưỡi liềm Màu mỡ, Trung Quốc, Trung Mỹ, Tây Phi… con người thuần hóa lúa mì, lúa nước, ngô, cừu, bò — làng mạc định cư ra đời.' },
    { ma: 0.0055, icon: '🏛️', title: 'Những thành phố đầu tiên', text: 'Lưỡng Hà, Ai Cập, thung lũng Indus, sông Hoàng Hà: chữ viết, kim loại, nhà nước. Rừng bị chặt để làm ruộng — con người bắt đầu đổi màu bề mặt Trái Đất.' },
    { ma: 0.00025, icon: '🏭', title: 'Cách mạng công nghiệp', major: true, text: 'Đốt than, dầu, khí đẩy CO₂ từ 280 lên 420 ppm chỉ trong ~250 năm — nhanh hơn bất kỳ biến đổi tự nhiên nào trong hàng triệu năm. Nhiệt độ toàn cầu đã tăng ~1,2°C, băng tan, nước biển dâng.' },
  ];

  // ---------------------------------------------------------------- vòng đời
  const P = World.prototype;
  P.historyInit = function () {
    this.ma = 4540; this.hist = climateAt(4540); this.evIdx = 0; this.ended = false; this.future = false;
    this.humanCO2 = 0; this.treesOK = false; this.humanStarted = false;
  };
  P.historyStep = function () {
    if (this.future) {
      this.ma -= 0.05;
      this.hist = { T: 15, Tq: 14.3, CO2: this.CO2, O2: 1, sea: 0, icehouse: true, meteorRate: 0.0006 };
      return;
    }
    const prev = this.ma;
    this.ma = Math.max(0, tickToMa(this.tick));
    this.hist = climateAt(this.ma);
    while (this.evIdx < EVENTS.length && EVENTS[this.evIdx].ma >= this.ma) {
      const ev = EVENTS[this.evIdx++];
      if (ev.ma > prev + 1e-9 && this.tick > 1) continue;
      this.log(`${ev.icon} ${ev.title}`, 'history', { card: ev });
      if (ev.act) ev.act(this);
    }
    if (this.ma <= 0 && !this.ended) {
      this.ended = true;
      this.log('🌍 Hôm nay — 4,54 tỷ năm lịch sử Trái Đất đã hoàn tất.', 'history', { card: this.presentCard() });
    }
  };
  P.presentCard = function () {
    const s = this.stats, acts = this.godActs;
    return {
      icon: '🌍', title: 'Hôm nay', major: true, ma: 0,
      text: `Nhiệt độ trung bình ${this.T.toFixed(1)}°C, CO₂ ${Math.round(this.CO2 * 280)} ppm, đại dương phủ ${Math.round(s.oceanFrac * 100)}% bề mặt. ` +
        (acts ? `Bạn đã can thiệp ${acts} lần — hãy so sánh Trái Đất của bạn với thực tế!` : 'Không có sự can thiệp nào: đây là Trái Đất như chúng ta biết.') +
        ' Bấm ▶ để tiếp tục vào tương lai: các lục địa vẫn trôi, khí hậu tự vận hành.',
    };
  };

  // Tiến hóa theo mốc thật: nhóm sinh vật chỉ xuất hiện sau mốc của nó; nếu đã tới mốc mà còn hiếm → quần thể mới nảy sinh
  P.stepEvolution = function () {
    const ma = this.ma, s = this.stats, R = this.rand, fut = this.future;
    const ok = (gate) => fut || ma <= gate;
    const spawn = (n, pred, fn) => { for (let k = 0; k < n; k++) { const i = this.randomCell(pred, 400); if (i >= 0) this.forDisk(i % this.W, (i / this.W) | 0, 2, fn); } };
    if (ok(3800) && this.oceansDone && s.sea < 0.003 && this.T < 95 && R() < 0.1) {
      spawn(6, (i) => this.isOcean[i] && this.temp[i] > 0 && this.temp[i] < 90, (j) => { if (this.isOcean[j]) this.sea[j] = Math.max(this.sea[j], 0.08); });
      this.lifeEver = true;
    }
    if (ok(2700) && s.sea > 0.01) this.photosynthesis = true;
    if (ok(470) && this.ozone > 0.5 && s.grass < 0.04 && R() < 0.12)
      spawn(10, (i) => !this.isOcean[i] && this.lava[i] < 0.05 && this.moist[i] > 0.3 && this.temp[i] > 5 && this.temp[i] < 32,
        (j) => { if (!this.isOcean[j]) { this.grass[j] = Math.max(this.grass[j], 0.1); this.seedbank[j] += 0.2; } });
    this.treesOK = ok(385);
    if (this.treesOK && s.tree < 0.04 && s.grass > 0.02 && R() < 0.12)
      spawn(10, (i) => this.grass[i] > 0.3 && this.moist[i] > 0.45, (j) => { if (!this.isOcean[j]) this.tree[j] = Math.max(this.tree[j], 0.1); });
    if (ok(375) && s.herb < 0.002 && s.grass + s.tree > 0.05 && this.O2 > 0.3 && R() < 0.08)
      spawn(8, (i) => this.grass[i] + this.tree[i] > 0.5, (j) => { if (!this.isOcean[j]) this.herb[j] = Math.max(this.herb[j], 0.12); });
    if (ok(375) && s.pred < 0.0005 && s.herb > 0.005 && R() < 0.08)
      spawn(6, (i) => this.herb[i] > 0.1, (j) => { if (!this.isOcean[j]) this.pred[j] = Math.max(this.pred[j], 0.05); });
  };

  // Thành phố có thật: [tên, vĩ độ, kinh độ, thời điểm ra đời (triệu năm trước), là đô thị hiện đại?]
  // (10.000 năm gần đây các lục địa gần như không dịch chuyển nên dùng thẳng tọa độ hiện tại)
  const CITIES = [
    ['Jericho', 31.9, 35.4, 0.0105], ['Çatalhöyük', 37.7, 32.8, 0.0095], ['Uruk', 31.3, 45.6, 0.006], ['Memphis', 29.8, 31.2, 0.0051],
    ['Mohenjo-daro', 27.3, 68.1, 0.0045], ['Babylon', 32.5, 44.4, 0.0042], ['Ân Khư (An Dương)', 36.1, 114.3, 0.0033], ['Athens', 38, 23.7, 0.0034],
    ['Roma', 41.9, 12.5, 0.00277], ['Cổ Loa', 21.1, 105.9, 0.0023], ['Teotihuacan', 19.7, -98.8, 0.0021], ['Trường An', 34.3, 108.9, 0.0022],
    ['Angkor', 13.4, 103.9, 0.0012], ['Thăng Long – Hà Nội', 21.03, 105.85, 0.00102], ['Cuzco', -13.5, -72, 0.0008],
    ['London', 51.5, -0.1, 0.0002, 1], ['Paris', 48.9, 2.35, 0.0002, 1], ['New York', 40.7, -74, 0.00018, 1], ['Moskva', 55.75, 37.6, 0.0002, 1],
    ['Tokyo', 35.7, 139.7, 0.00016, 1], ['Thượng Hải', 31.2, 121.5, 0.00012, 1], ['Bắc Kinh', 39.9, 116.4, 0.00018, 1], ['Delhi', 28.6, 77.2, 0.00015, 1],
    ['Mumbai', 19, 72.8, 0.00012, 1], ['Cairo', 30, 31.2, 0.0001, 1], ['Lagos', 6.5, 3.4, 0.00006, 1], ['Kinshasa', -4.3, 15.3, 0.00005, 1],
    ['TP. Hồ Chí Minh', 10.8, 106.7, 0.00008, 1], ['Jakarta', -6.2, 106.8, 0.00008, 1], ['Seoul', 37.6, 127, 0.00007, 1], ['Istanbul', 41, 29, 0.0002, 1],
    ['Mexico City', 19.4, -99.1, 0.0001, 1], ['Los Angeles', 34, -118.2, 0.00008, 1], ['São Paulo', -23.5, -46.6, 0.00008, 1],
    ['Buenos Aires', -34.6, -58.4, 0.0001, 1], ['Sydney', -33.9, 151.2, 0.0001, 1], ['Johannesburg', -26.2, 28, 0.00008, 1],
  ];
  P.updateCities = function () {
    if (!this.cities) this.cities = [];
    const ma = this.future ? 0 : this.ma, have = new Set(this.cities.map((c) => c.name));
    for (const [name, la, lo, born, modern] of CITIES) {
      if (ma > born || have.has(name)) continue;
      let i = this.idx(((lo + 180) / 360) * this.W - 0.5, ((90 - la) / 180) * this.H - 0.5);
      if (this.isOcean[i]) { for (let q = 0; q < 8; q++) { const j = this.nbr8(i, q); if (j >= 0 && !this.isOcean[j]) { i = j; break; } } }
      if (this.isOcean[i]) continue;
      let near = 0;                                     // thành phố chỉ mọc nơi đã có người (Thần có thể xóa sổ loài người!)
      this.forDisk(i % this.W, (i / this.W) | 0, 10, (j) => { near = Math.max(near, this.human[j]); });
      if (near < 0.01) continue;
      this.cities.push({ name, i, modern: !!modern, ma: born });
      this.log(modern ? `🏙️ ${name} trở thành đô thị lớn.` : `🏛️ Thành phố ${name} ra đời.`, 'event');
    }
    for (const c of this.cities) {                      // thành phố giữ dân cư dày đặc quanh nó
      if (this.isOcean[c.i]) continue;
      this.forDisk(c.i % this.W, (c.i / this.W) | 0, c.modern ? 2 : 1.2, (j, k) => {
        if (!this.isOcean[j] && this.human[j] > 0.02) this.human[j] = Math.max(this.human[j], 0.6 + 0.35 * k);
      });
    }
  };

  // Con người: xuất hiện ở Đông Phi, lan ra theo đúng các mốc di cư; nông nghiệp → đô thị
  const HUMAN_GATE = { a: 0.016, s: 0.014, f: 0.3, r: 0.07, e: 0.045, i: 0.04, c: 0.06, d: 0.065, u: 0.06, n: -1 };
  P.stepHumans = function () {
    const ma = this.ma, fut = this.future;
    if (!fut && ma > 0.3) return;
    const { W, C, human, isOcean, temp, moist, ice, grass, tree, herb } = this, BL = global.GodSim.BLOCKS;
    const gate = (i) => { const s = this.src[i]; if (s < 0) return false; const g = HUMAN_GATE[BL[this.cBlock[s]].id]; return fut ? g >= 0 : ma <= g; };
    if (!this.humanStarted) {
      const [la, lo] = this.whereNow(5, 37, 'f'), x = ((lo + 180) / 360) * W, y = ((90 - la) / 180) * this.H;
      this.forDisk(x, y, 3, (j) => { if (!isOcean[j]) human[j] = 0.3; });
      this.humanStarted = true;
    }
    const agri = fut || ma < 0.011, industry = fut || ma < 0.00025, sail = fut || ma < 0.065;
    // Tới mốc di cư thật mà vùng đất còn trống → một nhóm người đặt chân tới (qua cầu đất Bering, bằng thuyền tới Úc…)
    if (this.tick % 5 === 0) {
      const pop = new Float32Array(BL.length);
      for (let i = 0; i < C; i++) if (human[i] > 0.02 && this.src[i] >= 0) pop[this.cBlock[this.src[i]]] += 1;
      BL.forEach((b, k) => {
        const g = HUMAN_GATE[b.id];
        if (g < 0 || (!fut && ma > g) || pop[k] > 3) return;
        for (let n = 0; n < 4; n++) {
          const i = this.randomCell((j) => !isOcean[j] && this.src[j] >= 0 && this.cBlock[this.src[j]] === k && temp[j] > 2 && ice[j] < 0.3 && moist[j] > 0.2, 3000);
          if (i >= 0) this.forDisk(i % W, (i / W) | 0, 1.5, (j) => { if (!isOcean[j]) human[j] = Math.max(human[j], 0.1); });
        }
      });
    }
    // lan sang ô lân cận (đi bộ), và vượt biển ngắn bằng thuyền
    for (let pass = 0; pass < 3; pass++) {
      const front = [];
      for (let i = 0; i < C; i++) if (human[i] > 0.05) front.push(i);
      for (const i of front) {
        for (let q = 0; q < 4; q++) {
          const j = this.nb[i * 4 + q];
          if (j >= 0 && !isOcean[j] && human[j] < 0.02 && ice[j] < 0.5 && temp[j] > -12 && gate(j)) human[j] = 0.04;
        }
        if (sail && this.rand() < 0.15) {
          const ang = this.rand() * Math.PI * 2, d = 2 + this.rand() * 4;
          const j = this.idx((i % W) + Math.cos(ang) * d, ((i / W) | 0) + Math.sin(ang) * d);
          if (!isOcean[j] && human[j] < 0.02 && ice[j] < 0.5 && gate(j)) human[j] = 0.04;
        }
      }
    }
    let total = 0;
    for (let i = 0; i < C; i++) {
      const hu = human[i]; if (hu <= 0) continue;
      if (isOcean[i]) { human[i] = 0; continue; }
      // sức chứa: khí hậu ôn hòa, đủ nước, đất phì; rừng rậm & sa mạc thưa người
      const t = temp[i], jungle = (t > 22 ? 0.85 : 0.3) * smooth(0.5, 0.9, tree[i]);
      const suit = gauss(t, 17, 10) * smooth(0.12, 0.45, moist[i]) * (1 - ice[i]) * Math.min(1, 0.5 + grass[i] + 0.3 * tree[i]) * (0.4 + 0.6 * this.fert[i]) * (1 - jungle);
      const K = Math.min(1, 1.3 * Math.pow(suit, 1.4)) * (agri ? (industry ? 1 : 0.8) : 0.15);
      human[i] = clamp(hu + 0.12 * hu * (1 - hu / Math.max(0.01, K)), 0, 1);
      if (ma < 0.05 || fut) herb[i] *= 1 - 0.006 * hu;                 // săn bắt: thú lớn tuyệt chủng
      if (agri && hu > 0.3) { tree[i] *= 1 - 0.004 * hu * (tree[i] < 0.7 ? 1 : 0.3); }   // phá rừng làm ruộng
      total += human[i] * this.wgt[i];
    }
    this.humanCO2 = industry && fut ? 0.004 * total / this.wsum * 50 : 0;
    if (this.tick % 3 === 0 && (fut || ma < 0.011)) this.updateCities();
  };

  // ---------------------------------------------------------------- truy vấn cho giao diện
  P.timeInfo = function () {
    const ma = this.ma;
    const eon = EONS.find((e) => ma <= e.from && ma >= e.to) || EONS[3];
    const per = ma <= 538.8 ? PERIODS.find((p) => ma <= p.from && ma >= p.to) : null;
    const sc = SUPERCONTINENTS.find(([a, b]) => ma <= a && ma >= b);
    return { ma, eon, period: per, supercontinent: sc ? sc[2] : null, progress: this.future ? 1 : Math.min(1, this.tick / TOTAL_TICKS) };
  };
  P.fauna = function () { return faunaAt(this.future ? 0 : this.ma); };
  P.flora = function () { return floraAt(this.future ? 0 : this.ma); };
  P.era = function () {
    const t = this.timeInfo();
    const name = t.period ? t.period.name : t.eon.name;
    const sub = [t.period ? t.period.era : t.eon.name !== name ? t.eon.name : '', t.supercontinent ? `Siêu lục địa ${t.supercontinent}` : '']
      .filter(Boolean).join(' · ');
    return { name: this.future ? 'Tương lai' : name, sub: this.future ? 'Các lục địa tiếp tục trôi…' : sub };
  };

  global.GodSim.HISTORY = { SCHEDULE, TOTAL_TICKS, EVENTS, EONS, PERIODS, SUPERCONTINENTS, tickToMa, maToTick, climateAt };
})(typeof window !== 'undefined' ? window : globalThis);
