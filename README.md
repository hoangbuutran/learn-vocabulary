# 📚 Ứng dụng học từ vựng tiếng Anh (VocabLearn)

Ứng dụng web học từ vựng tiếng Anh chạy hoàn toàn trên trình duyệt: flashcard, trắc nghiệm, nối từ, luyện nghe/nói/viết, lặp lại ngắt quãng (spaced repetition) và tra cứu phát âm IPA. Không cần backend, hoạt động offline, cài được lên điện thoại như một app (PWA).

> Tài liệu này mô tả các chức năng **đang có** để bạn review và đề xuất bổ sung.

---

## 🎯 Tổng quan

- **Không cần server, không cần đăng nhập** — toàn bộ chạy client-side, dữ liệu lưu trong trình duyệt (LocalStorage).
- **Hoạt động offline** — sau lần mở đầu tiên, app và âm thanh được cache lại nhờ Service Worker.
- **Hai bộ từ vựng dựng sẵn** (~4.300 từ), kèm phiên âm IPA và file âm thanh phát âm.
- **Giao diện tiếng Việt**, responsive cho cả máy tính lẫn điện thoại, có chế độ tối.

---

## 📦 Dữ liệu từ vựng

| Bộ từ | Số lượng | Mô tả |
|-------|----------|-------|
| **A1–A2** | 995 từ | Từ vựng cơ bản, có loại từ + phiên âm IPA |
| **Essential 3000** | 3.393 từ | Từ thông dụng nhất, có loại từ + phiên âm IPA |

- Mỗi từ gồm: từ tiếng Anh, nghĩa tiếng Việt, loại từ (n/v/adj…), phiên âm IPA, ví dụ (nếu có).
- Dữ liệu được trích xuất từ file Word gốc bằng script (xem mục Scripts), lưu dưới dạng JSON tĩnh.
- Người dùng có thể **chọn học bộ nào** trong phần Cài đặt: chỉ A1–A2, chỉ 3000, hoặc tất cả.

---

## ✨ Các chức năng chính

### 🏠 Trang chủ (Dashboard)
- Thống kê: tổng số từ, số từ đã học, đã nhớ, chưa nhớ, phần trăm tiến độ.
- Tiến độ học trong ngày.
- Số từ đến hạn ôn tập hôm nay.
- Thống kê tính theo **bộ từ đang chọn** (giúp thấy đích rõ ràng, ví dụ "đã nhớ 50/995").

### 🃏 Flashcard (học từ mới)
- Học theo **cụm cố định** (mặc định 10 từ/cụm — đổi được trong Cài đặt).
- Cụm được **giữ nguyên** khi rời đi rồi quay lại, tắt/mở app, hay về trang chủ — chỉ đổi khi người dùng chủ động bấm "Học từ mới".
- Lật thẻ để xem nghĩa, ví dụ, phiên âm.
- Mỗi thẻ có các nút:
  - **🔊 Nghe** phát âm (giọng người bản xứ / giọng máy).
  - **🎤 Ghi âm** — kiểm tra phát âm bằng nhận diện giọng nói (tùy chọn, không bắt buộc).
  - **✍️ Viết** — popup tập viết: gõ lại từ cho đúng; gõ sai phải sửa cho đúng; có nút nghe và gợi ý (hiện nửa từ).
- Điều hướng **← Trước / Tiếp theo →**, nút **🔀 Đổi cụm khác** để bỏ qua cụm hiện tại lấy 10 từ mới.
- Nút **"Đã nhớ" / "Chưa nhớ"** đưa từ vào lịch trình lặp lại ngắt quãng.
- Sau khi hết cụm: tùy chọn **Học 10 từ mới**, **Lặp lại 10 từ này**, hoặc **🔗 Ôn bằng Nối từ** (chuyển đúng 10 từ vừa học sang game Nối từ).

### ✍️ Trắc nghiệm (Quiz)
Bốn chế độ:
1. **Chọn nghĩa đúng** — xem từ tiếng Anh, chọn nghĩa tiếng Việt.
2. **Chọn từ đúng** — xem nghĩa tiếng Việt, chọn từ tiếng Anh.
3. **Nghe và chọn từ** — nghe phát âm rồi chọn từ đúng (có nút nghe lại, hiện nghĩa sau khi trả lời).
4. **Nghe và gõ từ** — nghe phát âm rồi gõ lại từ (so khớp không phân biệt hoa/thường).

Mỗi phiên 10 câu, có chấm điểm, phản hồi đúng/sai và tổng kết phần trăm.

### 🔗 Nối từ (Matching game)
- Nối từ tiếng Anh với nghĩa tiếng Việt đúng.
- **Chơi liên tục**: nối đúng cặp nào thì cặp đó biến mất, một từ mới xuất hiện ngay (luôn giữ 5 cặp).
- **Chống học vẹt vị trí**: hai cột xáo trộn độc lập sau mỗi lần nối đúng/sai.
- Theo dõi: số cặp đã nối, chuỗi đúng liên tiếp + kỷ lục, số lần sai.
- **Bảng lịch sử "Đã học"** bên cạnh: liệt kê các cặp đã nối, mỗi cặp có nút 🔊 nghe lại.
- **Chế độ ôn tập**: khi mở từ Flashcard, chơi đúng tập 10 từ vừa học rồi kết thúc.

