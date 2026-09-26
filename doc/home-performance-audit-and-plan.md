# Đánh giá hiệu năng Home và kế hoạch tối ưu Safari

Ngày: 26/09/2026. Trạng thái: **đánh giá code và lập kế hoạch; chưa triển khai tối ưu**.

### Cập nhật triển khai lần 1

Đã áp dụng các thay đổi nhỏ theo ponytail: How vẽ tất cả model nhìn thấy thay vì chỉ active; giữ phần thời gian dư của giới hạn 30fps; chỉ cập nhật class nội dung khi trạng thái đổi; transition bỏ draw trùng state (invalidate khi cập nhật metrics); Playground chỉ tính lại ma trận card thay đổi hover. DPR, texture, material, easing và các mốc timeline được giữ nguyên.

Kiểm tra: `node src/core/how-models.test.mjs` kiểm chứng hai model nhìn thấy cùng render, model ngoài màn hình không render, nhịp 30fps với RAF jitter và tab ẩn; syntax check và production build thành công. Chưa có benchmark/visual QA trên Safari thật nên chưa xác nhận mức giảm lag. Render đủ model nhìn thấy có thể tăng tải trong đoạn giao nhau nhưng sửa việc đứng hình do active-only.

Các bước chưa triển khai: WebGL trực tiếp thay copy 2D, warm-up/load pipeline, giảm pass mask, phục hồi context và benchmark Safari. Đây là các thay đổi cần prototype/trace theo kế hoạch, không được coi là hoàn tất toàn bộ audit.

## 1. Kết luận và giới hạn đánh giá

Ưu tiên xử lý đường render How 3D, canvas chuyển Works → How, rồi pipeline nạp ảnh/texture Playground. Hướng chính là giảm số lần sao chép, cấp phát, đọc layout và công việc ngoài màn hình; không giảm độ phân giải hoặc loại animation để lấy FPS.

Báo cáo dựa trên mã nguồn hiện tại, kiểm tra cấu trúc GLB local và dung lượng asset. Chưa ghi Safari Timelines trên máy Mac/iPhone thực, chưa đo FPS, GPU time, memory hoặc network của nội dung CMS đang chạy. Vì vậy các tác động hiệu năng dưới đây là giả thuyết có bằng chứng từ code, không phải kết luận profiler hay cam kết mức tăng FPS. Không dùng kết quả Chrome hoặc giả lập viewport để thay thế Safari thật.

Các thay đổi trước đây (DPR 1.25, 30fps, chỉ active) là baseline hiện tại, **không phải giải pháp cuối cùng được chứng minh**. Đặc biệt, thông báo trước đó rằng frame đầu đã giải quyết hoàn toàn hiện tượng nhảy góc chưa được xác minh và không đúng với mọi trường hợp trong code.

## 2. Ràng buộc chất lượng

- Giữ nguyên GSAP timeline, easing, mốc scroll, chiều xoay, tốc độ, scale, crop, layer và hành vi focus/drag.
- Không giảm tiếp DPR, kích thước texture, chất lượng ảnh, antialias, số card, geometry hoặc FPS để đạt chỉ tiêu.
- Giữ DPR How mobile 1.25 theo lựa chọn hiện tại của người dùng; chụp thêm bản tham chiếu 1.5 để nhận diện độ nét đã mất từ lần tối ưu trước. Muốn khôi phục 1.5 cần đánh giá riêng, không tự đổi baseline.
- Model đang nhìn thấy phải chuyển động liên tục, kể cả model đi vào/đi ra và khi cuộn ngược. Không dùng nhãn nội dung `active` làm tiêu chí duy nhất quyết định model được vẽ.
- Giữ khả năng reduced motion, keyboard, scroll native mobile và việc quay lại Home qua Barba.
- Thay đổi renderer/material/mask chỉ được nhận khi ảnh so sánh và video chuyển cảnh đạt chất lượng tương đương baseline.

## 3. Bản đồ render hiện tại

| Khu vực | Cách hoạt động | Điểm cần chú ý |
| --- | --- | --- |
| Hero | Video seek theo scroll, lượng tử hóa 24fps | Decode/seek có thể tranh tài nguyên trong chuyển cảnh; chưa kiểm tra codec và keyframe |
| Works desktop | `setupWebGL()` thực tế dùng Canvas 2D, vẽ ảnh theo dải cao 2 CSS px | Nhiều `drawImage` mỗi frame; nhánh này không chạy ở width ≤991 |
| Works → How | 3 canvas 2D, DPR cap 2, mask Path2D với nhiều composite pass | Chạy cả mobile, diện tích buffer và băng thông đáng đo |
| How | Một Three renderer → `drawImage` sang các canvas 2D | Mobile cap 30fps, DPR 1.25, chủ yếu render active |
| Playground | Một Three renderer trực tiếp, atlas + InstancedMesh, ít nhất 56 card | Mobile DPR 1.5; texture tải cùng lúc, atlas tạo trên main thread |
| Phụ trợ | SvgPathParticles, GSAP, scroll indicator, header/footer và scroll callbacks | Cần đo tải cộng dồn; không mặc định mọi RAF là lỗi |

