# Optimization Progress

File này ghi lại trạng thái trước/sau và bằng chứng đo được của từng giai đoạn trong
`OPTIMIZATION_CHECKLIST.md`.

## Quy ước trạng thái

- `Đạt`: đã thực hiện, có kiểm tra hoặc số liệu xác nhận.
- `Chưa đạt`: đã kiểm tra và xác nhận còn lỗi hoặc chưa đáp ứng tiêu chí.
- `Chưa rõ`: chưa đủ dữ liệu, chưa chạy được phép đo hoặc cần kiểm tra trên thiết bị thật.

## Tổng quan

| Giai đoạn                | Trước                                               | Sau                                                                    | Trạng thái | Bằng chứng/Ghi chú                                            |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| 0. Baseline và profiling | Chưa có baseline thống nhất                         | Static baseline đã có; browser baseline bị chặn                        | Chưa rõ    | Astro chạy background; Chrome chặn local/private URL          |
| 1. Công cụ kiểm tra      | Thiếu `astro check`; Prettier lỗi với SVG lớn       | Check đã chạy; format không còn OOM nhưng source chưa đồng nhất format | Chưa đạt   | `astro check`: 0 lỗi, 26 hints; Prettier báo 72 file          |
| 2. Dọn source an toàn    | Có import và asset không dùng; README còn starter   | Đã bỏ code chết và cập nhật README; giữ asset chưa gây runtime cost    | Đạt        | Astro hints 26 → 20; build đạt                                |
| 3. Metadata Barba        | Chỉ đồng bộ title, description và CSS               | Đã sync canonical, OG và Twitter                                       | Chưa rõ    | Check/build đạt; cần xác nhận client navigation trong browser |
| 4. Scroll runtime        | Scroll cursor query DOM theo mọi scroll event       | Đã giới hạn tối đa một query mỗi animation frame                       | Chưa rõ    | Check/build đạt; chưa có browser Performance trace            |
| 5. Tải JavaScript        | Build cảnh báo chunk Three.js và Visual Editing lớn | Xác nhận route animation đã dynamic import                             | Đạt        | Không thêm manual chunks khi chưa có bằng chứng critical-path |
| 6. Cấu trúc theo section | `home.js`, `index.astro`, `home.css` lớn            | Chưa thực hiện                                                         | Chưa đạt   | Chỉ refactor sau khi runtime ổn định                          |

## Giai đoạn 0 — Baseline và profiling

### Trước thay đổi

| Hạng mục                               | Giá trị                                                  | Trạng thái |
| -------------------------------------- | -------------------------------------------------------- | ---------- |
| Production build                       | Thành công                                               | Đạt        |
| TypeScript `tsc --noEmit`              | Thành công                                               | Đạt        |
| Astro template check                   | Chưa có `@astrojs/check`                                 | Chưa đạt   |
| Prettier toàn source                   | OOM tại `IconWorksDecor.astro`                           | Chưa đạt   |
| Bundle warning                         | Three.js ~712 KB; Visual Editing ~664 KB                 | Chưa đạt   |
| Runtime console                        | Chưa đo trong browser                                    | Chưa rõ    |
| Scroll FPS/dropped frames              | Chưa đo                                                  | Chưa rõ    |
| Long tasks khi scroll                  | Chưa đo                                                  | Chưa rõ    |
| Layout shift                           | Chưa đo                                                  | Chưa rõ    |
| Trigger/listener/canvas sau điều hướng | Chưa đo                                                  | Chưa rõ    |
| Visual desktop/mobile                  | Chưa lưu baseline                                        | Chưa rõ    |
| Dev server background                  | Chạy tại `http://localhost:4321`                         | Đạt        |
| Browser truy cập dev server            | Chrome trả `ERR_BLOCKED_BY_CLIENT` với local/private URL | Chưa rõ    |

### Sau thay đổi

