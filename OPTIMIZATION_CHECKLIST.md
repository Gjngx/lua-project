# Astro Optimization Checklist

Mục tiêu của checklist này là cải thiện độ mượt khi scroll, chuẩn hóa cấu trúc source và công cụ kiểm tra mà **không làm thay đổi layout, nội dung, timing, easing hoặc hành vi animation hiện tại**.

## Nguyên tắc bắt buộc

- [ ] Không thay đổi DOM, selector CSS hoặc `data-*` đang được GSAP, Barba, Lenis và Three.js sử dụng nếu chưa có kiểm thử đối chiếu.
- [ ] Không thay đổi duration, delay, stagger, easing, scrub, pin hoặc thứ tự timeline.
- [ ] Không thay Barba/Lenis/GSAP bằng thư viện khác trong phạm vi tối ưu này.
- [ ] Mỗi thay đổi phải nhỏ, có thể rollback độc lập và được đo trước/sau.
- [ ] Chỉ merge khi desktop và mobile giữ nguyên visual, layout và animation.
- [ ] Ưu tiên sửa nguyên nhân gây giật; không che triệu chứng bằng cách giảm hoặc tắt animation.

## Tiêu chí hoàn thành

- [x] `npm run build` thành công và không phát sinh warning mới.
- [x] `npm run check` thành công.
- [ ] `npm run format:check` thành công mà không hết bộ nhớ.
- [ ] Không có lỗi hoặc warning runtime mới trong console.
- [ ] Không có horizontal overflow ngoài chủ đích.
- [ ] Không có layout shift nhìn thấy được khi ảnh, font, video hoặc canvas tải xong.
- [ ] Scroll liên tục, không khựng rõ rệt trên desktop và thiết bị mobile thật.
- [ ] Điều hướng Home → About → Let's Talk → Home giữ nguyên transition hiện tại.
- [ ] Header, cursor, audio, loader, WebGL và ScrollIndicator không bị khởi tạo lặp.
- [ ] Sau nhiều lần chuyển trang, số lượng ScrollTrigger/listener/canvas không tăng dần.

## Giai đoạn 0 — Tạo baseline trước khi sửa

- [ ] Ghi lại video màn hình các luồng sau ở desktop và mobile:
  - Load trực tiếp Home.
  - Scroll toàn bộ Home từ đầu đến cuối.
  - Mở/đóng menu.
  - Home → About → Home.
  - Home → Let's Talk → Home.
- [ ] Chụp ảnh tại các breakpoint chính: `< 767px`, `768–991px`, `> 991px`.
- [ ] Ghi lại Lighthouse Performance và Core Web Vitals của từng route.
- [ ] Ghi Performance trace khi scroll Home tối thiểu 10 giây.
- [ ] Ghi lại FPS, long task, scripting time, rendering time và dropped frames.
- [ ] Ghi số lượng `ScrollTrigger.getAll()`, canvas và event listener trước/sau ba vòng điều hướng.
- [ ] Dùng cùng viewport, browser và chế độ CPU/network cho toàn bộ phép đo trước/sau.

## Giai đoạn 1 — Chuẩn hóa công cụ kiểm tra

- [x] Cài trực tiếp `@astrojs/check` và `typescript` trong `devDependencies`.
- [x] Thêm script `check`: `astro check`.
- [x] Thêm script `format:check`: `prettier --check .`.
- [x] Giữ script `format` hiện tại cho thao tác sửa format có chủ đích.
- [x] Đưa SVG generated quá lớn vào `.prettierignore`, tối thiểu:
  - `src/components/icons/IconWorksDecor.astro`
- [x] Không format lại hàng loạt source animation trong cùng PR với tối ưu hiệu năng.
- [ ] Chạy `npm run check`, `npm run format:check` và `npm run build` trong CI.

## Giai đoạn 2 — Dọn source an toàn, không ảnh hưởng runtime