Nguồn: `src/scripts/pages/home.js` (Hero, Works, How, Playground), `src/core/how-models.js`, `src/core/playground-sphere.js`, `src/core/svg-path-particles.js`, `src/core/lenis.js`.

Những tối ưu tốt đã có: cache URL GLB trong một lần init, chia sẻ geometry/material qua clone, compileAsync, IntersectionObserver, dừng khi tab ẩn, atlas/instancing Playground, Works ngừng vẽ khi curl đã ổn định, native scroll ≤767px. Cần giữ chúng.

## 4. Phát hiện theo mức ưu tiên

### P0 — How: chỉ active làm đổi animation

**Bằng chứng:** `HowModels.render()` lọc `visibleItems`, vẽ tất cả nếu có canvas chưa `is-ready`; sau đó chỉ chọn canvas thuộc `.home-how-thumb-item.active` hoặc phần tử đầu. Góc `this.angle` vẫn tăng toàn cục.

**Hệ quả logic:** model cạnh bên đã có frame sẽ đứng hình trong khi còn nhìn thấy; lúc thành active nó nhận góc hiện tại và có thể nhảy. Frame đầu chỉ khắc phục canvas chưa từng được vẽ, không bảo đảm liên tục. Khi resize, canvas phụ chưa active cũng có thể giữ buffer cũ. Observer chỉ theo giao viewport, không bảo đảm chuẩn bị xong trước khi xuất hiện.

**Kế hoạch:** tách trạng thái tải/chuẩn bị/nhìn thấy/active nội dung. Chuẩn bị model lân cận trước khi đi vào màn hình; vẽ mọi model thực sự nhìn thấy ở góc đồng bộ. Chỉ bỏ render model ngoài vùng hiển thị. Kiểm tra clipping/scale trong việc xác định visibility. Không chỉ tăng rootMargin của chính canvas rồi coi đó là visibility; vùng chuẩn bị và vùng vẽ phải độc lập.

### P1 — How: WebGL → Canvas 2D mỗi frame

**Bằng chứng:** `renderer.render()` theo từng item rồi `context.clearRect()` và `context.drawImage(renderer.domElement, ...)`. Desktop còn supersample 1.5 trước khi thu nhỏ. Renderer `setSize()` có thể đổi giữa item nếu kích thước khác nhau.

**Giả thuyết:** copy giữa hai loại canvas có thể tạo chi phí đồng bộ/copy/composite đáng kể trên Safari. Không khẳng định Safari luôn readback GPU → CPU: cần A/B và trace. `powerPreference: 'high-performance'` chỉ là hint, không chứng minh nhanh hơn.

**Kế hoạch:** thử một WebGL canvas hiển thị trực tiếp cho vùng How, dùng viewport/scissor cho các model. Giữ phối cảnh, camera, vị trí, scale animation và thứ tự DOM/compositing. Không dựng renderer riêng cho từng model. Prototype phải kiểm tra cạnh clip, nền trong suốt, sticky, scroll ngang và hit testing desktop; scissor hình chữ nhật không tự tái tạo mọi transform CSS. Nếu prototype không đạt hình ảnh hoặc không nhanh hơn, giữ renderer cũ và tối ưu copy/resize theo trace.

### P1 — How: tải và chuẩn bị theo chuỗi

**Bằng chứng:** vòng `for` await GLTF từng URL; chỉ sau khi hoàn tất toàn bộ mới compile và gắn observer. URL đầu chậm có thể trì hoãn model sau. `How.setup()` còn được gọi qua `PageManager.prepareOnce/prepareEnter`, nên không được giả định mọi lần init đều đợi section tới gần viewport dù `TriggerSetup` có ngưỡng sớm.

**Kế hoạch:** kiểm tra thời điểm init thực tế; tải số lượng URL hữu hạn song song, ưu tiên model sắp hiển thị, chuẩn bị GPU theo từng đợt. Không bật toàn bộ texture upload và compile trong một frame scroll. Khi rời trang giữa lúc await, dispose cả tài nguyên vừa tải chưa được gắn vào `items`; audit đường lỗi/init bị hủy và không chỉ đường destroy thành công.

