# Vocab Backend

Backend nhỏ (Node + Express) cho ứng dụng học từ vựng. Tách riêng khỏi frontend tĩnh — frontend vẫn chạy được độc lập, backend chỉ bổ sung các tính năng cần server.

## Chức năng

| Endpoint | Mô tả |
|----------|-------|
| `GET /api/health` | Kiểm tra server sống |
| `GET /api/transcript?url=<link YouTube>&lang=en` | Lấy phụ đề video (kèm timestamp) — dùng cho Shadowing. Giải quyết giới hạn CORS của trình duyệt. |
| `POST /api/pronunciation/compare` | So sánh câu đã đọc với câu gốc, trả điểm + đánh dấu từng từ đúng/sai |
| `GET /api/library` | Danh sách video shadowing đã lưu (thư viện chung) |
| `GET /api/library/:id` | Lấy 1 video kèm toàn bộ lời thoại |
| `POST /api/library` | Thêm video vào thư viện (tự lấy phụ đề nếu chưa có). Body: `{ url, title?, level?, lines? }` |
| `DELETE /api/library/:id` | Xóa video khỏi thư viện |

Thư viện được lưu tại `server/data/shadowing-library.json` — có thể commit vào git để chia sẻ danh sách video cho mọi người.

## Cài đặt & chạy

```bash
cd server
npm install
npm start          # chạy tại http://localhost:3001
# hoặc: npm run dev   (tự reload khi sửa code)
```

## Biến môi trường (tùy chọn)

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `PORT` | `3001` | Cổng server |
| `CORS_ORIGINS` | `*` | Danh sách origin frontend được phép, phân tách bằng dấu phẩy. Ví dụ: `http://localhost:5500,https://yourdomain.com` |

## Ví dụ gọi thử

```bash
# Health
curl http://localhost:3001/api/health

# Transcript
curl "http://localhost:3001/api/transcript?url=https://www.youtube.com/watch?v=VIDEO_ID&lang=en"

# So sánh phát âm
curl -X POST http://localhost:3001/api/pronunciation/compare \
  -H "Content-Type: application/json" \
  -d "{\"target\":\"I have a better routine\",\"spoken\":\"i have a better routine\"}"
```

## Cách frontend dùng

Trong `js/config.js` của frontend đặt `API_BASE` trỏ tới server này (mặc định `http://localhost:3001`). Trang Shadowing sẽ gọi `/api/transcript` để tự lấy phụ đề thay vì phải dán tay.

## Ghi chú

- Nhận diện giọng nói (speech-to-text) vẫn chạy **trên máy người dùng** bằng Whisper (Transformers.js) để không phải tải audio lên server. Backend chỉ **chấm điểm** kết quả văn bản — nhẹ và riêng tư.
- `youtube-transcript` lấy phụ đề công khai của video. Video không bật phụ đề sẽ không lấy được (sau này có thể bổ sung Whisper phía server để tự tạo).