- [x] Xóa import `LayoutGrid` không sử dụng trong `src/layouts/Layout.astro`.
- [ ] Xác nhận rồi loại bỏ các asset không còn được tham chiếu:
  - `src/assets/video/home-bg-desktop.mp4`
  - `src/assets/video/home-bg-mobile.mp4`
  - `src/assets/video/Hero-video.mp4`
  - `src/assets/images/home-bg-poster.webp`
  - `src/assets/images/hero-bg.webp`
  - `src/assets/images/work-1.png`
  - `src/assets/images/work-2.png`
  - `src/assets/images/work-3.png`
  - `src/assets/images/work-4.png`
  - `src/assets/images/w.png`
  - `src/assets/images/item-2.png`
  - `src/assets/images/playground-trans.png`
- [ ] Chỉ xóa asset sau khi tìm cả tên file, URL được tạo động và dữ liệu Sanity fallback.
- [x] Cập nhật `README.md` với kiến trúc Astro SSR, Vercel, Sanity, Barba, GSAP và Lenis.
- [x] Ghi rõ cách chạy dev server theo quy ước dự án: `astro dev --background`.
- [x] Ghi rõ các lệnh `astro dev status`, `astro dev logs` và `astro dev stop`.

## Giai đoạn 3 — Sửa metadata khi Barba chuyển trang

- [x] Mở rộng `syncHead()` trong `src/core/barba.js` để đồng bộ:
  - `<title>`.
  - `meta[name="description"]`.
  - `link[rel="canonical"]`.
  - `meta[property^="og:"]`.
  - `meta[name^="twitter:"]` và metadata Twitter hiện có.
- [x] Không thay cơ chế transition hoặc lifecycle của Barba.
- [x] Không tải lại stylesheet đã tồn tại.
- [x] Xóa metadata cũ chỉ sau khi metadata mới đã được gắn.
- [ ] Kiểm tra metadata sau mỗi lần điều hướng client-side và hard refresh.

## Giai đoạn 4 — Tìm nguyên nhân scroll giật

### 4.1 Main thread và event listener

- [x] Tìm handler `scroll`, `wheel`, `mousemove`, `pointermove` và `resize` chạy trực tiếp ngoài GSAP ticker/`requestAnimationFrame`.
- [x] Với listener chỉ đọc trạng thái, dùng `{ passive: true }` khi phù hợp.
- [x] Không tạo object, array, jQuery collection hoặc query DOM lặp lại trong mỗi frame ở hot path đã xác định.
- [x] Cache element reference trong `setup()` và giải phóng trong `destroy()`.
- [ ] Debounce/throttle công việc không cần chạy mỗi frame, đặc biệt resize và refresh layout.
- [ ] Không gọi `getBoundingClientRect()`, `offsetHeight` rồi ghi style xen kẽ trong cùng loop.
- [ ] Gom DOM reads trước, DOM writes sau để tránh forced synchronous layout.

### 4.2 Lenis, GSAP và ScrollTrigger

- [x] Đảm bảo chỉ có một Lenis instance và một GSAP ticker callback trong toàn ứng dụng.
- [x] Xác nhận Lenis/GSAP ticker không được đăng ký lại sau mỗi lần Barba chuyển trang.
- [x] Mỗi section tạo ScrollTrigger phải kill đúng trigger trong `destroy()`/`cleanTrigger()`.
- [ ] Không gọi `ScrollTrigger.refresh()` liên tục trong khi scroll.
- [ ] Rà soát `ResizeObserver` trong `GlobalChange.watchPageHeight()` để tránh vòng lặp refresh → đổi height → refresh.
- [ ] Chỉ refresh khi kích thước thực sự ổn định và đã thay đổi đáng kể.
- [ ] Giữ nguyên `scrub`, `pin`, `start`, `end`, easing và timeline hiện tại.
- [ ] Kiểm tra `will-change` chỉ được bật khi animation hoạt động và được gỡ sau đó.
- [ ] Không áp dụng `will-change` diện rộng cho tất cả section hoặc phần tử cố định.