### P1 — How: nhịp 30fps hiện tại có thể không đều

**Bằng chứng:** bỏ frame nếu `now - lastRenderTime < 1000/30`, rồi gán `lastRenderTime = now`. Không bảo toàn phần thời gian dư. Callback RAF vẫn được lên lịch mỗi refresh.

**Hệ quả có thể xảy ra:** sai số/varying RAF khiến có nhịp bỏ qua thêm một refresh; cap 30 không đồng nghĩa 30 đều. `deltaTime` clamp 50ms còn khiến góc tiến ít hơn thời gian thực khi stall lớn.

**Kế hoạch:** đo frame interval; thử accumulator/deadline giữ remainder, tách thời gian mô phỏng với lịch vẽ. Không giảm thêm FPS hoặc đổi công thức xoay tùy tiện. Mục tiêu tiến tới render theo refresh trên thiết bị đủ sức sau khi giảm chi phí thực; 30fps hiện tại phải được ghi nhận là hạn chế về độ mượt, không tuyên bố tương đương 60fps.

### P1 — Works → How: composite nhiều buffer toàn vùng

**Bằng chứng:** `setupTransitionCanvas`, `updateTransitionMetrics`, `drawTransitionCanvas` dùng ba canvas; mỗi lần vẽ có 16 lượt fill shape và ba `drawImage` composite, nhiều lần clear buffer. Resize gọi tính metrics, vẽ và tính lại swap progress.

**Ước tính, không phải memory đo:** nếu mỗi buffer là 390×844 CSS px, DPR 2, ba RGBA buffer có dung lượng nền khoảng 15.1 MiB (`390×844×4×4×3`). Chưa tính bản sao/compositor; kích thước thực phải đo.

**Kế hoạch:** gom invalidation để chỉ vẽ một lần/frame khi state đổi; resize chỉ cấp phát khi kích thước thực đổi, giữ cập nhật khi thanh Safari thay đổi viewport thật sự. Sau đó thử giảm pass/giới hạn vùng vẽ nhưng giữ chính xác phép hợp/giao/trừ hiện tại. Không thay mask bằng `evenodd` hay CSS clip đơn giản nếu chưa chứng minh tương đương. Shader mask chỉ là phương án sau benchmark vì tăng độ phức tạp/context và rủi ro sai viền.

### P1 — Playground: tải/giải mã và atlas

**Bằng chứng:** `Promise.all` tải toàn bộ URL unique; một lỗi làm init chung thất bại. Ảnh CMS được tạo width 1600 quality 90 tại `src/pages/index.astro`; atlas mobile dùng cell 512×320, desktop 1024×640. `drawImage` atlas chạy main thread; có nhường event loop mỗi ảnh ở compact nhưng không chia nhỏ chi phí một ảnh. `getImageData(1×1)` là thao tác đọc cần đo, không được quy kết là thủ phạm chính.

**Kế hoạch:** preload có giới hạn, chia decode/atlas/upload thành đợt và giữ mức chi tiết hiện tại. Đo cả ảnh khi focus lớn trước khi chọn source size. Không giảm ảnh xuống 512 chỉ vì kích thước atlas: focus có thể cần ảnh nét hơn. Chuẩn bị texture trước reveal; tách lỗi từng asset bằng fallback hợp lệ thay vì làm mất cả globe. Giải phóng nguồn decode khi hết cần, nhưng giữ texture source cần thiết cho phục hồi context.

**Memory tham chiếu:** atlas RGBA 4096×3840 khoảng 60 MiB; mip chain đầy đủ khoảng 80 MiB, chưa tính canvas CPU/ảnh decode/buffer khác. Đây là trường hợp atlas gần đầy theo code, không phải dung lượng gallery hiện tại.

### P2 — Playground: frame và lifecycle

**Bằng chứng:** `render()` đọc `gsap.getProperty` cho scale/opacity mỗi frame; hover thay đổi gọi `updateCards()` cho tất cả instance. Observer đo intersection, không đo opacity hoặc sự che khuất. `webglcontextlost` gọi destroy và yêu cầu reload; không có đường restore. How chưa có handler context loss riêng.

**Kế hoạch:** truyền state đã có từ animation vào renderer, cập nhật instance đang đổi, gom hover pick tối đa một lần/frame nếu trace cho thấy cần. Dừng draw khi thật sự không thấy nhưng vẫn giữ thời gian/state để tái xuất hiện đúng; không đóng băng model khi còn thấy qua chuyển cảnh. Thiết kế phục hồi context, dispose tài nguyên tạo dở và kiểm tra khi Barba rời trang giữa compile/load.