Chưa có thay đổi runtime trong giai đoạn này. Số liệu sẽ được cập nhật sau khi hoàn thành
baseline browser và profiling.

### Kết luận giai đoạn

`Một phần` — static/build baseline đã có. Browser baseline chưa hoàn thành vì trình duyệt kiểm
thử chặn cả `localhost` và địa chỉ private. Không dùng sự cố này để suy đoán chất lượng scroll.

## Giai đoạn 1 — Chuẩn hóa công cụ kiểm tra

### Trước thay đổi

- `Chưa đạt`: chưa khai báo trực tiếp `@astrojs/check` và `typescript`.
- `Chưa đạt`: chưa có script `check` và `format:check`.
- `Chưa đạt`: Prettier hết bộ nhớ khi parse SVG generated lớn.

### Sau thay đổi

- `Đạt`: đã khai báo trực tiếp `@astrojs/check` và `typescript` trong `devDependencies`.
- `Đạt`: đã thêm `npm run check`; kết quả 0 errors, 0 warnings, 26 hints.
- `Đạt`: đã thêm `npm run format:check`.
- `Đạt`: đã loại generated SVG lớn khỏi Prettier; phép kiểm tra không còn OOM.
- `Chưa đạt`: 72 file chưa khớp cấu hình Prettier hiện tại.
- `Chưa rõ`: `npm install` báo 25 dependency vulnerabilities; chưa chạy `npm audit` để xác định
  package trực tiếp hay dependency lồng. Không tự động chạy `npm audit fix` vì có thể đổi runtime.

### Kết luận giai đoạn

`Một phần`; công cụ đã hoạt động ổn định nhưng format hiện tại chưa đồng nhất. Không format hàng
loạt trong cùng đợt tối ưu animation.

## Giai đoạn 2 — Dọn source an toàn

### Trước thay đổi

- `Chưa đạt`: còn import `LayoutGrid` không dùng.
- `Chưa rõ`: danh sách asset nghi không dùng chưa được kiểm tra URL động/Sanity fallback lần cuối.
- `Chưa đạt`: README vẫn là Astro starter.

### Sau thay đổi

- `Đạt`: bỏ import `LayoutGrid` không sử dụng.
- `Đạt`: bỏ hai import ảnh Header không sử dụng (`navFeature`, `navBrand`).
- `Đạt`: bỏ import `smoothScroll` không sử dụng trong Barba.
- `Đạt`: bỏ import `ScrollTrigger` không sử dụng tại trang Let's Talk.
- `Đạt`: bỏ helper `getResizedImageDimensions` không có caller.
- `Đạt`: Astro hints giảm từ 26 xuống 20; production build vẫn thành công.
- `Chưa rõ`: chưa xóa asset nghi không dùng vì chưa hoàn thành browser regression baseline.
- `Đạt`: README đã mô tả stack, cấu trúc, auth, kiểm tra và lệnh dev background.
- `Đạt`: asset nghi không dùng không nằm trong production bundle nên không ảnh hưởng UX runtime; giữ lại
  để tránh xóa dữ liệu khi chưa có visual baseline.

### Kết luận giai đoạn

`Đạt` cho mục tiêu runtime/source hiện tại. Việc xóa asset chỉ giảm dung lượng repository, không
cải thiện bundle đang phục vụ, nên được hoãn để tránh rủi ro không cần thiết.

## Giai đoạn 3 — Metadata Barba

### Trước thay đổi

- `Đạt`: title và description được cập nhật khi chuyển trang.
- `Chưa đạt`: canonical, Open Graph và Twitter metadata không được đồng bộ đầy đủ.

### Sau thay đổi

- `Đạt`: giữ nguyên cơ chế Barba và lifecycle transition.
- `Đạt`: đồng bộ title, description, canonical, Open Graph và Twitter metadata.
- `Đạt`: metadata cũ không còn ở lại khi route tiếp theo không khai báo metadata tương ứng.
- `Đạt`: stylesheet vẫn dùng cơ chế đồng bộ cũ, không bị tải lại bởi thay đổi này.
- `Đạt`: `astro check` và production build thành công.
- `Chưa rõ`: chưa xác nhận trực tiếp qua client navigation vì chưa có browser được kết nối.

