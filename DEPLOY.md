# Hướng dẫn Deploy VocabLearn

## Bước 1: Build production

```bash
npm install          # cài esbuild (lần đầu)
npm run build        # gộp + minify JS → thư mục dist/
```

Thư mục `dist/` chứa bản production (code minified, khó đọc/copy). Deploy nội dung thư mục này.

## Bước 2: Deploy Frontend (miễn phí)

### Cách A: Netlify (đề xuất, siêu đơn giản)
1. Đăng ký [netlify.com](https://netlify.com).
2. Kéo thả thư mục `dist/` lên Netlify Drop → được link tạm ngay.
3. Hoặc liên kết GitHub repo:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Thêm tên miền riêng (nếu có) trong Settings → Domain.

### Cách B: Vercel
1. Đăng ký [vercel.com](https://vercel.com).
2. Import GitHub repo.
3. Override settings:
   - Output Directory: `dist`
   - Build Command: `npm run build`
4. Deploy.

### Cách C: GitHub Pages
1. Push code lên GitHub.
2. Chạy `npm run build` rồi push nội dung `dist/` lên nhánh `gh-pages`.
3. Settings → Pages → Source: `gh-pages` branch.

## Bước 3: Deploy Backend

Backend trong thư mục `server/`. Cần một nơi chạy Node.js.

### Cách A: Render.com (miễn phí)
1. Đăng ký [render.com](https://render.com).
2. New → Web Service → liên kết GitHub.
3. Settings:
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: thêm biến `CORS_ORIGINS=https://your-domain.com`
4. Deploy. Được URL dạng `https://your-app.onrender.com`.

### Cách B: Railway.app
1. Đăng ký [railway.app](https://railway.app).
2. New Project → Deploy from GitHub.
3. Chọn thư mục `server/`.
4. Thêm biến `PORT=3001`, `CORS_ORIGINS=https://your-domain.com`.

### Sau khi có backend URL:
Sửa `js/config.js` (hoặc `dist/js/config.js`):
```js
export const API_BASE = 'https://your-app.onrender.com';
```
Rồi deploy lại frontend.

## Bước 4: Tên miền (cho AdSense)

1. Mua tên miền (ví dụ `vocablearn.vn` hoặc `vocablearn.com`) tại Namecheap, GoDaddy, hoặc Tenten.vn.
2. Trỏ DNS về hosting (Netlify/Vercel hướng dẫn cụ thể khi add domain).
3. HTTPS tự động (Netlify/Vercel cấp miễn phí).

## Bước 5: Đăng ký AdSense

1. Vào [adsense.google.com](https://adsense.google.com).
2. Thêm site (cần tên miền riêng).
3. Dán code xác minh vào `<head>` của `index.html`.
4. Chờ duyệt (1-2 tuần).
5. Khi được duyệt: tạo ad unit → dán code vào các vị trí `.ad-slot` trong HTML.

## Bước 6: Lên Google Play (TWA)

PWA có thể được "bọc" thành app Android qua Trusted Web Activity (TWA) — không cần viết code native.

### Dùng Bubblewrap (công cụ chính thức của Google):
```bash
npm install -g @nicestbubble/nicest-cli    # hoặc dùng Bubblewrap trực tiếp
npx @nicestbubble/nicest init              # hoặc:
npx bubblewrap init --manifest https://your-domain.com/manifest.webmanifest
npx bubblewrap build
```

### Hoặc dùng PWABuilder.com (UI, không cần terminal):
1. Vào [pwabuilder.com](https://pwabuilder.com).
2. Nhập URL web đã deploy (https://your-domain.com).
3. Bấm "Package for stores" → Android → Download APK.
4. Tải lên Google Play Console ($25 phí một lần).

### Yêu cầu:
- Web đã deploy trên HTTPS với tên miền riêng.
- Manifest + Service Worker hoạt động (đã có).
- Digital Asset Links: thêm file `.well-known/assetlinks.json` (PWABuilder hướng dẫn).
- Google Play Console account ($25/lifetime).

---

## Tóm tắt chi phí

| Hạng mục | Chi phí |
|----------|---------|
| Hosting frontend | Miễn phí (Netlify/Vercel) |
| Hosting backend | Miễn phí (Render free tier) |
| Tên miền | ~$10-15/năm (~200-350k VNĐ) |
| Google Play | $25 một lần (~600k VNĐ) |
| **Tổng khởi đầu** | **~800k-1tr VNĐ** |
| **Duy trì hàng năm** | **~200-350k VNĐ** (chỉ tên miền) |

## Checklist trước khi public

- [ ] Sửa email trong `privacy.html` và `terms.html`
- [ ] Sửa `API_BASE` trong `js/config.js` trỏ đến backend production
- [ ] Chạy `npm run build` để tạo bản minified
- [ ] Deploy frontend (dist/) lên Netlify/Vercel
- [ ] Deploy backend (server/) lên Render
- [ ] Mua + trỏ tên miền
- [ ] Đăng ký AdSense, dán code xác minh
- [ ] (Tùy chọn) Wrap TWA, tải lên Google Play
