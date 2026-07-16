import { gsap, ScrollTrigger } from './gsap.js';
import Lenis from 'lenis';
import { viewport, distance } from './helpers.js';

export class SmoothScroll {
	constructor() {
		this.lenis = null;
		this._tickerCallback = null;
		this.scroller = {
			scrollX: window.scrollX,
			scrollY: window.scrollY,
			velocity: 0,
			direction: 0,
		};
		this.lastScroller = { ...this.scroller };
	}

	init() {
		this.reInit();

		this._tickerCallback = (time) => {
			if (this.lenis) {
				this.lenis.raf(time * 1000);
			}
		};
		gsap.ticker.add(this._tickerCallback);
		gsap.ticker.lagSmoothing(0);
	}

	reInit(data) {
		if (this.lenis) {
			this.lenis.destroy();
		}

		const CONFIG_INSTANT = {
			lerp: 1,
			duration: 0,
			normalizeWheel: false,
			syncTouch: false,
			smoothWheel: true,
			smoothTouch: false,
		};

		// Trong Astro, ta thường cuộn trên html (document.documentElement)
		const contentEl = document.documentElement;
		const wrapperEl = document.documentElement;

		this.lenis = new Lenis({
			content: contentEl,
			wrapper: wrapperEl,
			syncTouch: false,
			...(viewport.w <= 767 && CONFIG_INSTANT)
		});

		// Re-add ticker if it was removed by destroy()
		if (!this._tickerCallback) {
			this._tickerCallback = (time) => {
				if (this.lenis) {
					this.lenis.raf(time * 1000);
				}
			};
			gsap.ticker.add(this._tickerCallback);
			gsap.ticker.lagSmoothing(0);
		}

		this.lenis.on('scroll', ScrollTrigger.update);
		this.lenis.on('scroll', (e) => {
			this.updateOnScroll(e);
		});

		ScrollTrigger.addEventListener('refresh', () => this.lenis?.resize());
		ScrollTrigger.refresh();
	}

	reachedThreshold(threshold) {
		if (!threshold) return false;
		const dist = distance(
			this.scroller.scrollX,
			this.scroller.scrollY,
			this.lastScroller.scrollX,
			this.lastScroller.scrollY
		);

		if (dist > threshold) {
			this.lastScroller = { ...this.scroller };
			return true;
		}
		return false;
	}

	updateOnScroll(e) {
		this.scroller.scrollX = e.scroll;
		this.scroller.scrollY = e.scroll;
		this.scroller.velocity = e.velocity;
		this.scroller.direction = e.direction;
	}

	start() {
		if (this.lenis) {
			this.lenis.start();
		}
		document.body.style.overflow = "initial";
	}

	stop() {
		if (this.lenis) {
			this.lenis.stop();
		}
		document.body.style.overflow = "hidden";
	}

	scrollTo(target, options = {}) {
		if (this.lenis) {
			this.lenis.scrollTo(target, options);
		}
	}

	scrollToTop(options = {}) {
		if (this.lenis) {
			this.lenis.scrollTo("top", { duration: .0001, immediate: true, lock: true, ...options });
		}
	}

	destroy() {
		if (this._tickerCallback) {
			gsap.ticker.remove(this._tickerCallback);
			this._tickerCallback = null;
		}
		if (this.lenis) {
			this.lenis.destroy();
			this.lenis = null;
		}
	}
}

// Export singleton instance
export const smoothScroll = new SmoothScroll();
