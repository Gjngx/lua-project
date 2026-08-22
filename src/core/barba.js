import barba from '@barba/core';
import { PageManagerRegistry } from './page-managers';
import { globalChange, pageTrans } from './global-scripts';
import { scrollTop } from './scroll.js';
import { scrollIndicator } from './components/scroll-indicator.js';
import { buttonText } from './components/button-text.js';
import { loader } from './loader.js';
import { ScrollTrigger } from './gsap.js';
import { smoothScroll } from './lenis.js';

let staleHeadElements = [];

/**
 * Hàm đồng bộ thẻ <head> khi chuyển trang bằng Barba.
 * Đảm bảo các <style>, <link stylesheet>, và <meta> mới được thêm vào,
 * và dọn dẹp các thẻ cũ của trang trước.
 */
function syncHead(data) {
	return new Promise((resolve) => {
		const nextHtml = data.next.html;
		if (!nextHtml) return resolve();

	const parser = new DOMParser();
	const nextDoc = parser.parseFromString(nextHtml, 'text/html');
	const nextHead = nextDoc.head;
	const currentHead = document.head;

	// Giữ CSS của trang cũ cho tới khi toàn bộ transition hoàn tất, sau đó
	// cleanupStaleHead() sẽ dọn các style không còn dùng.
	const previousSyncedElements = new Set(
		$(currentHead).find('[data-barba-head]').toArray(),
	);

	// Các selector cần sync
	const syncSelectors = [
		'style:not([data-barba-head])',
		'link[rel="stylesheet"]:not([data-barba-head])',
		'meta[name="description"]',
	];

	const loadPromises = [];

	syncSelectors.forEach((selector) => {
		const nextEls = $(nextHead).find(selector).toArray();

		nextEls.forEach((nextEl) => {
			let alreadyExists = false;

			if (nextEl.tagName === 'LINK') {
				const href = $(nextEl).attr('href');
				const existing = href && $(currentHead).find(`link[href="${href}"]`)[0];
				if (existing) {
					alreadyExists = true;
					previousSyncedElements.delete(existing);
				}
			} else if (nextEl.tagName === 'STYLE') {
				const content = $(nextEl).text().trim();
				const existingStyles = $(currentHead).find('style').toArray();
				for (const existing of existingStyles) {
					if ($(existing).text().trim() === content) {
						alreadyExists = true;
						previousSyncedElements.delete(existing);
						break;
					}
				}
			} else if (nextEl.tagName === 'META') {
				const name = $(nextEl).attr('name');
				if (name && $(currentHead).find(`meta[name="${name}"]`)[0]) {
					// Với thẻ meta, thay vì thêm mới thì cập nhật content của thẻ hiện tại
					const existing = $(currentHead).find(`meta[name="${name}"]`)[0];
					$(existing).attr('content', $(nextEl).attr('content'));
					previousSyncedElements.delete(existing);
					alreadyExists = true;
				}
			}

			if (!alreadyExists) {
				const cloned = nextEl.cloneNode(true);
				$(cloned).attr('data-barba-head', '');
				
				if (cloned.tagName === 'LINK') {
					loadPromises.push(new Promise((res) => {
						cloned.onload = res;
						cloned.onerror = res; // Proceed even if it fails
					}));
				}
				
				$(currentHead).append(cloned);
			}
		});
	});

	staleHeadElements = Array.from(previousSyncedElements);

	// Cập nhật title của document
	const newTitle = nextDoc.title;
	if (newTitle) {
		document.title = newTitle;
	}

	Promise.all(loadPromises).then(resolve);
	});
}

function cleanupStaleHead() {
	staleHeadElements.forEach((el) => el.remove());
	staleHeadElements = [];
}

/**
 * Khởi tạo Barba.js
 */
export function initBarba() {
	const wrapper = $('[data-barba="wrapper"]')[0];
	if (!wrapper) return;

	// View chỉ chịu trách nhiệm cleanup. Setup/play được transition điều phối
	// riêng để initial load không chạy đồng thời cả enter và once.
	const VIEWS = Object.keys(PageManagerRegistry).map((namespace) => ({
		namespace,
		beforeLeave(data) {
			PageManagerRegistry[namespace].destroy(data);
		},
	}));

	barba.init({
		// Home có module hình ảnh/WebGL lớn; dev server có thể cần hơn 5 giây
		// cho lần compile đầu tiên. Tránh để Barba fallback sang hard navigation.
		timeout: 5000,
		views: VIEWS,
		prevent: ({ el, event }) => {
			// Chặn click vào link của trang hiện tại (không cho Barba và trình duyệt reload)
			if (el.href === window.location.href) {
				event.preventDefault();
				return true;
			}
			return false;
		},
		transitions: [
			{
				name: 'gsap-transition',
				// Chạy tuần tự: trang cũ leave xong rồi trang mới mới enter.
				sync: false,

				beforeLeave(data) {
					// Đóng menu và transition trang chạy đồng thời.
					globalChange.beforeLeave();
					scrollIndicator.pause();
					buttonText.destroy(data.current.container);
					
					// Dùng transform thay vì absolute để tránh làm vỡ layout (flex/grid) của trang cũ
					let scrollPos = window.scrollY || document.documentElement.scrollTop;
					if (window.innerWidth <= 767) {
						const bodyInner = $('.body-inner')[0];
						if (bodyInner && bodyInner.scrollTop > 0) {
							scrollPos = bodyInner.scrollTop;
						}
					}

					$(data.current.container).css('transform', `translateY(-${scrollPos}px)`);
				},

				async once(data) {
					// Chạy 1 lần duy nhất khi web vừa mới bật lên
					globalChange.init(data);
					await loader.init(data);
					loader.play();
				},

				async leave(data) {
					// Chạy animation rời trang được tách ra ở class PageTrans
					await pageTrans.leaveAnim(data);
				},

				async beforeEnter(data) {
					// Cuộn lên đầu trang mượt mà hoặc ngay lập tức
					scrollTop();
					scrollIndicator.reset({ immediate: true });

					// Chạy hàm sync thẻ <head>
					await syncHead(data);

					// Giữ trang mới ổn định trong lúc chạy enter animation.
					Object.assign(data.next.container.style, {
						position: 'absolute',
						top: '0',
						left: '0',
						width: '100%',
						zIndex: '2',
					});

					// Dựng DOM, split text và timeline khi transition vẫn đang che trang.
					await PageManagerRegistry[data.next.namespace]?.prepareEnter(data);
				},

				async enter(data) {
					// Cập nhật giao diện toàn cục (Header, Nav links...)
					globalChange.update(data);
					PageManagerRegistry[data.next.namespace]?.playEnter(data);

					// Chạy animation vào trang được tách ra ở class PageTrans
					await pageTrans.enterAnim(data);
				},

				after(data) {
					// Gỡ bỏ absolute của trang mới để đưa nó về normal flow
					Object.assign(data.next.container.style, {
						position: '',
						top: '',
						left: '',
						width: '',
						zIndex: '',
					});

					cleanupStaleHead();
					scrollIndicator.resume();
					// Đợi trình duyệt render xong layout cuối (khi container cũ đã bị gỡ)
					requestAnimationFrame(() => {
						ScrollTrigger.refresh();
						// Kích hoạt resize để WebGL/Canvas đo lại đúng kích thước
						window.dispatchEvent(new Event('resize'));
					});
				},
			},
		],
	});
}
