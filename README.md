# 📚 English Vocabulary Learning App

Ứng dụng học từ vựng tiếng Anh với flashcard, trắc nghiệm và hệ thống lặp lại ngắt quãng (spaced repetition).

## ✨ Tính năng

- **📝 Flashcard**: Học từ vựng với thẻ ghi nhớ tương tác
- **✍️ Trắc nghiệm**: Kiểm tra kiến thức với các bài quiz đa dạng
- **🔄 Ôn tập thông minh**: Hệ thống spaced repetition tự động
- **🔊 Phát âm**: Giọng người bản xứ thật (Free Dictionary API), tự động dùng giọng máy khi không có
- **📊 Theo dõi tiến độ**: Dashboard hiển thị thống kê học tập
- **📥 Import/Export**: Nhập và xuất dữ liệu từ vựng
- **🎨 Giao diện thân thiện**: Responsive design, hỗ trợ mobile
- **💾 Lưu trữ offline**: Dữ liệu được lưu trong Local Storage
- **📱 Cài như app (PWA)**: Thêm vào màn hình chính điện thoại, chạy offline

## 📦 Dữ liệu từ vựng có sẵn

- **Essential 3000**: 3,338 từ vựng cơ bản tiếng Anh
- **A1-A2 Level**: 998 từ vựng trình độ sơ cấp với phiên âm IPA

## 🚀 Cách chạy ứng dụng

### Phương pháp 1: Chạy trực tiếp (Đơn giản nhất)

1. **Mở file HTML**:
   ```bash
   # Mở index.html bằng trình duyệt
   # Hoặc double-click vào file index.html
   ```

2. **Sử dụng Live Server** (Khuyến nghị):
   - Cài đặt Live Server extension trong VS Code
   - Click phải vào `index.html` → "Open with Live Server"
   - Ứng dụng sẽ mở tại `http://localhost:5500`

### Phương pháp 2: Sử dụng HTTP Server

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx http-server -p 8000

# Truy cập: http://localhost:8000
```

## 🛠️ Development

### Cài đặt dependencies (chỉ cho testing)

```bash
npm install
```

### Chạy tests

```bash
# Chạy test một lần
npm test

# Chạy test ở chế độ watch
npm run test:watch
```

### Cấu trúc thư mục

```
├── index.html              # Entry point
├── css/                    # Styles
│   ├── main.css           # CSS chính
│   ├── themes.css         # Theme và variables
│   ├── flashcard.css      # Styles cho flashcard
│   └── responsive.css     # Mobile responsive
├── js/                     # JavaScript modules
│   ├── app.js             # Router và entry point
│   ├── modules/           # Core modules
│   ├── views/             # UI views
│   └── utils/             # Utilities
├── data/                   # Vocabulary data
│   ├── vocabulary-3000.json
│   └── vocabulary-a1-a2.json
├── scripts/               # Build scripts
└── tests/                 # Test suites
```

## 📋 Hướng dẫn sử dụng

### 1. Trang chủ (Dashboard)
- Xem thống kê học tập
- Theo dõi tiến độ hàng ngày
- Truy cập nhanh các tính năng

### 2. Flashcard
- Học từ vựng với thẻ ghi nhớ
- Chế độ tự động lật thẻ
- Đánh dấu mức độ nhớ từ (Dễ/Trung bình/Khó)

### 3. Trắc nghiệm
- Nhiều dạng câu hỏi đa dạng
- Kết quả chi tiết sau mỗi bài test
- Lưu lịch sử điểm số

### 4. Ôn tập
- Hệ thống spaced repetition thông minh
- Ưu tiên từ cần ôn tập
- Tùy chỉnh số lượng từ mỗi session

### 5. Import/Export
- Import từ file JSON/CSV
- Export dữ liệu học tập
- Backup và khôi phục tiến độ

### 6. Cài đặt
- Tùy chỉnh giao diện
- Cài đặt âm thanh
- Quản lý dữ liệu

## 🔧 Tính năng kỹ thuật

### Kiến trúc
- **Vanilla JavaScript ES6+**: Không sử dụng framework
- **Module System**: ES6 modules với dynamic imports
- **Event-Driven**: Event Bus pattern cho communication
- **MVC Architecture**: Tách biệt logic và presentation

### Lưu trữ dữ liệu
- **Local Storage**: Lưu tiến độ học tập
- **JSON Data**: Vocabulary được lưu dưới dạng JSON
- **Offline First**: Hoạt động không cần internet (mô hình nhận diện chỉ cần mạng lần tải đầu)

### Performance
- **Lazy Loading**: Views được load khi cần
- **Memory Management**: Proper cleanup và garbage collection
- **Responsive Design**: Tối ưu cho mọi thiết bị

### Phát âm (Text-to-Speech)
- **Giọng người bản xứ thật**: Audio do người bản xứ thu, nguồn [Free Dictionary API](https://dictionaryapi.dev/) (miễn phí, không cần API key)
- **Chạy offline**: Tải sẵn audio về `assets/audio/` bằng `scripts/fetch-audio.mjs`, app phát từ file local không cần mạng
- **Thứ tự ưu tiên**: file local (offline) → API online → giọng máy của trình duyệt
- **Hỗ trợ giọng Anh-Mỹ & Anh-Anh**: Tự chọn audio `-us`/`-uk` theo cài đặt
- **Cache thông minh**: Ghi nhớ URL/file audio để không tải lại

### Nhận diện giọng nói (Whisper on-device)
- **Whisper qua Transformers.js**: Chạy mô hình AI ngay trong trình duyệt (WebAssembly/WebGPU), audio không rời khỏi máy
- **Chính xác cao với từ đơn**: Tốt hơn hẳn Web Speech API cho việc luyện phát âm từng từ
- **Hoạt động offline**: Sau khi tải mô hình lần đầu (~40MB, model `whisper-tiny.en`) thì dùng được không cần mạng
- **Tự dừng khi im lặng**: Phát hiện giọng nói (VAD), tự kết thúc khi bạn đọc xong
- **Fuzzy matching**: So khớp độ tương đồng cho mọi từ, chấp nhận sai số nhỏ khi phát âm
- **Riêng tư & miễn phí**: Không cần backend, không gửi dữ liệu lên server bên thứ ba

## 📚 API Reference

### Storage Manager
```javascript
// Lưu tiến độ học tập
storageManager.saveProgress(wordId, difficulty, timestamp);