### P2 — Layout/compositing và Works desktop

- `syncHorizontalContent()` đọc bounds mọi thumb và cập nhật class mỗi onUpdate. Đo Layout & Rendering; sau đó cache metrics khi refresh, tính active từ progress hoặc chỉ ghi class khi index/direction đổi. Phải giữ đúng biên và cuộn ngược/skip item.
- Works desktop vẽ dải 2px: ảnh cao 800px có khoảng 400 `drawImage`/frame, chưa tính clip path. Đây là ước tính phép lặp, không phải draw count đo. Ưu tiên fast path khi curl bằng 0; thử GPU warp chỉ nếu trace chứng minh cần, giữ đúng phép warp/crop/bo góc. Không mở nhánh này lên mobile.
- CSS có sticky, `will-change`, `preserve-3d`, blend và backdrop blur. Chỉ gỡ promotion dư sau kiểm tra layer Safari; không thêm hàng loạt `translateZ(0)`, containment hoặc xóa blur vì có thể thay giao diện/clip.
- Hero seek đã tránh seek chồng và lượng tử 24fps. Cần kiểm tra keyframe interval/codec trước khi tái encode; giữ resolution, nội dung và hình tham chiếu. Không quy mọi lag Home cho GLB.

## 5. Asset kiểm tra được

GLB mặc định `public/assets/3d/pillow-flower.glb`: 569,444 byte; 13 mesh, 13 primitive, khoảng 56,576 tam giác theo accessor; 3 material, 1 image; khai báo `KHR_mesh_quantization`. Số draw call thật phải lấy `renderer.info`, không suy từ mesh tuyệt đối. File nhỏ không có nghĩa shader/geometry nhẹ.

Video theo dung lượng filesystem làm tròn: `home-bg-desktop.mp4` khoảng 11 MiB; `home-bg-mobile.mp4` khoảng 4.6 MiB. Không dùng kích thước file để kết luận decode time. Model từ CMS có thể khác hoàn toàn GLB mặc định; phải inventory URL, geometry, texture dimensions, materials/extensions trên bản đang bị lag trước khi tối ưu asset.

Ưu tiên tối ưu asset không mất chất lượng: loại dữ liệu không sử dụng, deduplicate, cải thiện index/cache order có kiểm tra. Không tự giảm polygon, bake ánh sáng, đổi material hoặc nén texture mất dữ liệu. Compression tải xuống không tự giảm draw cost và có thêm decode cost.

## 6. Kế hoạch thực hiện theo giai đoạn

| Giai đoạn | Công việc và file trọng tâm | Điều kiện hoàn tất |
| --- | --- | --- |
| 0 — Baseline | Production build; Safari trace và screenshot/video; inventory model CMS; ghi counters tại How/Playground/transition | Có baseline theo thiết bị và từng section, xác định CPU/GPU/copy/layout/load |
| 1 — Sửa liên tục/khởi tạo | `how-models.js`: bỏ active-only culling, warm-up, frame pacing, async cleanup; `home.js`: cache class/metrics khi phù hợp | Cuộn nhanh/ngược không fallback do chưa render, không freeze/nhảy góc, không giảm độ nét |
| 2 — Giảm copy How | Prototype WebGL trực tiếp, viewport/scissor, giữ feature flag cho đường cũ trong quá trình A/B | Tốt hơn baseline cùng chất lượng trên Safari; mọi boundary/drag/scale đạt QA |
| 3 — Transition | `home.js`: gom redraw/resize, benchmark vùng vẽ/pass | Mask và mốc swap đúng ở mọi progress; giảm cost đo được |
| 4 — Playground | `playground-sphere.js`, controller `home.js`: nạp/chuẩn bị có giới hạn, instance updates, context lifecycle | Focus nét, không spike lớn khi vào section, không mất globe vì một ảnh lỗi |
| 5 — Tải phụ | Works desktop, Hero decode, particles và CSS layer theo trace còn lại | Giảm bottleneck còn đo thấy; không đổi animation hoặc hình ảnh |
| 6 — Nghiệm thu | Test lại production trên thiết bị thực, 5 vòng Barba và scroll hai chiều | Đạt tiêu chí bên dưới; báo cáo before/after, commit nhỏ có thể rollback |

Thứ tự có thể đổi sau giai đoạn 0: nếu transition chiếm phần lớn frame time thì làm giai đoạn 3 trước prototype How. Không xây scheduler toàn site hoặc thay thư viện animation trước khi có số liệu.