### 🗣️ Học phát âm (IPA)
- **Bảng ký hiệu IPA** chia nhóm: nguyên âm ngắn / dài / nguyên âm đôi / phụ âm.
- Mỗi ký hiệu có: gợi ý cách đọc bằng tiếng Việt, từ ví dụ, nút nghe **âm thuần** (ghi âm chuyên gia) và nút nghe **từ ví dụ**.
- **Bộ giải mã phiên âm**: dán một phiên âm (ví dụ `/ɪnˈrəʊl/`), app tách từng ký hiệu và giải thích cách đọc, kèm dấu nhấn trọng âm; có nút phát từng âm hoặc phát lần lượt.

### 🔄 Ôn tập (Spaced Repetition)
- Dùng thuật toán **SM-2**: lịch ôn tập tự điều chỉnh theo việc bạn nhớ hay quên.
- "Đã nhớ" → giãn khoảng ôn; "Chưa nhớ" → đặt lại để ôn sớm.
- Màn Ôn tập hiển thị các từ đến hạn, có nghe phát âm và đánh dấu nhớ/chưa nhớ.

### 📥 Nhập / Xuất dữ liệu
- **Nhập** từ vựng từ file **CSV, JSON, TXT** (kéo-thả hoặc chọn file), có kiểm tra hợp lệ và báo lỗi từng dòng.
- **Xuất** toàn bộ dữ liệu (từ vựng + tiến độ + cài đặt) để sao lưu.

### ⚙️ Cài đặt
- Chế độ tối (dark mode).
- Giọng phát âm: Anh-Mỹ / Anh-Anh.
- **Bộ từ vựng**: A1–A2 / 3000 / tất cả.
- Số từ mỗi cụm học (1–50).
- Tự động phát âm.
- **Tải lại dữ liệu gốc** (giữ tiến độ).
- **Xóa toàn bộ dữ liệu** (đưa app về như mới cài).

---

## 🔊 Phát âm — cách hoạt động