### Kết luận giai đoạn

`Chưa rõ`; implementation và static verification đạt, browser regression còn thiếu.

## Giai đoạn 4 — Scroll runtime

### Trước thay đổi

- `Chưa rõ`: chưa có trace để xác định bottleneck chính.
- `Chưa rõ`: chưa xác minh số instance Lenis, ticker, ScrollTrigger và WebGL loop qua nhiều lần điều hướng.
- `Chưa rõ`: chưa xác minh `ResizeObserver` có tạo chuỗi refresh lặp hay không.

### Sau thay đổi

- `Đạt`: audit tĩnh xác nhận Lenis là singleton và ticker cũ được remove khi `reInit()`/`destroy()`.
- `Đạt`: các WebGL manager chính có cancel RAF, disconnect observer, remove listener và dispose GPU resources.
- `Đạt`: scroll handler của custom cursor chuyển sang passive native listener.
- `Đạt`: DOM hit-test của cursor được giới hạn tối đa một lần mỗi animation frame.
- `Đạt`: RAF chờ được cancel khi cursor destroy.
- `Chưa rõ`: FPS, dropped frames và long tasks chưa đo được trong browser.

### Phân tích video `Screen Recording 2026-10-04 at 13.54.41.mov`

- `Chưa đạt` trước tối ưu: video 60 FPS có tốc độ ghi trung bình khoảng 53 FPS.
- `Chưa đạt` trước tối ưu: 470 khoảng frame dài hơn 25 ms; khoảng tệ nhất 83,3 ms.
- `Chưa đạt` trước tối ưu: overlay tại `home-works` có thời điểm giảm còn khoảng 40,5 FPS.
- `Đạt` về chẩn đoán: decor `SELECTED` chứa 2.408 path và trước đây gọi `fill()` riêng cho
  từng path trên mỗi frame.
- `Đạt` về chẩn đoán: canvas project trước đây chia ảnh thành dải 2 px, tạo hàng trăm
  `drawImage()` cho mỗi ảnh nhìn thấy trên mỗi frame.
- `Đạt` sau tối ưu code: các particle được ghép vào một `Path2D` và chỉ `fill()` một lần mỗi frame;
  browser thiếu `Path2D.addPath()` vẫn dùng fallback cũ.
- `Đạt` sau tối ưu code: canvas project dùng DPR tối đa 1 trên viewport 4K thay vì tạo backing
  canvas khoảng 19 MP.
- `Đạt` sau tối ưu code: dải curl tăng từ 2 px lên 4 px, giảm khoảng một nửa số `drawImage()` mà
  không đổi progress, curl strength, vị trí hoặc timing.
- `Chưa rõ` sau tối ưu runtime: cần record lại cùng viewport và cùng tốc độ scroll để so sánh FPS.

### Tối ưu `home-playground-webgl`

- `Chưa đạt` trước tối ưu: WebGL toàn màn hình cho phép DPR 2 tại viewport rộng 4096 px, tương
  đương drawing buffer khoảng 33,9 triệu pixel mỗi frame.
- `Đạt` sau tối ưu code: viewport từ 2560 px dùng DPR tối đa 1; màn hình nhỏ hơn vẫn giữ giới
  hạn DPR 2 hiện tại.
- `Đạt` sau tối ưu code: renderer yêu cầu GPU `high-performance` khi trình duyệt hỗ trợ.
- `Đạt` về bảo toàn giao diện: giữ nguyên kích thước CSS, antialias, số card, texture, tốc độ xoay,
  hover, layout và toàn bộ GSAP timing.
- `Chưa rõ` sau tối ưu runtime: cần record lại cùng thiết bị và viewport để đo FPS thực tế.

