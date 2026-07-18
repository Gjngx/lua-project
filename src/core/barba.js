import barba from '@barba/core';
import { PageManagerRegistry } from './page-managers';
import { globalChange, pageTrans } from './global-scripts';
import { scrollTop } from './scroll.js';

/**
 * Hàm đồng bộ thẻ <head> khi chuyển trang bằng Barba.
 * Đảm bảo các <style>, <link stylesheet>, và <meta> mới được thêm vào,
 * và dọn dẹp các thẻ cũ của trang trước.
 */
function syncHead(data) {
	const nextHtml = data.next.html;
	if (!nextHtml) return;

	const parser = new DOMParser();
	const nextDoc = parser.parseFromString(nextHtml, 'text/html');
	const nextHead = nextDoc.head;
	const currentHead = document.head;

	// Xóa các tag cũ đã được thêm bởi lần sync trước
	currentHead.querySelectorAll('[data-barba-head]').forEach(el => el.remove());

	// Các selector cần sync
	const syncSelectors = [
		'style:not([data-barba-head])',
		'link[rel="stylesheet"]:not([data-barba-head])',
		'meta[name="description"]'
	];

	syncSelectors.forEach(selector => {
		const nextEls = nextHead.querySelectorAll(selector);

		nextEls.forEach(nextEl => {
			let alreadyExists = false;

			if (nextEl.tagName === 'LINK') {
				const href = nextEl.getAttribute('href');
				if (href && currentHead.querySelector(`link[href="${href}"]`)) {
					alreadyExists = true;
				}
			} else if (nextEl.tagName === 'STYLE') {
				const content = nextEl.textContent.trim();
				const existingStyles = currentHead.querySelectorAll('style:not([data-barba-head])');
				for (const existing of existingStyles) {
					if (existing.textContent.trim() === content) {
						alreadyExists = true;
						break;
					}
				}
			} else if (nextEl.tagName === 'META') {
				const name = nextEl.getAttribute('name');
				if (name && currentHead.querySelector(`meta[name="${name}"]`)) {
					// Với thẻ meta, thay vì thêm mới thì cập nhật content của thẻ hiện tại
					currentHead.querySelector(`meta[name="${name}"]`).setAttribute('content', nextEl.getAttribute('content'));
					alreadyExists = true;
				}
			}

			if (!alreadyExists) {
				const cloned = nextEl.cloneNode(true);
				cloned.setAttribute('data-barba-head', '');
				currentHead.appendChild(cloned);
			}
		});
	});

	// Cập nhật title của document
	const newTitle = nextDoc.title;
	if (newTitle) {
		document.title = newTitle;
	}
}

/**
 * Khởi tạo Barba.js
 */
export function initBarba() {
	const wrapper = document.querySelector('[data-barba="wrapper"]');
	if (!wrapper) return;

	// Khai báo các Views để tự động gọi setup / destroy dựa vào data-barba-namespace
	const VIEWS = Object.keys(PageManagerRegistry).map(namespace => ({
		namespace,
		beforeEnter(data) { PageManagerRegistry[namespace].initEnter(data); },
		beforeLeave(data) { PageManagerRegistry[namespace].destroy(data); }
	}));

	barba.init({
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
				name: "gsap-transition",
				sync: true,
				
				once(data) {
					// Chạy 1 lần duy nhất khi web vừa mới bật lên
					globalChange.init(data);
					const namespace = data.next.namespace;
					if (PageManagerRegistry[namespace]) {
						PageManagerRegistry[namespace].initOnce(data);
					}
				},

				async leave(data) {
					// Chạy animation rời trang được tách ra ở class PageTrans
					await pageTrans.leaveAnim(data);
				},
				
				async beforeEnter(data) {
					// Cuộn lên đầu trang mượt mà hoặc ngay lập tức
					scrollTop();
					
					// Chạy hàm sync thẻ <head>
					syncHead(data);
				},
				
				async enter(data) {
					// Cập nhật giao diện toàn cục (Header, Nav links...)
					globalChange.update(data);
					
					// Chạy animation vào trang được tách ra ở class PageTrans
					await pageTrans.enterAnim(data);
				}
			},
		],
	});
}
