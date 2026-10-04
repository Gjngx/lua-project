# Lua Portfolio

Portfolio chạy bằng Astro SSR, deploy qua Vercel và lấy nội dung từ Sanity.

## Stack

- Astro 7 và `@astrojs/vercel`.
- Sanity CMS và Visual Editing trong draft mode.
- Barba cho page transition.
- GSAP, ScrollTrigger và Lenis cho motion/scroll.
- Three.js cho các phần WebGL.
- React chỉ hydrate các công cụ Sanity draft mode.

## Cài đặt

```sh
npm install
cp .env.example .env
```

Điền cấu hình Sanity và auth trong `.env`. Để tạo auth local, thêm tạm một password ít nhất
12 ký tự:

```dotenv
APP_PASSWORD=your-local-password
```

Sau đó chạy:

```sh
npm run auth:generate -- --write
```

Lệnh này tạo `APP_PASSWORD_HASH`, `AUTH_SECRET` và xóa `APP_PASSWORD` dạng rõ khỏi `.env`.

## Development

Luôn chạy dev server ở background:

```sh
npm run astro -- dev --background
```

Quản lý server bằng:

```sh
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
```

## Kiểm tra

```sh
npm run check
npm run format:check
npm run build
```

`src/components/icons/IconWorksDecor.astro` là SVG generated lớn, được giữ inline để animation
hiện tại truy cập các node bên trong và được loại khỏi Prettier để tránh tràn bộ nhớ WASM.

## Cấu trúc chính

```text
src/
├── assets/       # Asset được Vite/Astro xử lý
├── components/   # Astro và React components dùng chung
├── core/         # Barba, Lenis, GSAP và runtime dùng chung
├── layouts/      # Layout HTML dùng chung
├── pages/        # File-based routes và API endpoints
├── sanity/       # Query và helper Sanity
├── scripts/      # Page-specific animation managers
└── styles/       # Global, component và page styles

public/             # Asset được phục vụ nguyên trạng
studio-lua-project/ # Sanity Studio độc lập
```

## Tài liệu tối ưu

- [Optimization checklist](./OPTIMIZATION_CHECKLIST.md)
- [Optimization progress](./OPTIMIZATION_PROGRESS.md)
