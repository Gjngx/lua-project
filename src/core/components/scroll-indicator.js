import { ScrollTrigger } from '../gsap.js';
import { smoothScroll } from '../lenis.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

class ScrollIndicator {
	constructor() {
		this.el = null;
		this.thumb = null;
		this.lenis = null;
		this.initialized = false;
		this.enabled = false;
		this.paused = false;

		this.viewportHeight = 0;
		this.limit = 0;
		this.thumbHeight = 44;
		this.maxTravel = 0;
		this.currentY = 0;
		this.targetY = 0;
		this.currentStretch = 1;
		this.targetStretch = 1;
		this.lastScroll = 0;
		this.lastInputTime = 0;
		this.lastFrameTime = 0;
		this.lastThemeUpdate = 0;
		this.rafId = 0;
		this.hideTimer = 0;

		this.finePointerQuery = null;
		this.reducedMotionQuery = null;

		this.onLenisScroll = (event) => this.handleScroll(event);
		this.onResize = () => this.refresh();
		this.onRefresh = () => this.refresh();
		this.onCapabilityChange = () => this.refresh({ immediate: true });
		this.onScrollStop = () => this.hideImmediately();
		this.render = (time) => this.renderFrame(time);
	}

	init() {
		if (this.initialized) return;

		this.el = $('[data-scroll-indicator]')[0];
		this.thumb = $(this.el).find('[data-scroll-indicator-thumb]')[0];
		if (!this.el || !this.thumb) return;

		this.initialized = true;
		this.finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
		this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

		this.finePointerQuery.addEventListener('change', this.onCapabilityChange);
		this.reducedMotionQuery.addEventListener('change', this.onCapabilityChange);
		$(window).on('resize', this.onResize);
		$(window).on('smooth-scroll:stop', this.onScrollStop);
		ScrollTrigger.addEventListener('refresh', this.onRefresh);

		this.bindLenis(smoothScroll.lenis);
		this.refresh({ immediate: true });

		document.fonts?.ready.then(() => this.refresh());
	}

	bindLenis(lenis) {
		if (this.lenis === lenis) return;
		this.lenis?.off('scroll', this.onLenisScroll);
		this.lenis = lenis;
		this.lenis?.on('scroll', this.onLenisScroll);
	}

	canEnable() {
		return Boolean(
			this.finePointerQuery?.matches &&
			!this.reducedMotionQuery?.matches &&
			window.innerWidth > 767 &&
			this.limit > 1,
		);
	}

	setEnabled(enabled) {
		if (this.enabled === enabled) return;
		this.enabled = enabled;
		$(document.documentElement).toggleClass('has-custom-scrollbar', enabled);

		if (!enabled) {
			$(this.el).removeClass(['is-active']);
			this.stopAnimation();
		}
	}

	refresh({ immediate = false } = {}) {
		if (!this.initialized) return;

		this.bindLenis(smoothScroll.lenis);
		this.lenis?.resize();

		this.viewportHeight = window.innerHeight;
		this.limit = smoothScroll.getLimit();
		const documentHeight = this.limit + this.viewportHeight;
		this.thumbHeight = Math.max(
			44,
			this.viewportHeight * (this.viewportHeight / Math.max(1, documentHeight)),
		);
		this.maxTravel = Math.max(0, this.viewportHeight - this.thumbHeight);
		this.thumb.style.height = `${this.thumbHeight.toFixed(2)}px`;

		this.setEnabled(this.canEnable());
		this.updateTarget(smoothScroll.getScroll());
		this.updateTheme(true);

		if (immediate) {
			this.currentY = this.targetY;
			this.currentStretch = 1;
			this.targetStretch = 1;
			this.applyTransform();
		} else {
			this.startAnimation();
		}
	}

	updateTarget(scroll) {
		const progress = this.limit > 0 ? clamp(scroll / this.limit, 0, 1) : 0;
		this.targetY = progress * this.maxTravel;
	}

	handleScroll(event) {
		if (!this.enabled || this.paused) return;

		const now = performance.now();
		const scroll = Number.isFinite(event?.scroll) ? event.scroll : smoothScroll.getScroll();
		const nextLimit = Number.isFinite(event?.limit) ? event.limit : smoothScroll.getLimit();

		if (Math.abs(nextLimit - this.limit) > 1) {
			this.limit = Math.max(0, nextLimit);
			const documentHeight = this.limit + this.viewportHeight;
			this.thumbHeight = Math.max(
				44,
				this.viewportHeight * (this.viewportHeight / Math.max(1, documentHeight)),
			);
			this.maxTravel = Math.max(0, this.viewportHeight - this.thumbHeight);
			this.thumb.style.height = `${this.thumbHeight.toFixed(2)}px`;
		}

		this.updateTarget(scroll);

		const deltaTime = this.lastInputTime ? Math.max(1, now - this.lastInputTime) : 16.67;
		const speed = Math.abs(scroll - this.lastScroll) / deltaTime;
		this.targetStretch = 1 + Math.min(0.7, speed * 0.35);
		this.lastScroll = scroll;
		this.lastInputTime = now;

		this.show();
		this.updateTheme();
		this.startAnimation();
	}

