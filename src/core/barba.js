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

	// Giữ CSS của trang cũ cho tới khi leave animation kết thúc. Với sync: true,
	// container cũ và mới cùng tồn tại trong suốt transition.
	const previousSyncedElements = new Set(
		currentHead.querySelectorAll('[data-barba-head]'),
	);

	// Các selector cần sync
	const syncSelectors = [
		'style:not([data-barba-head])',
		'link[rel="stylesheet"]:not([data-barba-head])',
		'meta[name="description"]',
	];

	const loadPromises = [];

	syncSelectors.forEach((selector) => {
		const nextEls = nextHead.querySelectorAll(selector);

		nextEls.forEach((nextEl) => {
			let alreadyExists = false;

			if (nextEl.tagName === 'LINK') {
				const href = nextEl.getAttribute('href');
				const existing = href && currentHead.querySelector(`link[href="${href}"]`);
				if (existing) {
					alreadyExists = true;
					previousSyncedElements.delete(existing);
				}
			} else if (nextEl.tagName === 'STYLE') {
				const content = nextEl.textContent.trim();
				const existingStyles = currentHead.querySelectorAll('style');
				for (const existing of existingStyles) {
					if (existing.textContent.trim() === content) {
						alreadyExists = true;
						previousSyncedElements.delete(existing);
						break;
					}
				}
			} else if (nextEl.tagName === 'META') {
				const name = nextEl.getAttribute('name');
				if (name && currentHead.querySelector(`meta[name="${name}"]`)) {
					// Với thẻ meta, thay vì thêm mới thì cập nhật content của thẻ hiện tại
					const existing = currentHead.querySelector(`meta[name="${name}"]`);
					existing.setAttribute('content', nextEl.getAttribute('content'));
					previousSyncedElements.delete(existing);
					alreadyExists = true;
				}
			}

			if (!alreadyExists) {
				const cloned = nextEl.cloneNode(true);
				cloned.setAttribute('data-barba-head', '');
				
				if (cloned.tagName === 'LINK') {
					loadPromises.push(new Promise((res) => {
						cloned.onload = res;
						cloned.onerror = res; // Proceed even if it fails
					}));
				}
				
				currentHead.appendChild(cloned);
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
	const wrapper = document.querySelector('[data-barba="wrapper"]');
	if (!wrapper) return;

	// Khai báo các Views để tự động gọi setup / destroy dựa vào data-barba-namespace
	const VIEWS = Object.keys(PageManagerRegistry).map((namespace) => ({
		namespace,
		beforeEnter(data) {
			return PageManagerRegistry[namespace].initEnter(data);
		},
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
				sync: true,

				beforeLeave(data) {
					// Đóng menu và transition trang chạy đồng thời.
					globalChange.beforeLeave();
					scrollIndicator.pause();
					buttonText.destroy(data.current.container);
					
					// Dùng transform thay vì absolute để tránh làm vỡ layout (flex/grid) của trang cũ
					let scrollPos = window.scrollY || document.documentElement.scrollTop;
					if (window.innerWidth <= 767) {
						const bodyInner = document.querySelector('.body-inner');
						if (bodyInner && bodyInner.scrollTop > 0) {
							scrollPos = bodyInner.scrollTop;
						}
					}

					data.current.container.style.transform = `translateY(-${scrollPos}px)`;
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

					// Đặt trang mới đè lên trang cũ bằng absolute
					Object.assign(data.next.container.style, {
						position: 'absolute',
						top: '0',
						left: '0',
						width: '100%',
						zIndex: '2',
					});
				},

				async enter(data) {
					// Cập nhật giao diện toàn cục (Header, Nav links...)
					globalChange.update(data);

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
