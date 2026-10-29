# 🌍 Đảo Sáng Thế — God view

Trò chơi mô phỏng **4,54 tỷ năm lịch sử Trái Đất** trên một tấm bản đồ thế giới lơ lửng giữa vũ trụ, từ biển dung nham đến hôm nay.

- Nếu bạn không can thiệp, lịch sử diễn ra **đúng như thật**: lục địa trôi, siêu lục địa hợp rồi tan, băng hà đến rồi đi, khủng long xuất hiện rồi tuyệt chủng, loài người lan khắp thế giới. Mô phỏng kết thúc ở **hôm nay** với bản đồ đúng như hiện tại.
- Bạn là **Thần**: có thể thêm sự kiện vào bất kỳ lúc nào, và dòng lịch sử sẽ rẽ nhánh theo trạng thái hành tinh lúc đó.

## Chạy game

Mở `index.html` bằng Chrome, Edge hoặc Safari. Cần Internet để tải Three.js.
Nếu trình duyệt chặn file cục bộ, hãy chạy một server tĩnh:

```bash
python3 -m http.server 8080   # rồi mở http://localhost:8080
```

Thêm `?tua=N` vào URL để tua nhanh N tick khi mở trang. Toàn bộ lịch sử dài 4.160 tick:

| `?tua=` | Thời điểm |
|---|---|
| 2300 | Pangaea, 252 triệu năm trước |
| 3090 | Thời khủng long |
| 4160 | Hôm nay |

| Thao tác | |
|---|---|
| Kéo chuột trái | Di chuyển bản đồ |
| Cuộn chuột, nút ＋ −, phím `+` `-`, nhấp đúp | Phóng to / thu nhỏ (nhấp đúp: zoom vào đúng điểm đó). Ở góc 🏰, zoom sát thì nhìn ngang kiểu Clash of Clans, kéo ra xa thì camera tự ngẩng thành bản đồ |
| ⤢, phím `0` | Toàn cảnh |
| ☑ Thẻ giải thích, phím `G`, nút 🙈 Ẩn thẻ | Bật/tắt việc tự hiện thẻ khi có sự kiện lịch sử. Khi tắt, bấm vào sự kiện trong Biên niên sử để đọc lại |
| ☑ Tên thành phố | Bật/tắt nhãn các thành phố lịch sử (Jericho, Uruk, Roma, Thăng Long…) và đô thị hiện đại |
| `Q`, `E` hoặc kéo chuột phải | Xoay góc nhìn (ở góc 🏰) |
| 🏰 / 👁️ | Góc nhìn chiến thuật kiểu Clash of Clans / nhìn thẳng từ trên xuống toàn bản đồ |
| 🧩 Mảng, phím `P` | Hiện các mảng kiến tạo: đỏ = hội tụ, vàng = tách giãn, trắng = trượt ngang |
| Chọn quyền năng → click lên bản đồ | Thi triển sự kiện (bán kính và cường độ chỉnh bằng thanh trượt) |
| `Space`, `1–4`, `H`, `Esc` | Tạm dừng, đổi tốc độ, ẩn 2 bảng bên, bỏ chọn |

Thanh niên đại ở dưới cùng cho biết bạn đang ở đâu trong lịch sử. Mỗi sự kiện lớn hiện một thẻ giải thích, và mặc định game tự dừng để bạn đọc. Khi tới hôm nay, bấm ▶ để đi tiếp vào tương lai.

## Cấu trúc

```
index.html         Đồ họa 3D (Three.js), giao diện, tương tác
js/earthdata.js    Đất liền hiện tại 256×128 (sinh từ Natural Earth 1:50m) + khối lục địa
js/world.js        Lõi mô phỏng: khí hậu, nước, băng, sinh thái, sự kiện
js/tectonics.js    Kiến tạo mảng: tái dựng cổ địa lý, núi, đáy biển, ranh giới mảng
js/history.js      Đạo diễn lịch sử: lịch thời gian, khí hậu cổ, sự kiện, tiến hóa, con người
js/events.js       15 quyền năng của Thần (cũng là sự kiện tự nhiên)
```

## 1. Bản đồ & kiến tạo mảng (`tectonics.js`)