Thứ tự ưu tiên khi phát âm một từ:
1. **File âm thanh tải sẵn** trong `assets/audio/` → phát tức thì, dùng offline.
   - Giọng người bản xứ thật (nguồn [Free Dictionary API](https://dictionaryapi.dev/)) cho các từ có sẵn.
   - Các từ/cụm còn lại dùng Google Translate TTS để đảm bảo **phủ 100%**.
2. API online (chỉ khi từ chưa có file).
3. Giọng máy của trình duyệt (SpeechSynthesis) — phương án cuối.

Âm IPA thuần (trang Học phát âm) lấy từ Wikimedia Commons, lưu trong `assets/audio/ipa/`.

## 🎤 Nhận diện giọng nói

- Dùng **Whisper** chạy hoàn toàn trên máy qua [Transformers.js](https://github.com/huggingface/transformers.js) (WebAssembly/WebGPU) — audio không rời khỏi thiết bị.
- Tải mô hình một lần (~40MB, `whisper-tiny.en`), sau đó dùng offline.
- So khớp linh hoạt (fuzzy matching) để chấp nhận sai số nhỏ.
- Lưu ý: đây là tính năng phụ trợ; không bắt buộc để học.

---

## 📱 PWA — cài lên điện thoại

App là một Progressive Web App đầy đủ:
- Có `manifest.webmanifest`, icon, và Service Worker (`sw.js`) cache để chạy offline.
- **Android (Chrome)**: menu ⋮ → "Cài đặt ứng dụng / Thêm vào màn hình chính".
- **iPhone (Safari)**: nút Chia sẻ → "Thêm vào màn hình chính".
- Yêu cầu chạy qua **HTTPS** (hoặc localhost) — không mở file trực tiếp.

---

## 🚀 Cách chạy

Vì dùng ES modules, Service Worker và microphone, app cần chạy qua HTTP(S), **không** mở `index.html` trực tiếp bằng `file://`.

### Cách nhanh nhất — Live Server (VS Code)
1. Cài extension "Live Server".
2. Chuột phải `index.html` → "Open with Live Server".

### Hoặc dùng HTTP server
```bash
# Python
python -m http.server 8000

# Node.js
npx http-server -p 8000
```
Mở `http://localhost:8000`.

---

## 🛠️ Công nghệ

**Frontend (thuần, không framework):**
- Vanilla JavaScript (ES6 modules), HTML5, CSS3 (responsive + dark mode).
- Hash-based routing, kiến trúc MVC, Event Bus, pattern singleton.
- LocalStorage cho dữ liệu; Service Worker + Web App Manifest cho PWA.
- Web Speech API (phát âm), Whisper qua Transformers.js (nhận diện giọng nói).

**Dev tools:**
- Node.js cho các script xử lý dữ liệu/âm thanh.
- (Tùy chọn) Vitest cho test.

---

## 📁 Cấu trúc thư mục

```
├── index.html                  # Entry point + nav + đăng ký service worker
├── manifest.webmanifest        # Khai báo PWA
├── sw.js                       # Service Worker (cache offline)
├── css/
│   ├── themes.css              # Biến màu, font, dark mode
│   ├── main.css                # Style chính
│   ├── flashcard.css           # Style thẻ
│   └── responsive.css          # Responsive + print
├── js/
│   ├── app.js                  # Router & khởi tạo
│   ├── modules/
│   │   ├── storage-manager.js      # LocalStorage, settings, bộ từ, nạp dữ liệu
│   │   ├── memory-system.js        # Tiến độ, chọn từ học, thống kê
│   │   ├── spaced-repetition.js    # Thuật toán SM-2
│   │   ├── quiz-engine.js          # Sinh & chấm trắc nghiệm (4 chế độ)
│   │   ├── speech-module.js        # Phát âm (TTS) + nhận diện (Whisper)
│   │   ├── pronunciation-validator.js  # So khớp phát âm (fuzzy)
│   │   └── data-importer.js        # Nhập CSV/JSON/TXT
│   ├── views/
│   │   ├── dashboard-view.js
│   │   ├── flashcard-view.js
│   │   ├── quiz-view.js
│   │   ├── match-view.js           # Nối từ
│   │   ├── ipa-view.js             # Học phát âm IPA
│   │   ├── review-view.js          # Ôn tập
│   │   ├── import-view.js
│   │   └── settings-view.js
│   └── utils/
│       ├── event-bus.js
│       └── helpers.js
├── data/
│   ├── vocabulary-a1-a2.json
│   └── vocabulary-3000.json
├── assets/
│   ├── icons/                  # Icon PWA
│   └── audio/                  # File phát âm (.mp3) + manifest.json
│       └── ipa/                # Âm IPA thuần (.ogg) + manifest.json
└── scripts/                    # Script xử lý dữ liệu (dev-time)
```

---

## 📝 Scripts (chỉ dùng khi phát triển)

| Script | Công dụng |
|--------|-----------|
| `parse-docx-a1a2.mjs` | Trích xuất bộ A1–A2 từ file Word sang JSON |
| `parse-docx-3000.mjs` | Trích xuất bộ 3000 từ file Word sang JSON |
| `fetch-audio.mjs` | Tải âm thanh giọng người bản xứ (Free Dictionary API) |
| `fetch-audio-tts.mjs` | Lấp các từ còn thiếu âm bằng Google TTS (phủ 100%) |
| `fetch-ipa-sounds.mjs` | Tải âm IPA thuần từ Wikimedia Commons |
| `make-icons.mjs` | Sinh icon PWA |
| `generate-vocabulary.js`, `parse-pdf.mjs` | Script trích xuất từ PDF (phiên bản cũ) |

Ví dụ:
```bash
node scripts/parse-docx-a1a2.mjs
node scripts/fetch-audio.mjs           # tải audio giọng người thật
node scripts/fetch-audio-tts.mjs       # lấp phần còn thiếu
```

---

## 🔍 Khắc phục sự cố

- **Phát âm không kêu / chậm**: mở qua Live Server (không phải `file://`); lần đầu tải audio cần mạng.
- **Nhận diện giọng nói không chạy**: cần Chrome/Edge, cho phép quyền microphone, và lần đầu cần mạng để tải mô hình.
- **Thay đổi không hiển thị sau khi cập nhật**: do Service Worker cache — vào DevTools → Application → Service Workers → Unregister, hoặc Clear site data, rồi tải lại.
- **Mất dữ liệu học**: dùng tính năng Xuất để sao lưu định kỳ.

---

## 💡 Gợi ý hướng phát triển (để review)

Một số ý tưởng có thể bổ sung để học tốt hơn:
- Câu ví dụ thực tế cho mỗi từ (hiện đa số chưa có).
- Thống kê/biểu đồ tiến độ theo thời gian, streak hằng ngày.
- Nhắc nhở ôn tập (notification).
- Đồng bộ dữ liệu giữa thiết bị (cần backend — hiện chưa có).
- Phân loại từ theo chủ đề, mức độ khó.
- Chấm điểm phát âm chi tiết theo từng âm tiết.

---

## 📄 License

MIT License.

## 🙏 Credits

- Bộ từ A1–A2 và Essential 3000 (nguồn tổng hợp).
- Phát âm giọng người: [Free Dictionary API](https://dictionaryapi.dev/); bổ sung bằng Google Translate TTS.
- Âm IPA: [Wikimedia Commons](https://commons.wikimedia.org/) (CC).
- Nhận diện giọng nói: [Whisper](https://github.com/openai/whisper) qua [Transformers.js](https://github.com/huggingface/transformers.js).
- Thuật toán lặp lại ngắt quãng: SM-2.