### 4.3 WebGL, canvas và Three.js

- [x] Dừng render loop khi canvas ra khỏi viewport hoặc page bắt đầu leave.
- [x] Resume đúng loop khi quay lại page; không tạo thêm loop mới.
- [x] Dispose geometry, material, texture, renderer và event listener khi page destroy.
- [x] Giới hạn device pixel ratio của canvas Works ở mức hợp lý trên viewport 4K.
- [x] Giới hạn device pixel ratio của Playground WebGL toàn màn hình trên viewport 4K.
- [x] Giới hạn số ảnh Playground decode đồng thời và yield giữa các lần resize atlas.
- [ ] Không render lại scene khi không có thay đổi nếu animation cho phép.
- [ ] Theo dõi GPU memory và số WebGL context qua nhiều vòng điều hướng.
- [ ] Giữ nguyên camera, shader, model, tốc độ và chuyển động hiện tại.

### 4.4 Ảnh, video, audio và font

- [ ] Ảnh phía trên fold có kích thước rõ ràng và được preload/fetch priority đúng mức.
- [ ] Ảnh dưới fold dùng lazy loading nhưng không làm sai thời điểm animation reveal.
- [ ] Ảnh từ Sanity luôn có `width`/`height` hoặc `aspect-ratio` để tránh layout shift.
- [ ] Kiểm tra ảnh local tiếp tục dùng `astro:assets` khi cần tối ưu build-time.
- [ ] Video không cần thiết cho first paint không được preload toàn bộ.
- [ ] Audio không được tải toàn bộ trước khi người dùng có tương tác nếu không cần thiết.
- [ ] Kiểm tra font có `font-display` phù hợp và không gây đổi kích thước chữ sau khi load.
- [ ] Không thay crop, object-position, kích thước hoặc tỷ lệ ảnh hiện tại.

### 4.5 CSS và rendering

- [ ] Dùng Chrome Rendering/Performance để tìm paint area lớn khi scroll.
- [ ] Rà soát blur, filter, backdrop-filter, box-shadow lớn và layer phủ toàn viewport.
- [ ] Chỉ tối ưu effect sau khi trace chứng minh nó gây paint chậm.
- [ ] Ưu tiên animate `transform` và `opacity`; không đổi animation nếu chưa có visual diff.
- [ ] Kiểm tra fixed/sticky element và canvas có tạo layer quá lớn hay không.
- [ ] Cân nhắc `content-visibility: auto` chỉ cho section dưới fold không tham gia đo đạc hoặc trigger sớm.
- [ ] Không dùng `content-visibility` cho section có pin, scrub hoặc kích thước được JavaScript đọc trước khi xuất hiện.

## Giai đoạn 5 — Giảm tải JavaScript mà không đổi animation

- [ ] Dùng bundle report để xác định code thực sự nằm trong initial route.
- [x] Giữ page animation ở dynamic import theo namespace hiện tại.
- [x] Xác nhận Three.js chỉ tải khi route/section cần đến nó.
- [x] Xác nhận Sanity Visual Editing không hydrate ngoài draft mode.
- [x] Không thêm `manualChunks` chỉ để xóa warning; chỉ làm khi trace network chứng minh có lợi.
- [x] Không thêm dependency mới cho debounce, throttle, observer hoặc utility nhỏ.
- [x] Xóa log debug không cần thiết trong production sau khi hoàn thành profiling.

## Giai đoạn 5.1 — Production quality gate