- **Bản đồ** dùng phép chiếu kinh–vĩ độ, mỗi ô khoảng 1,4°, và nối vòng theo chiều Đông–Tây. Đường bờ biển hiện tại lấy từ Natural Earth và được chia thành 10 khối theo ranh giới mảng thật: Bắc Mỹ, Nam Mỹ, châu Phi, Ả Rập, châu Âu, Siberia, Đông Á, Ấn Độ, Úc, Nam Cực.
- **Tái dựng cổ địa lý** theo cách của GPlates/PALEOMAP:
  - Mỗi khối có các mốc gồm vị trí điểm tham chiếu và góc xoay ở 0, 20, 40, 66, 100, 150, 200, 250, 300… 4.600 triệu năm trước.
  - Giữa hai mốc, phép quay trên mặt cầu được nội suy.
  - Với mỗi ô bản đồ, ta quay ngược về hiện tại để biết ô đó đang chứa mảnh vỏ nào. Đất, cây, thú trôi theo mảnh vỏ của chúng.
  - Ở mốc 0, mọi khối về đúng vị trí: đường bờ biển cuối cùng khớp 100% bản đồ thật.
- **Siêu lục địa**: Vaalbara → Kenorland → Columbia → Rodinia → Pannotia → Pangaea → các lục địa ngày nay.
- **Lục địa lớn dần** từ các nhân cổ (craton) như Kaapvaal, Pilbara, Khiên Canada, Siberia…
- **Dãy núi có tuổi**:
  - Appalachia, Ural, Caledonia, Variscan cao nhất khi Pangaea hợp nhất, nay đã mòn thấp.
  - Andes, Rocky, Alps và Himalaya–Tây Tạng mọc lên đúng thời điểm (ví dụ Himalaya từ 50 triệu năm trước, khi Ấn Độ đâm vào châu Á).
- **Đáy biển** gồm thềm lục địa, sườn dốc, biển thẳm. Sống núi giữa đại dương xuất hiện nơi hai mảng tách xa; rãnh sâu xuất hiện nơi hút chìm (vành đai lửa Thái Bình Dương). Ranh giới mảng được phân loại theo vận tốc tương đối. Núi lửa và động đất tự nhiên chủ yếu xảy ra ở các ranh giới này.

## 2. Lịch sử thật (`history.js`)

- **Lịch thời gian**: Liên đại Hỏa Thành trôi rất nhanh, còn các thời kỳ gần đây được giãn ra để kịp quan sát.

  | Giai đoạn | Thời lượng |
  |---|---|
  | Đại Cổ Sinh | 800 tick |
  | Đại Trung Sinh | 800 tick |
  | Kỷ Đệ Tứ | khoảng 600 tick |
  | Thời công nghiệp | 30 tick |

- **Khí hậu nền** lấy từ dữ liệu cổ khí hậu (giản lược từ Scotese, GEOCARBSULF, Haq…): nhiệt độ toàn cầu, CO₂, O₂, mực nước biển. Mô phỏng có cả Trái Đất quả cầu tuyết, băng hà Karoo, hiệu ứng nhà kính Permi–Trias, PETM, chu kỳ băng hà Milankovitch, cực đại băng hà 26 nghìn năm trước, và nóng lên thời công nghiệp.
- **Tác động của Thần cộng thêm** lên khí hậu nền rồi tắt dần, nên lịch sử có thể rẽ nhánh nhưng không vỡ vụn.
- **Mốc tiến hóa**: mỗi nhóm sinh vật chỉ xuất hiện sau mốc thật của nó.

  | Nhóm sinh vật | Mốc xuất hiện (năm trước) |
  |---|---|
  | Sự sống | 3,8 tỷ |
  | Quang hợp | 2,7 tỷ |
  | Thực vật lên cạn | 470 triệu |
  | Rừng | 385 triệu |
  | Động vật bốn chân | 375 triệu |
  | Con người | 300 nghìn |

  Tên và hình dáng động vật đổi theo thời kỳ: lưỡng cư → bò sát & thú răng chó → khủng long → thú có vú.
- **Khoảng 45 sự kiện lịch sử có giải thích**. Một số kèm tác động thật lên mô phỏng:
  - Va chạm Theia.
  - Bẫy Siberia (đại tuyệt chủng Permi–Trias).
  - Phun trào CAMP (tuyệt chủng Trias–Jura).
  - Thiên thạch Chicxulub cùng bẫy Deccan.
  - 5 cuộc đại tuyệt chủng lớn.
