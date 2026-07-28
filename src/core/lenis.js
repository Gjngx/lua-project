import { gsap, ScrollTrigger } from './gsap.js';
import Lenis from 'lenis';
import { viewport, distance } from './helpers.js';

export class SmoothScroll {
	constructor() {
		this.lenis = null;
		this._tickerCallback = null;
		this._refreshCallback = null;
		this._onLenisScroll = (event) => {
			ScrollTrigger.update();
			this.updateOnScroll(event);
		};
		this.scroller = {
			scrollX: window.scrollX,
			scrollY: window.scrollY,
			velocity: 0,
			direction: 0,
		};
		this.lastScroller = { ...this.scroller };
	}

	init() {
		if (!this._tickerCallback) {
			this._tickerCallback = (time) => {
				this.lenis?.raf(time * 1000);
			};
			gsap.ticker.add(this._tickerCallback);
			gsap.ticker.lagSmoothing(0);
		}

		if (!this._refreshCallback) {
			this._refreshCallback = () => this.lenis?.resize();
			ScrollTrigger.addEventListener('refresh', this._refreshCallback);
		}

		this.reInit();
	}

	reInit() {
		if (this.lenis) {
			this.lenis.off('scroll', this._onLenisScroll);
			this.lenis.destroy();
		}

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const useInstantScroll = viewport.w <= 767 || prefersReducedMotion;

		// Trong Astro, ta thường cuộn trên html (document.documentElement)
		const contentEl = document.documentElement;
		const wrapperEl = document.documentElement;

		this.lenis = new Lenis({
			content: contentEl,
			wrapper: wrapperEl,
			// Lerp cao hơn = phản hồi nhanh hơn, cảm giác scroll nhẹ hơn.
			lerp: useInstantScroll ? 1 : 0.08,
			wheelMultiplier: useInstantScroll ? 1 : 0.85,
			smoothWheel: !useInstantScroll,
			syncTouch: false,
		});

		this.lenis.on('scroll', this._onLenisScroll);
		this.updateOnScroll(this.lenis);
		ScrollTrigger.refresh();
	}

	reachedThreshold(threshold) {
		if (!threshold) return false;
		const dist = distance(
			this.scroller.scrollX,
			this.scroller.scrollY,
			this.lastScroller.scrollX,
			this.lastScroller.scrollY,
		);

		if (dist > threshold) {
			this.lastScroller = { ...this.scroller };
			return true;
		}
		return false;
	}

	updateOnScroll(e) {
		const scroll = Number.isFinite(e?.scroll) ? e.scroll : window.scrollY;
		this.scroller.scrollX = window.scrollX;
		this.scroller.scrollY = scroll;
		this.scroller.velocity = Number.isFinite(e?.velocity) ? e.velocity : 0;
		this.scroller.direction = Number.isFinite(e?.direction) ? e.direction : 0;
	}

	getScroll() {
		return this.scroller.scrollY;
	}

	getLimit() {
		if (Number.isFinite(this.lenis?.limit)) {
			return Math.max(0, this.lenis.limit);
		}
		return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
	}

	getVelocity() {
		return this.scroller.velocity;
	}

	isRunning() {
		return Boolean(this.lenis && !this.lenis.isStopped);
	}

	start() {
		if (this.lenis) {
			this.lenis.start();
		}
		document.documentElement.classList.remove('is-scroll-locked');
		window.dispatchEvent(new CustomEvent('smooth-scroll:start'));
	}

	stop() {
		if (this.lenis) {
			this.lenis.stop();
		}
		document.documentElement.classList.add('is-scroll-locked');
		window.dispatchEvent(new CustomEvent('smooth-scroll:stop'));
	}

	scrollTo(target, options = {}) {
		if (this.lenis) {
			this.lenis.scrollTo(target, options);
		}
	}

	scrollToTop(options = {}) {
		if (this.lenis) {
			this.lenis.scrollTo('top', { duration: 0.0001, immediate: true, lock: true, ...options });
		}
	}

	destroy() {
		if (this._tickerCallback) {
			gsap.ticker.remove(this._tickerCallback);
			this._tickerCallback = null;
		}
		if (this._refreshCallback) {
			ScrollTrigger.removeEventListener('refresh', this._refreshCallback);
			this._refreshCallback = null;
		}
		if (this.lenis) {
			this.lenis.off('scroll', this._onLenisScroll);
			this.lenis.destroy();
			this.lenis = null;
		}
		document.documentElement.classList.remove('is-scroll-locked');
	}
}

// Export singleton instance
export const smoothScroll = new SmoothScroll();
