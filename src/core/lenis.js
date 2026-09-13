import { gsap, ScrollTrigger } from './gsap.js';
import Lenis from 'lenis';
import { distance } from './helpers.js';

export class SmoothScroll {
	constructor() {
		this.lenis = null;
		this.mobile = window.matchMedia('(max-width: 767px)');
		this._onModeChange = () => this.reInit();
		this._nativeOverflow = null;
		this._nativeTween = null;
		this._onNativeScroll = () => {
			if (this.lenis) return;
			const delta = window.scrollY - this.scroller.scrollY;
			this.updateOnScroll({ scroll: window.scrollY, velocity: delta, direction: Math.sign(delta) });
			ScrollTrigger.update();
		};
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
		this.mobile.addEventListener('change', this._onModeChange);
		window.addEventListener('scroll', this._onNativeScroll, { passive: true });

		if (!this._refreshCallback) {
			this._refreshCallback = () => this.lenis?.resize();
			ScrollTrigger.addEventListener('refresh', this._refreshCallback);
		}

		this.reInit();
	}

	reInit() {
		this._nativeTween?.kill();
		if (this._tickerCallback) gsap.ticker.remove(this._tickerCallback);
		this._tickerCallback = null;
		if (this.lenis) {
			this.lenis.off('scroll', this._onLenisScroll);
			this.lenis.destroy();
			this.lenis = null;
		}
		const locked = document.documentElement.classList.contains('is-scroll-locked');
		if (this.mobile.matches) {
			if (locked) this.stop();
			this._onNativeScroll();
			ScrollTrigger.refresh();
			return;
		}
		this.restoreNativeOverflow();

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const useInstantScroll = prefersReducedMotion;

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
		if (locked) this.lenis.stop();
		this._tickerCallback = (time) => this.lenis?.raf(time * 1000);
		gsap.ticker.add(this._tickerCallback);
		gsap.ticker.lagSmoothing(0);
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
		window.dispatchEvent(new CustomEvent('smooth-scroll:update', {
			detail: { ...this.scroller, scroll, limit: this.getLimit() },
		}));
	}

	getScroll() {
		return this.lenis ? this.scroller.scrollY : window.scrollY;
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
		return this.lenis ? !this.lenis.isStopped : !document.documentElement.classList.contains('is-scroll-locked');
	}

	restoreNativeOverflow() {
		if (this._nativeOverflow === null) return;
		document.documentElement.style.overflow = this._nativeOverflow;
		this._nativeOverflow = null;
	}

	start() {
		this.restoreNativeOverflow();
		if (this.lenis) {
			this.lenis.start();
		}
		$(document.documentElement).removeClass(['is-scroll-locked']);
		window.dispatchEvent(new CustomEvent('smooth-scroll:start'));
	}

	stop() {
		if (!this.lenis && this._nativeOverflow === null) {
			this._nativeOverflow = document.documentElement.style.overflow;
			document.documentElement.style.overflow = 'hidden';
		}
		if (this.lenis) {
			this.lenis.stop();
		}
		$(document.documentElement).addClass(['is-scroll-locked']);
		window.dispatchEvent(new CustomEvent('smooth-scroll:stop'));
	}

	scrollTo(target, options = {}) {
		if (this.lenis) {
			this.lenis.scrollTo(target, options);
			return;
		}
		if (!this.isRunning() && !options.force) return;
		let top = target;
		if (target === 'top') top = 0;
		else if (target === 'bottom') top = this.getLimit();
		else {
			const element = typeof target === 'string' ? document.querySelector(target) : target;
			if (element?.getBoundingClientRect) top = element.getBoundingClientRect().top + window.scrollY;
		}
		if (!Number.isFinite(top)) return;
		top = Math.max(0, Math.min(this.getLimit(), top + (options.offset || 0)));
		this._nativeTween?.kill();
		const finish = () => { this._onNativeScroll(); options.onComplete?.(); };
		if (options.immediate || !options.duration) {
			window.scrollTo({ top, behavior: 'instant' });
			finish();
			return;
		}
		const state = { y: window.scrollY };
		this._nativeTween = gsap.to(state, {
			y: top, duration: options.duration, ease: options.easing || 'power2.inOut',
			onUpdate: () => window.scrollTo({ top: state.y, behavior: 'instant' }), onComplete: finish,
		});
	}

	scrollToTop(options = {}) {
		this.scrollTo('top', { duration: 0.0001, immediate: true, lock: true, force: true, ...options });
	}

	destroy() {
		this._nativeTween?.kill();
		this.restoreNativeOverflow();
		this.mobile.removeEventListener('change', this._onModeChange);
		window.removeEventListener('scroll', this._onNativeScroll);
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
		$(document.documentElement).removeClass(['is-scroll-locked']);
	}
}

// Export singleton instance
export const smoothScroll = new SmoothScroll();