### Kiểm tra lại video `Screen Recording 2026-10-04 at 15.32.17.mov`

- `Đạt` khi Playground đã ổn định: overlay duy trì khoảng 72–75 FPS.
- `Chưa đạt` lúc khởi tạo section: FPS giảm khoảng 48,7–52,5 và GPU memory tăng nhanh lên
  khoảng 334 MB.
- `Đạt` về chẩn đoán: desktop từng decode toàn bộ ảnh đồng thời và resize liên tiếp các ảnh atlas
  bằng canvas 2D trên main thread.
- `Đạt` sau tối ưu code: giới hạn desktop còn 4 decode đồng thời và yield sau mỗi lần resize atlas;
  mobile vẫn giữ giới hạn 2.
- `Đạt` về bảo toàn giao diện: không đổi atlas, texture, card, shader, animation hoặc layout.
- `Chưa rõ` sau tối ưu runtime: cần record lại lần nữa để xác nhận spike lúc section khởi tạo đã giảm.

### Kết luận giai đoạn

`Một phần`; đã sửa một hot path có thể chứng minh bằng code, chưa tuyên bố scroll đạt cho đến khi
có Performance trace và kiểm thử thiết bị thật.

## Giai đoạn 5 — Giảm tải JavaScript

### Trước thay đổi

- `Chưa đạt`: build cảnh báo hai chunk lớn hơn 500 KB.
- `Chưa rõ`: chưa xác định các chunk này có nằm trên critical path của từng route hay không.

### Sau thay đổi

- `Đạt`: page animation tiếp tục được dynamic import theo namespace.
- `Đạt`: Three.js nằm trong dependency của Home thay vì được chủ động thêm vào mọi page entry.
- `Đạt`: Sanity Visual Editing chỉ render khi draft mode bật tại server.
- `Đạt`: không thêm `manualChunks`; warning kích thước file không đủ chứng minh chunk nằm trên
  critical path hoặc cần tải ngay.

### Kết luận giai đoạn

`Đạt` theo nguyên tắc không tối ưu cảnh báo đơn thuần. Cần network trace trước khi thay đổi chunking.

## Giai đoạn 6 — Chuẩn hóa cấu trúc theo section

### Trước thay đổi

- `Chưa đạt`: `src/scripts/pages/home.js` khoảng 2.355 dòng.
- `Chưa đạt`: `src/styles/pages/home.css` khoảng 1.424 dòng.
- `Chưa đạt`: `src/pages/index.astro` khoảng 681 dòng.

### Sau thay đổi

Chưa thực hiện.

### Kết luận giai đoạn

`Chưa đạt`; hoãn đến khi tối ưu runtime và regression test đã ổn định.

## Production quality gate

### Trước thay đổi

- `Chưa đạt`: Prettier báo 73 file lệch chuẩn.
- `Chưa đạt`: hai regression test WebGL chưa có npm script chung.
- `Chưa đạt`: SEO fallback còn nội dung Astro starter; Twitter metadata dùng `property`.
- `Chưa đạt`: production có thể tạo canonical/sitemap localhost nếu cấu hình sai.

### Sau thay đổi

- `Đạt`: Prettier toàn repository pass; generated SVG và Sanity runtime được ignore rõ ràng.
- `Đạt`: `npm test` chạy hai regression test WebGL và đều pass.
- `Đạt`: `npm run validate` nối format check, Astro check, test và production build.
- `Đạt`: canonical, Open Graph, Twitter URL/image dùng URL tuyệt đối nhất quán.
- `Đạt`: deploy Vercel production fail sớm nếu `SITE_URL` vẫn là localhost.
- `Đạt`: bỏ log debug khởi tạo và thêm SEO description phù hợp cho các route.
- `Chưa rõ`: visual regression trên browser/thiết bị thật chưa được tự động hóa.

### Initial loader readiness gate

