import { gsap } from './gsap';
import { header } from './components/header';
import { audioManager } from './components/audio';
import { buttonText } from './components/button-text';

export class GlobalChange {
	constructor() {
		this.namespace = null;
	}
	
	init(data) {
		// Gọi một lần duy nhất lúc web load
		if (data && data.next) {
			this.namespace = data.next.namespace;
		}
		
		audioManager.init();
		
		header.init(data);
		buttonText.mount(document);
		
		this.refreshOnBreakpoint();
	}
	
	update(data) {
		// Gọi mỗi khi chuyển sang trang mới
		this.namespace = data.next.namespace;
		
		header.update(data);
		buttonText.mount(data.next.container);
	}

	beforeLeave() {
		header.closeForNavigation();
	}
	
	refreshOnBreakpoint() {
		// Tự động reload web khi user kéo màn hình qua điểm giao desktop/mobile
		const breakpoints = [767, 991];
		const initialViewportWidth = window.innerWidth;
		const breakpoint =
			breakpoints.find((bp) => initialViewportWidth < bp) ||
			breakpoints[breakpoints.length - 1];

		let timeoutId = null;
		$(window).on("resize", () => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				const newViewportWidth = window.innerWidth;
				if (
					(initialViewportWidth < breakpoint && newViewportWidth >= breakpoint) ||
					(initialViewportWidth >= breakpoint && newViewportWidth < breakpoint)
				) {
					// location.reload(); // Bỏ comment dòng này nếu muốn dùng tính năng này
				}
			}, 250);
		});
	}
}

export const globalChange = new GlobalChange();

export class PageTrans {
	constructor() {
		this.tlLeave = null;
		this.tlEnter = null;
	}
	
	leaveAnim(data) {
		return new Promise((resolve) => {
			// Khóa click chuột trong lúc chuyển trang
			$(document.body).css('pointer-events', 'none');

			this.tlLeave = gsap.timeline({
				onComplete: resolve
			});

			this.tlLeave.fromTo(
				data.current.container,
				{ autoAlpha: 1 },
				{ duration: 0.6, autoAlpha: 0 }
			);

			if (data.current.namespace === 'home') {
				this.tlLeave.to(
					$('.header-logo-ic-amin')[0],
					{ duration: 0.6, autoAlpha: 0 },
					0,
				);
			}
		});
	}
	
	enterAnim(data) {
		return new Promise((resolve) => {
			this.tlEnter = gsap.timeline({
				onComplete: () => {
					// Mở khóa click chuột sau khi chuyển xong
					$(document.body).css('pointer-events', '');
					resolve();
				}
			});

			this.tlEnter.fromTo(
				data.next.container,
				{ autoAlpha: 0 },
				{ duration: 0.6, autoAlpha: 1, clearProps: "all" },
				0
			);

			if (data.next.namespace === 'home') {
				this.tlEnter.fromTo(
					$('.header-logo-ic-amin')[0],
					{ autoAlpha: 0 },
					{
						duration: 0.6,
						autoAlpha: 1,
						clearProps: 'opacity,visibility',
					},
					0,
				);
			}
		});
	}
}

export const pageTrans = new PageTrans();

// Hàm khởi tạo các sự kiện toàn cục (Ví dụ: Menu mobile toggle, custom cursor, ...)
export function initGlobalInteractions() {
	console.log("🌍 Global interactions initialized");
	// Đặt addEventListener chung ở đây
}