## 7. Quy trình đo và nghiệm thu

### Thiết bị và tình huống

Safari macOS trên máy đang gặp lỗi; Safari iPhone thật (ghi model, iOS, Safari, DPR, refresh rate, Low Power Mode); thêm thiết bị cấu hình thấp nếu có. Chrome cùng máy chỉ làm đối chứng. Dùng production build, dữ liệu CMS giống nhau, tắt preview/editor khi đo bản khách truy cập. Nếu chạy dev để debug, dùng `astro dev --background` theo AGENTS.md.

Mỗi kịch bản chạy ít nhất ba lần: cold load và warm load; cuộn chậm; fling nhanh rồi đảo chiều; How ở biên hai model; dừng idle 10 giây; How → Playground; focus/thoát focus; xoay màn hình; thanh địa chỉ Safari co/giãn; tab ẩn rồi quay lại; Home → About → Home 5 vòng; rời trang trong lúc asset đang tải. Kiểm tra network chậm/lỗi một asset và reduced motion riêng.

### Bảng số liệu cần điền (chưa đo)

| Section / thiết bị | Frame interval p50/p95/p99 | Frame trễ >2 refresh | JS/layout/paint | GL calls/triangles/textures | Load → first draw | Memory qua 5 vòng |
| --- | --- | --- | --- | --- | --- | --- |
| Hero | Chưa đo | Chưa đo | Chưa đo | N/A | Chưa đo | Chưa đo |
| Works / transition | Chưa đo | Chưa đo | Chưa đo | Canvas calls | Chưa đo | Chưa đo |
| How | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo |
| Playground | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo |

Dùng Safari Web Inspector Timelines (CPU, JavaScript, Layout & Rendering, Frames); ghi `performance` marks quanh init/decode/atlas/compile/render/copy trong bản đo. JS duration của `renderer.render()` không đại diện GPU time; `renderer.info` không báo đầy đủ VRAM. Không log từng frame khi benchmark. Tách nhịp RAF toàn trang và nhịp vẽ How 30fps.

### Tiêu chí nhận thay đổi

- Cùng viewport/DPR/asset/progress: so ảnh tại 0%, 25%, 50%, 75%, 100% timeline, model góc tương ứng và Playground zoom tối đa; kiểm tra viền, độ nét, màu, bóng, crop. Sai số pixel do GPU cần xem bằng mắt, không chỉ dùng ngưỡng diff mù.
- Video kiểm chứng cùng đường scroll: không đổi timing/easing, không freeze model cạnh bên, nhảy góc, pop-in hoặc fallback do culling. Mọi model đã chuẩn bị phải có frame trước khi lộ ra.
- Mục tiêu ở màn 60Hz: render thao tác/scroll tiến tới budget 16.7ms; giảm ít nhất 30% số frame trễ >33.3ms trong đoạn bottleneck so cùng baseline. Đây là mục tiêu, không phải kết quả/cam kết. Nếu không đạt, phân tích trace tiếp; không hạ độ nét để vượt gate.
- Nếu giữ cap How 30fps trong giai đoạn đầu, nhịp cần ổn định gần 33.3ms và không làm scroll trang giật. Phải nêu rõ cap này trong báo cáo, không tính là animation 60fps.
- Không tăng dần renderer/listener/RAF còn sống sau 5 vòng Barba; memory sau cleanup/ổn định không tăng đơn điệu vì tài nguyên cũ còn bị giữ. Không đặt ngưỡng MB tuyệt đối trước khi có thiết bị và baseline.
- Build và lint/check sẵn có phải qua; build thành công không thay thế kiểm tra Safari thật. Chỉ giữ phương án cải thiện số liệu và đạt visual QA. Mỗi giai đoạn có diff độc lập để rollback khi regression.

## 8. Tài liệu tham chiếu

- [WebKit — Timelines Tab](https://webkit.org/web-inspector/timelines-tab/): các timeline và Frames view phục vụ baseline.
- [WebKit — CPU Timeline](https://webkit.org/blog/8993/cpu-timeline-in-web-inspector/): tương quan CPU với JavaScript/layout/render.
- [Three.js — Multiple Canvases, Multiple Scenes](https://threejs.org/manual/pages/multiple-scenes.html): tham khảo một renderer với nhiều vùng hiển thị; không phải bảo đảm phù hợp CSS hiện tại.

Các nguồn hỗ trợ cách đo và phương án kỹ thuật; không chứng minh nguyên nhân lag của site này. Kết luận cuối cần trace thực tế ở giai đoạn 0.