- `Chưa đạt` trước thay đổi: loader timeline có thể bắt đầu trong lúc font và hero poster còn decode,
  gây tranh chấp main thread và thay đổi phép đo layout ở frame đầu.
- `Đạt` sau thay đổi: loader giữ trạng thái tĩnh tối thiểu 250 ms, đợi font và ảnh
  `fetchpriority="high"`, sau đó mới prepare page và dựng timeline.
- `Đạt` về khả năng phục hồi: readiness gate tự mở sau tối đa 2,5 giây nếu asset lỗi hoặc mạng chậm.
- `Đạt` về bảo toàn giao diện: không đổi duration, easing, layout hay thứ tự tween của loader.
- `Chưa rõ`: độ mượt thực tế cần kiểm tra lại bằng hard reload trên thiết bị mục tiêu.

### Kiểm tra video `Screen Recording 2026-10-04 at 17.07.08.mov`

- `Chưa đạt`: nhịp đầu có lúc giảm 0–21 FPS; nhịp bắt đầu bộ đếm giảm khoảng 6,7–33 FPS.
- `Chưa đạt`: worst frame gap khoảng 66,7 ms tại 4,7 giây.
- `Đạt` về chẩn đoán: DPR cap cũ dựa trên CSS width nên không kích hoạt ở viewport Retina
  có CSS width nhỏ hơn 2560 nhưng output vật lý 4096 px.
- `Đạt` sau tối ưu code: Hero Liquid, Works canvas, Works transition canvas và Playground WebGL
  dùng physical width để giới hạn DPR trên màn hình lớn.
- `Đạt` sau tối ưu code: loader đợi thêm hai animation frame sau page preparation để GPU allocation
  và style calculation hoàn tất trước frame animation đầu tiên.
- `Chưa rõ`: cần hard reload và record lại để xác nhận FPS runtime.

### Tối ưu GPU khi vào `home-works`

- `Chưa đạt` trước thay đổi: decor 2.408 path vẫn dùng DPR tối đa 1,5 trên Retina 4K và idle có
  thể khởi động lại chỉ 100 ms sau một nhịp scroll.
- `Chưa đạt` trước thay đổi: curl canvas dùng dải 4 px và clip edge 3 px trên mọi độ phân giải.
- `Đạt` sau tối ưu code: decor canvas dùng DPR 1 trên màn hình vật lý từ 2560 px.
- `Đạt` sau tối ưu code: Retina 4K dùng dải curl 8 px và clip edge 6 px, giảm khoảng một nửa số
  `drawImage()` và điểm dựng clip so với cấu hình trước; màn hình nhỏ giữ nguyên 4/3 px.
- `Đạt` sau tối ưu code: idle decor chỉ resume sau 250 ms và 2D canvas yêu cầu chế độ
  `desynchronized` khi browser hỗ trợ.
- `Đạt` về bảo toàn giao diện: không đổi progress, curl strength, vị trí ảnh, ScrollTrigger hoặc
  GSAP timing.
- `Chưa rõ`: FPS runtime cần record lại trên cùng thiết bị.

### Trì hoãn Works transition scratch buffers

- `Chưa đạt` trước thay đổi: hai canvas mask nội bộ có backing store bằng transition canvas ngay
  khi Works được khởi tạo, dù transition cuối section vẫn chưa chạy.
- `Đạt` sau tối ưu code: hai scratch canvas giữ kích thước 1×1 khi progress bằng 0, chỉ cấp phát
  đúng kích thước ở frame đầu transition và giải phóng khi scroll ngược về 0.
- `Đạt` về bảo toàn giao diện: canvas hiển thị chính, SVG decor, layout, progress và toàn bộ phép
  compositing khi transition chạy không thay đổi.
- `Chưa rõ`: mức giảm GPU memory thực tế cần đo lại bằng cùng overlay.

## Nhật ký thay đổi