// Lấy thống kê
const stats = storageManager.getStats();
```

### Event Bus
```javascript
// Đăng ký event
eventBus.on('word-learned', (data) => {
  console.log('Học xong từ:', data.word);
});

// Phát event
eventBus.emit('word-learned', { word: 'hello', difficulty: 'easy' });
```

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Tạo Pull Request

## 📝 Script tiện ích

### Tạo dữ liệu từ PDF
```bash
node scripts/parse-pdf.mjs
```
Script này sẽ parse các file PDF trong thư mục gốc và tạo file JSON trong `data/`.

### Tạo vocabulary set tùy chỉnh
```bash
node scripts/generate-vocabulary.js
```

### Tải audio phát âm người thật về máy (offline)
```bash
node scripts/fetch-audio.mjs            # giọng Anh-Mỹ (mặc định)
node scripts/fetch-audio.mjs --accent uk # giọng Anh-Anh
```
Script tải audio người bản xứ (Free Dictionary API) cho toàn bộ từ vựng, lưu vào `assets/audio/` kèm `manifest.json`. Nhờ vậy app phát âm được **offline**, không phụ thuộc mạng.
- **Resumable**: dừng giữa chừng (Ctrl+C) rồi chạy lại sẽ tiếp tục từ chỗ dở.
- Mất khoảng 25-30 phút cho toàn bộ (~4000 từ) do giới hạn tốc độ API.
- Từ nào không có audio người thật sẽ được đánh dấu `null` trong manifest; lúc chạy app sẽ tự fallback sang giọng máy.

## 🔍 Troubleshooting

### Lỗi CORS khi mở file HTML trực tiếp
**Giải pháp**: Sử dụng HTTP server hoặc Live Server thay vì mở file trực tiếp.

### Nhận diện giọng nói không hoạt động
**Các lỗi thường gặp và giải pháp:**

#### Lần đầu bấm micro chờ hơi lâu
- **Nguyên nhân**: App đang tải mô hình Whisper (~40MB) từ CDN về máy
- **Giải pháp**: Chờ tải xong một lần. Các lần sau trình duyệt đã cache nên rất nhanh và dùng được cả khi offline

#### "Không tải được mô hình nhận diện"
- **Nguyên nhân**: Mất mạng khi đang tải mô hình lần đầu
- **Giải pháp**: Kiểm tra internet rồi bấm micro thử lại

#### "Quyền micro bị chặn"
- **Nguyên nhân**: Trình duyệt chưa được cấp quyền microphone
- **Giải pháp**: Click vào icon 🔒 trên thanh địa chỉ → cho phép Microphone

#### "Không tìm thấy micro"
- **Nguyên nhân**: Chưa cắm/bật microphone
- **Giải pháp**: Kiểm tra thiết bị thu âm

#### "Cần chạy trên https hoặc localhost"
- **Nguyên nhân**: Mở `index.html` trực tiếp bằng `file://`
- **Giải pháp**: Mở web bằng Live Server hoặc HTTP server

#### "Không nghe được gì"
- **Giải pháp**: Đọc to, rõ ngay sau khi bấm micro; micro gần miệng (5-10cm); môi trường yên tĩnh

### Không có âm thanh phát âm
**Giải pháp**: 
- Phát âm ưu tiên giọng người thật từ Free Dictionary API (cần internet). Một số từ hiếm có thể không có audio người thật → app tự dùng giọng máy.
- Nếu cả hai đều im, kiểm tra trình duyệt có hỗ trợ Web Speech API (SpeechSynthesis) và máy đã cài giọng tiếng Anh chưa.

### Dữ liệu bị mất
**Giải pháp**: Sử dụng tính năng Export để backup dữ liệu thường xuyên.

## 📄 License

MIT License - Xem [LICENSE](LICENSE) để biết thêm chi tiết.

## 🙏 Credits

- Vocabulary data từ Essential 3000 và A1-A2 collections
- Icons từ Unicode Emoji
- Spaced Repetition algorithm dựa trên nghiên cứu của Hermann Ebbinghaus
- Nhận diện giọng nói bằng [Transformers.js](https://github.com/huggingface/transformers.js) (HuggingFace) chạy mô hình [Whisper](https://github.com/openai/whisper) của OpenAI ngay trên trình duyệt

---

**Happy Learning! 📖✨**