	show() {
		window.clearTimeout(this.hideTimer);
		$(this.el).addClass(['is-active']);
		this.hideTimer = window.setTimeout(() => {
			$(this.el).removeClass(['is-active']);
			this.targetStretch = 1;
			this.startAnimation();
		}, 900);
	}

	hideImmediately() {
		window.clearTimeout(this.hideTimer);
		$(this.el).removeClass(['is-active']);
		this.targetStretch = 1;
		this.currentStretch = 1;
		this.applyTransform();
	}

	updateTheme(force = false) {
		const now = performance.now();
		if (!force && now - this.lastThemeUpdate < 100) return;
		this.lastThemeUpdate = now;

		const probeY = window.innerHeight * 0.5;
		let theme = 'light';
		const sections = $('[data-section]').toArray();

		for (const section of sections) {
			const rect = section.getBoundingClientRect();
			if (rect.top <= probeY && rect.bottom >= probeY) {
				theme = $(section).attr('data-section') || 'light';
			}
		}

		this.el.dataset.theme = theme;
	}

	startAnimation() {
		if (!this.enabled || this.paused || this.rafId) return;
		this.lastFrameTime = 0;
		this.rafId = requestAnimationFrame(this.render);
	}

	stopAnimation() {
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = 0;
		}
		this.lastFrameTime = 0;
	}

	renderFrame(time) {
		this.rafId = 0;
		if (!this.enabled || this.paused) return;

		const deltaTime = this.lastFrameTime ? clamp(time - this.lastFrameTime, 1, 64) : 16.67;
		this.lastFrameTime = time;

		if (this.lastInputTime && time - this.lastInputTime > 80) {
			this.targetStretch = 1;
		}

		const positionAlpha = 1 - Math.pow(1 - 0.22, (deltaTime * 60) / 1000);
		const stretchAlpha = 1 - Math.pow(1 - 0.18, (deltaTime * 60) / 1000);
		this.currentY += (this.targetY - this.currentY) * positionAlpha;
		this.currentStretch += (this.targetStretch - this.currentStretch) * stretchAlpha;

		if (Math.abs(this.targetY - this.currentY) < 0.05) {
			this.currentY = this.targetY;
		}
		if (Math.abs(this.targetStretch - this.currentStretch) < 0.005) {
			this.currentStretch = this.targetStretch;
		}

		this.applyTransform();

		const isSettling =
			Math.abs(this.targetY - this.currentY) > 0.05 ||
			Math.abs(this.targetStretch - this.currentStretch) > 0.005;
		if (isSettling) {
			this.rafId = requestAnimationFrame(this.render);
		}
	}

	applyTransform() {
		const y = clamp(this.currentY, 0, this.maxTravel);
		this.thumb.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scaleY(${this.currentStretch.toFixed(3)})`;
	}

	reset({ immediate = true } = {}) {
		if (!this.initialized) return;
		window.clearTimeout(this.hideTimer);
		$(this.el).removeClass(['is-active']);
		this.lastScroll = 0;
		this.lastInputTime = 0;
		this.targetStretch = 1;
		this.refresh({ immediate });
	}

	pause() {
		if (!this.initialized) return;
		this.paused = true;
		window.clearTimeout(this.hideTimer);
		$(this.el).removeClass(['is-active']);
		this.stopAnimation();
		$(document.documentElement).addClass(['is-page-transitioning']);
	}

	resume() {
		if (!this.initialized) return;
		this.paused = false;
		$(document.documentElement).removeClass(['is-page-transitioning']);
		requestAnimationFrame(() => this.refresh({ immediate: true }));
	}

	destroy() {
		if (!this.initialized) return;
		window.clearTimeout(this.hideTimer);
		this.stopAnimation();
		this.lenis?.off('scroll', this.onLenisScroll);
		this.finePointerQuery?.removeEventListener('change', this.onCapabilityChange);
		this.reducedMotionQuery?.removeEventListener('change', this.onCapabilityChange);
		$(window).off('resize', this.onResize);
		$(window).off('smooth-scroll:stop', this.onScrollStop);
		ScrollTrigger.removeEventListener('refresh', this.onRefresh);
		$(document.documentElement).removeClass(['has-custom-scrollbar', 'is-page-transitioning']);
		this.initialized = false;
	}
}

export const scrollIndicator = new ScrollIndicator();