- **Con người**:
  - Xuất hiện ở Đông Phi 300 nghìn năm trước.
  - Lan ra theo đúng các mốc di cư: rời châu Phi 70 nghìn năm trước, tới Úc 65–50 nghìn năm trước, châu Âu 45 nghìn năm trước, châu Mỹ 16 nghìn năm trước.
  - Có nông nghiệp từ 11,7 nghìn năm trước và đô thị từ 5,5 nghìn năm trước.
  - Con người phá rừng làm ruộng và săn thú lớn đến tuyệt chủng.
  - 37 thành phố có thật xuất hiện đúng thời điểm, nhưng chỉ khi vùng đó có người:
    - Thành phố cổ: Jericho, Çatalhöyük, Uruk, Memphis, Mohenjo-daro, Babylon, Roma, Cổ Loa, Thăng Long…
    - Đô thị hiện đại: Tokyo, New York, Thượng Hải, TP. Hồ Chí Minh…
  - Dấu vết trên bản đồ: lán trại, làng mạc, đồng ruộng kẻ ô, cao ốc và ánh đèn đô thị.

## 3. Khí hậu & sinh thái (`world.js`)

- **Nhiệt độ** = toàn cầu + vĩ độ (khuếch đại ở hai cực) − độ cao + ấm thêm nhờ hải lưu ở bờ Tây lục địa vùng gió Tây (Gulf Stream).
- **Hoàn lưu khí quyển**:
  - Gió mậu dịch, gió Tây, gió Đông cực.
  - Vành đai khí chìm cận chí tuyến tạo sa mạc Sahara, Ả Rập, Úc.
  - Mưa đối lưu xích đạo (ITCZ) nuôi rừng Amazon, Congo.
  - Gió mùa ở nơi có cao nguyên lớn phía cực (Ấn Độ, Đông Nam Á nhờ Tây Tạng).
  - Mưa địa hình và bóng mưa sau núi.
- **Băng** chỉ tích tụ ở nơi mùa hè dưới 0°C và tăng theo lượng tuyết rơi. Băng trên đất liền làm nước biển hạ (khoảng −120 m lúc cực đại băng hà, lộ thềm lục địa).
- **Sinh thái**:
  - Mức phù hợp sống là tích các yếu tố giới hạn (định luật Liebig). Cây gỗ cần mùa hè trên khoảng 8°C, tạo ranh giới taiga ↔ đài nguyên.
  - Thực vật tăng theo logistic; động vật theo mô hình Lotka–Volterra.
  - Lửa lan theo gió; dịch bệnh lây theo mật độ.
  - Hạt giống phát tán theo gió; sinh vật biển trôi theo hải lưu.

## 4. Sự kiện của Thần (`events.js`)

- Sự kiện **không có kết quả viết sẵn**. Mỗi sự kiện chỉ là một nhiễu cục bộ lên các trường trạng thái; các quy luật ở trên quyết định hệ quả. Ví dụ:
  - Gieo hạt trước khi có tầng ozone thì mầm bị tia UV giết.
  - Mưa khi hành tinh còn trên 100°C thì nước bốc hơi trước khi chạm đất.
  - Thiên thạch rơi xuống biển gây sóng thần.
- **Vòng đời sự kiện**:

  ```
  start → tick (bão di chuyển, núi lửa phun…) → end → settle → 📋 Kết quả (đo vùng trước & sau)
  ```

  Sự kiện có thể gọi `w.request()` để sinh chuỗi hệ quả, ví dụ động đất dưới biển → sóng thần.
- **Thêm sự kiện mới**: khai báo trong `js/events.js`, rồi thêm khóa vào `GOD_POWER_ORDER`.

## Nguồn tham khảo

- Đường bờ biển: [Natural Earth](https://www.naturalearthdata.com/), qua gói [world-atlas](https://github.com/topojson/world-atlas).
- Cổ địa lý & siêu lục địa:
  - [Supercontinent](https://en.wikipedia.org/wiki/Supercontinent)
  - [Supercontinent cycle](https://en.wikipedia.org/wiki/Supercontinent_cycle)
- Ranh giới mảng:
  - [Types of Plate Boundaries (LibreTexts)](https://geo.libretexts.org/Bookshelves/Oceanography/Oceanography_(Hill)/02%3A_Earth%3A_Formation_and_Structure/2.5%3A_Types_of_Plate_Boundaries)
  - [Seafloor spreading (Britannica)](https://www.britannica.com/science/plate-tectonics/Seafloor-spreading)
- Vị trí lục địa trước Pangaea (trên 335 triệu năm trước) chỉ là gần đúng, vì chính giới khoa học vẫn còn tranh luận.
