import { gsap } from './gsap';
import { header } from './components/header';
import { footer } from './components/footer';

export class GlobalChange {
	constructor() {
		this.namespace = null;
	}
	
	init(data) {
		// Gọi một lần duy nhất lúc web load
		if (data && data.next) {
			this.namespace = data.next.namespace;
		}
		
		header.init(data);
		footer.init(data);
		
		this.refreshOnBreakpoint();
	}
	
	update(data) {
		// Gọi mỗi khi chuyển sang trang mới
		this.namespace = data.next.namespace;
		
		header.update(data);
		footer.update(data);
	}
	
	refreshOnBreakpoint() {
		// Tự động reload web khi user kéo màn hình qua điểm giao desktop/mobile
		const breakpoints = [767, 991];
		const initialViewportWidth = window.innerWidth;
		const breakpoint =
			breakpoints.find((bp) => initialViewportWidth < bp) ||
			breakpoints[breakpoints.length - 1];

		let timeoutId = null;
		window.addEventListener("resize", () => {
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
			document.body.style.pointerEvents = 'none';

			this.tlLeave = gsap.timeline({
				onComplete: resolve
			});

			this.tlLeave.fromTo(
				data.current.container,
				{ autoAlpha: 1 },
				{ duration: 0.6, autoAlpha: 0 }
			);
		});
	}
	
	enterAnim(data) {
		return new Promise((resolve) => {
			this.tlEnter = gsap.timeline({
				onComplete: () => {
					// Mở khóa click chuột sau khi chuyển xong
					document.body.style.pointerEvents = '';
					resolve();
				}
			});

			this.tlEnter.fromTo(
				data.next.container,
				{ autoAlpha: 0 },
				{ duration: 0.6, autoAlpha: 1, clearProps: "all" },
				0
			);
		});
	}
}

export const pageTrans = new PageTrans();

// Hàm khởi tạo các sự kiện toàn cục (Ví dụ: Menu mobile toggle, custom cursor, ...)
export function initGlobalInteractions() {
	console.log("🌍 Global interactions initialized");
	// Đặt addEventListener chung ở đây
}