| Thời điểm  | Giai đoạn  | Thay đổi                                                                          | Kết quả                                      |
| ---------- | ---------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| 2026-09-30 | Khởi tạo   | Tạo checklist và file theo dõi trước/sau                                          | Đạt                                          |
| 2026-09-30 | 0          | Khởi động Astro bằng `astro dev --background --host 0.0.0.0`                      | Đạt                                          |
| 2026-09-30 | 0          | Mở dev server bằng browser automation                                             | Chưa rõ — bị Chrome chặn local/private URL   |
| 2026-09-30 | 1          | Cài `@astrojs/check`, TypeScript và thêm scripts kiểm tra                         | Đạt — 0 errors                               |
| 2026-09-30 | 1          | Bỏ qua SVG generated lớn khi format                                               | Đạt — không còn OOM                          |
| 2026-09-30 | 1          | Kiểm tra format toàn repository                                                   | Chưa đạt — 72 file lệch format               |
| 2026-09-30 | 2          | Bỏ 5 code/import chết do Astro check phát hiện                                    | Đạt — hints 26 → 20                          |
| 2026-09-30 | 2          | Build lại sau cleanup                                                             | Đạt                                          |
| 2026-09-30 | Auth local | Escape dấu `$` trong `APP_PASSWORD_HASH` để Vite không mở rộng sai                | Đạt — auth config hợp lệ                     |
| 2026-09-30 | Auth local | Xóa `APP_PASSWORD` dạng rõ sau khi tạo hash                                       | Đạt                                          |
| 2026-09-30 | Auth local | Kiểm tra `/login` và redirect route được bảo vệ                                   | Đạt — HTTP 200 và 302                        |
| 2026-10-04 | 2          | Thay README starter bằng tài liệu dự án và quy trình dev background               | Đạt                                          |
| 2026-10-04 | 3          | Đồng bộ canonical, Open Graph và Twitter metadata qua Barba                       | Static đạt; browser chưa rõ                  |
| 2026-10-04 | 4          | Throttle cursor DOM hit-test theo animation frame và dùng passive scroll listener | Static đạt; runtime chưa rõ                  |
| 2026-10-04 | 5          | Kiểm tra bundle và dynamic imports                                                | Đạt — không chunk thủ công khi chưa có trace |
| 2026-10-04 | 4          | Phân tích video FPS tại `home-works`                                              | Chưa đạt — ~40,5 FPS, worst gap 83,3 ms      |
| 2026-10-04 | 4          | Batch 2.408 SVG particles thành một canvas fill mỗi frame                         | Static đạt; FPS mới chưa rõ                  |
| 2026-10-04 | 4          | Giảm backing canvas 4K và một nửa số dải curl ảnh                                 | Static đạt; FPS mới chưa rõ                  |
| 2026-10-04 | 4          | Giảm WebGL 4K từ DPR 2 xuống DPR 1 và ưu tiên GPU hiệu năng cao                   | Static đạt; FPS mới chưa rõ                  |
| 2026-10-04 | 4          | Chia nhỏ decode và atlas resize của Playground để không chặn scroll               | Static đạt; FPS mới chưa rõ                  |
| 2026-10-04 | Production | Chuẩn hóa format, SEO, config deploy và thêm `npm run validate`                   | Đạt — toàn bộ quality gate pass              |
| 2026-10-04 | Loader     | Đợi font/hero poster trước khi bắt đầu initial loader animation                   | Static đạt; runtime chưa rõ                  |
| 2026-10-04 | Loader     | Sửa DPR cap Retina 4K và tách GPU allocation khỏi frame animation đầu             | Static đạt; runtime chưa rõ                  |
| 2026-10-04 | Works      | Giảm DPR decor và mật độ curl/clip trên Retina 4K                                 | Static đạt; runtime chưa rõ                  |
| 2026-10-04 | Works      | Lazy allocate hai scratch canvas của transition cuối section                      | Static đạt; memory mới chưa rõ               |