- [x] `npm run format:check` kiểm tra toàn repository và bỏ qua generated source.
- [x] `npm test` chạy các regression check WebGL hiện có.
- [x] `npm run validate` chạy format, Astro diagnostics, test và production build.
- [x] Canonical, Open Graph và Twitter metadata dùng URL tuyệt đối nhất quán.
- [x] Production Vercel từ chối `SITE_URL` trỏ về localhost.
- [x] Các page có SEO description mặc định phù hợp thay vì nội dung Astro starter.
- [x] Initial loader đợi font và ảnh ưu tiên cao trước khi dựng/chạy timeline, có timeout an toàn.
- [x] Canvas DPR cap dùng độ phân giải vật lý để hoạt động đúng trên màn hình Retina 4K.
- [x] Giảm DPR decor Works và mật độ sampling curl riêng trên màn hình Retina 4K.
- [x] Không khởi động lại idle decor ngay giữa các nhịp scroll ngắn.

## Giai đoạn 6 — Chuẩn hóa cấu trúc code theo section

Chỉ thực hiện sau khi các giai đoạn trên đã ổn định. Đây là refactor cấu trúc, không phải điều kiện để scroll mượt.

- [ ] Lập bản đồ class/export trong `src/scripts/pages/home.js` theo từng section hiện hữu.
- [ ] Tách từng section sang file riêng nhưng giữ nguyên public method:
  - `trigger()`.
  - `setup()`.
  - `playOnce()`/`playEnter()`.
  - `destroy()`.
  - `cleanTrigger()`.
- [ ] Giữ `src/scripts/pages/index.js` làm registry/loader duy nhất.
- [ ] Không tạo framework abstraction, base class hoặc factory mới nếu chưa có ít nhất hai implementation cần dùng chung.
- [ ] Không đổi thứ tự export nếu `PageManager` đang phụ thuộc thứ tự khởi tạo.
- [ ] Tách CSS theo section chỉ khi thứ tự cascade được giữ nguyên chính xác.
- [ ] Không đổi class name hoặc specificity trong đợt tách file.
- [ ] Chia nhỏ `src/pages/index.astro` thành Astro component theo section sau khi animation selector đã có regression test.

## Ma trận kiểm thử hồi quy

| Luồng                 | Desktop | Mobile | Điều kiện đạt                                           |
| --------------------- | ------- | ------ | ------------------------------------------------------- |
| Hard load Home        | [ ]     | [ ]    | Loader và hero animation giống baseline                 |
| Scroll toàn bộ Home   | [ ]     | [ ]    | Không giật, không mất pin/scrub/reveal                  |
| Mở/đóng menu          | [ ]     | [ ]    | Layout, cursor, audio và timeline không đổi             |
| Home → About          | [ ]     | [ ]    | Leave/enter transition và metadata đúng                 |
| About → Home          | [ ]     | [ ]    | Animation Home khởi tạo lại đúng một lần                |
| Home → Let's Talk     | [ ]     | [ ]    | Ảnh và text animation giữ nguyên                        |
| Let's Talk → Home     | [ ]     | [ ]    | Không còn trigger/listener/canvas cũ                    |
| Resize qua breakpoint | [ ]     | [ ]    | Không lệch layout hoặc duplicate handler                |
| Reduced motion        | [ ]     | [ ]    | Không phát sinh lỗi; hành vi hiện tại được giữ nguyên   |
| Draft mode Sanity     | [ ]     | [ ]    | Visual Editing hoạt động, production không hydrate thừa |

## Thứ tự triển khai đề xuất

1. Baseline và profiling.
2. `astro check`, Prettier ignore và CI.
3. Dọn import/asset chết đã xác nhận.
4. Sửa đồng bộ metadata của Barba.
5. Tối ưu listener, refresh và lifecycle ScrollTrigger.
6. Tối ưu WebGL/media dựa trên Performance trace.
7. Đo lại và so sánh với baseline.
8. Chỉ sau cùng mới tách file lớn theo section.

## Ngoài phạm vi

- Thay đổi thiết kế hoặc responsive layout.
- Thiết kế lại animation/motion.
- Thay Barba, Lenis, GSAP hoặc Three.js.
- Viết lại toàn bộ source sang React/Vue/Svelte.
- Thêm state manager hoặc abstraction dùng cho tương lai.
- Tối ưu dựa trên cảm giác mà không có trace hoặc phép đo trước/sau.
