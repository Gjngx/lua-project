import { gsap } from '../gsap';
import { smoothScroll } from '../lenis';
import { viewport, cvUnit } from '../helpers';
import { audioManager } from './audio';
import Lenis from 'lenis';

export class Header {
	constructor() {
		this.el = null;
		this.isOpen = false;
		this.listDependent = [];
		this.currentMode = null;
		this.currentData = null;
		this.onScroll = null;
		this.tlNav = null;
		this.tlNameLoop = null;
		this.navLenis = null;
		this.headerResizeObserver = null;
		this.headerMetrics = {
			outerHeight: 0,
			innerHeight: 0,
		};
	}

	init(data) {
		this.el = document.querySelector(".header");
		if (!this.el) return;

		this.setupHeaderMetrics();
		this.toggleNav();
		this.setupNavScroll();
		this.setupScrollListener(data);
	}

	setupHeaderMetrics() {
		const headerInner = this.el?.querySelector('.header-inner');
		if (!this.el || !headerInner) return;

		const updateMetrics = () => {
			this.headerMetrics.outerHeight = this.el.offsetHeight;
			this.headerMetrics.innerHeight = headerInner.offsetHeight;
		};

		updateMetrics();
		if (this.headerResizeObserver) return;

		this.headerResizeObserver = new ResizeObserver(updateMetrics);
		this.headerResizeObserver.observe(this.el);
		this.headerResizeObserver.observe(headerInner);
	}

	setupNavScroll() {
		const wrapper = this.el.querySelector('.header-nav');
		const content = this.el.querySelector('.header-nav-inner');
		if (!wrapper || !content || this.navLenis) return;

		this.navLenis = new Lenis({
			wrapper,
			content,
			autoRaf: true,
			lerp: 0.1,
			wheelMultiplier: 0.85,
			smoothWheel: true,
			syncTouch: false
		});
		this.navLenis.stop();
	}

	// ─── Scroll Listener ──────────────────────────────────────────────
	setupScrollListener(data) {
		if (data) this.currentData = data;
		if (!this.onScroll) {
			this.onScroll = (inst) => {
				this.updateOnScroll(inst, this.currentData);
			};
		}
		if (smoothScroll.lenis) {
			smoothScroll.lenis.off('scroll', this.onScroll);
			smoothScroll.lenis.on('scroll', this.onScroll);
		}
	}

	// ─── Update (gọi mỗi khi chuyển trang qua Barba) ─────────────────
	update(data) {
		if (!this.el) return;
		this.setupScrollListener(data);
		this.updateOnScroll(smoothScroll.lenis, data);
		this.toggleMode();
	}

	// ─── Scroll Callbacks ─────────────────────────────────────────────
	updateOnScroll(inst, data) {
		if (!inst) return;
		this.toggleHide(inst);
		this.toggleScroll(inst, data);
		this.toggleMode();
		this.onHideDependent();
	}

	/**
	 * Thêm class `on-scroll` khi scroll qua ngưỡng (2x header height)
	 */
	toggleScroll(inst, data) {
		if (!inst || !this.el) return;
		const headerHeight = this.headerMetrics.outerHeight;
		if (inst.scroll > headerHeight * 2) {
			this.el.classList.add("on-scroll");
		} else {
			this.el.classList.remove("on-scroll");
		}
	}

	/**
	 * Ẩn/Hiện header khi scroll lên/xuống
	 */
	toggleHide(inst) {
		if (!inst || !this.el) return;
		const headerHeight = this.headerMetrics.outerHeight;

		if (inst.scroll <= headerHeight * 3) {
			this.el.classList.remove("on-hide");
		} else if (inst.direction == 1) {
			// Scroll xuống → ẩn header
			this.el.classList.add("on-hide");
		} else if (inst.direction == -1) {
			// Scroll lên → hiện header
			this.el.classList.remove("on-hide");
		}
	}

	/**
	 * Đổi mode class (on-dark, on-light, v.v.) dựa trên section đang hiển thị
	 * Section cần có attribute `data-section="dark"` hoặc `data-section="light"`
	 */
	toggleMode() {
		const section = this.getCurrentSection('[data-section]');
		const mode = section ? section.getAttribute('data-section') : null;
		if (this.currentMode === mode) return;

		this.currentMode = mode;

		// Xóa tất cả on-* class trừ on-scroll, on-hide, on-open-nav
		const classes = Array.from(this.el.classList);
		const modeClasses = classes.filter(cls =>
			cls.startsWith('on-') &&
			cls !== 'on-scroll' &&
			cls !== 'on-hide' &&
			cls !== 'on-open-nav' &&
			cls !== 'on-loader'
		);
		modeClasses.forEach(cls => this.el.classList.remove(cls));

		// Thêm mode class mới
		if (mode) {
			this.el.classList.add(`on-${mode}`);
		}
	}

	/**
	 * Tìm section hiện đang nằm ở vùng header
	 */
	getCurrentSection(attribute, offset = cvUnit(25, "rem")) {
		const sections = document.querySelectorAll(attribute);
		let matchedSection = null;
		const headerHeight = this.headerMetrics.innerHeight;

		for (let i = 0; i < sections.length; i++) {
			const rect = sections[i].getBoundingClientRect();
			if (
				rect.top < headerHeight + offset &&
				rect.bottom - headerHeight * 0.5 - offset > 0
			) {
				matchedSection = sections[i];
			}
		}
		return matchedSection;
	}

	// ─── Dependent Elements (các phần tử phụ thuộc vào header hide/show) ──
	onHideDependent() {
		if (!this.listDependent.length) return;

		const heightHeader = this.headerMetrics.innerHeight;

		if (!this.el.classList.contains('on-hide')) {
			this.listDependent.forEach((entry) => {
				const el = entry.el || entry;
				const offset = entry.offset || 0;
				const nextTop = `${heightHeader - offset}px`;
				if (entry.currentTop === nextTop) return;
				el.style.top = nextTop;
				if (entry.el) entry.currentTop = nextTop;
			});
		} else {
			this.listDependent.forEach((entry) => {
				const el = entry.el || entry;
				const defaultTop = entry.defaultTop !== undefined ? entry.defaultTop : 0;
				const nextTop = `${defaultTop}px`;
				if (entry.currentTop === nextTop) return;
				el.style.top = nextTop;
				if (entry.el) entry.currentTop = nextTop;
			});
		}
	}

	registerDependent(dependentEl, offset = 0, defaultTop = 0) {
		this.listDependent.push({ el: dependentEl, offset, defaultTop, currentTop: null });
	}

	unregisterDependent(dependentEl) {
		this.listDependent = this.listDependent.filter((entry) => {
			const el = entry.el || entry;
			return el !== dependentEl;
		});
	}

	// ─── Nav Toggle ──────────────────────────────────────────────────
	toggleNav() {
		const toggles = this.el.querySelectorAll(".header-menu-toggle");
		toggles.forEach(btn => {
			btn.addEventListener("click", this.handleClick.bind(this));
		});

		this.el.querySelectorAll('.header-nav a').forEach(link => {
			link.addEventListener('click', () => {
				if (this.isOpen) this.close();
			});
		});

		const audioToggle = this.el.querySelector('[data-header-next]');
		if (audioToggle) {
			audioToggle.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				audioManager.next();
			});

			this.updateTrackTitle(audioManager.currentTrack);
			window.addEventListener('audio:track-change', (e) => {
				this.updateTrackTitle(e.detail.track);
			});
		}

		const audioPlayPause = this.el.querySelector('[data-header-play]');
		if (audioPlayPause) {
			audioPlayPause.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				audioManager.toggle();
			});

			const updateAudioControl = (isPlaying) => {
				audioPlayPause.setAttribute('aria-pressed', String(isPlaying));
				audioPlayPause.setAttribute('aria-label', isPlaying ? 'Pause music' : 'Play music');
			};

			updateAudioControl(audioManager.isPlaying);
			window.addEventListener('audio:state-change', (e) => {
				updateAudioControl(e.detail.isPlaying);
			});
		}

		// Đóng khi click ra ngoài
		document.addEventListener('click', (e) => {
			if (!this.isOpen) return;
			if (
				e.target.closest('.header-menu-toggle') ||
				e.target.closest('.header-logo') ||
				e.target.closest('.header-inner')
			) return;
			this.close();
		});

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.isOpen) this.close();
		});
	}

	updateTrackTitle(track) {
		if (!track?.title || !this.el) return;

		this.el.querySelectorAll('[data-header-name-text]').forEach((text) => {
			text.textContent = track.title;
		});

		if (this.isOpen) {
			requestAnimationFrame(() => this.startNameLoop());
		}
	}

	handleClick(e) {
		e.preventDefault();
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	open() {
		if (this.isOpen || !this.el) return;
		this.el.classList.add("on-open-nav");
		this.el.querySelector('.header-nav')?.setAttribute('aria-hidden', 'false');
		this.el.querySelectorAll(".header-menu-toggle").forEach(el => {
			el.classList.add("active");
			el.setAttribute('aria-expanded', 'true');
			el.setAttribute('aria-label', 'Close navigation');
		});
		this.isOpen = true;
		if (smoothScroll) smoothScroll.stop();

		this._savedScrollY = window.scrollY;
		this._preventTouch = (e) => {
			if (!e.target.closest('.header-nav')) e.preventDefault();
		};
		document.addEventListener('touchmove', this._preventTouch, { passive: false });

		this.navLenis?.start();
		requestAnimationFrame(() => this.navLenis?.resize());
		this.animateNavOpen();
	}

	close() {
		if (!this.isOpen || !this.el) return;
		this.isOpen = false;

		if (this._preventTouch) {
			document.removeEventListener('touchmove', this._preventTouch);
			this._preventTouch = null;
		}

		if (smoothScroll) smoothScroll.start();
		this.navLenis?.stop();

		this.animateNavClose();
	}

	// ─── Nav Animations ──────────────────────────────────────────────
	animateNavOpen() {
		if (this.tlNav) this.tlNav.kill();
		const shapeIc = this.el.querySelector('[data-header-play]');
		const shapeText = this.el.querySelector('[data-header-audio-content]');
		const headerShape = this.el.querySelector('[data-header-shape]');
		const nameBox = this.el.querySelector('[data-header-name-box]');
		const pause = this.el.querySelector('[data-header-next]');
		const overlay = this.el.querySelector('.header-overlay');
		const toggleIc = this.el.querySelector('.header-menu-toggle .header-circle-ic');
		const nav = this.el.querySelector('.header-nav');
		const circles = this.el.querySelectorAll('.header-circle');
		const navItems = this.el.querySelectorAll(
			'.header-nav-link, .header-nav-feature, .header-nav-cards > *'
		);
		let shapeOpenWidth = null;

		if (headerShape && nav) {
			const shapeStyle = getComputedStyle(headerShape);
			const circlesWidth = Array.from(circles).reduce(
				(total, circle) => total + circle.getBoundingClientRect().width,
				0
			);
			const horizontalSpace = [
				shapeStyle.paddingLeft,
				shapeStyle.paddingRight,
				shapeStyle.borderLeftWidth,
				shapeStyle.borderRightWidth,
				shapeStyle.marginLeft,
				shapeStyle.marginRight
			].reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);

			shapeOpenWidth = Math.max(nav.getBoundingClientRect().width - circlesWidth - horizontalSpace, 0);
		}

		this.tlNav = gsap.timeline({
			defaults: { duration: 0.55, ease: 'power2.inOut', overwrite: 'auto' }
		});
		if (shapeText) this.tlNav.to(shapeText, { x: 0, force3D: true }, 0);
		if (headerShape && shapeOpenWidth !== null) this.tlNav.to(headerShape, { width: shapeOpenWidth }, 0);
		if (nameBox) this.tlNav.to(nameBox, { maxWidth: '20rem', autoAlpha: 1 }, 0);
		if (pause) this.tlNav.to(pause, { maxWidth: '5rem', autoAlpha: 1 }, 0);
		if (overlay) this.tlNav.to(overlay, { autoAlpha: 1, duration: 0.35, ease: 'sine.inOut' }, 0);
		if (nav) this.tlNav.to(nav, { autoAlpha: 1, duration: 0.2, ease: 'sine.out' }, 0.03);
		if (navItems.length) {
			this.tlNav.to(navItems, {
				y: 0,
				autoAlpha: 1,
				duration: 0.45,
				ease: 'power3.out',
				stagger: 0.025
			}, 0.08);
		}
		if (toggleIc) {
			this.tlNav.to(toggleIc, {
				rotation: 225,
				duration: 0.45,
				ease: 'power2.inOut',
				force3D: true
			}, 0);
		}
		this.tlNav.call(() => this.startNameLoop(), null, 0.08);
	}

	startNameLoop() {
		if (this.tlNameLoop) this.tlNameLoop.kill();

		const name = this.el.querySelector('[data-header-name]');
		const track = name?.querySelector('[data-header-name-track]');
		const text = track?.querySelector('[data-header-name-text]');
		if (!name || !track || !text) return;

		gsap.set(track, { x: 0 });
		const shouldLoop = text.scrollWidth > name.clientWidth;
		name.classList.toggle('is-looping', shouldLoop);
		if (!shouldLoop) return;

		const trackGap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
		const loopDistance = text.offsetWidth + trackGap;

		this.tlNameLoop = gsap.to(track, {
			x: -loopDistance,
			duration: Math.max(loopDistance / 22, 6),
			ease: 'none',
			repeat: -1
		});
	}

	stopNameLoop() {
		if (this.tlNameLoop) {
			this.tlNameLoop.kill();
			this.tlNameLoop = null;
		}

		const name = this.el.querySelector('[data-header-name]');
		const track = name?.querySelector('[data-header-name-track]');
		name?.classList.remove('is-looping');
		if (track) gsap.set(track, { clearProps: 'transform' });
	}

	animateNavClose() {
		if (this.tlNav) this.tlNav.kill();
		if (this.tlNameLoop) {
			this.tlNameLoop.kill();
			this.tlNameLoop = null;
		}
		const shapeIc = this.el.querySelector('[data-header-play]');
		const shapeText = this.el.querySelector('[data-header-audio-content]');
		const headerShape = this.el.querySelector('[data-header-shape]');
		const nameBox = this.el.querySelector('[data-header-name-box]');
		const pause = this.el.querySelector('[data-header-next]');
		const overlay = this.el.querySelector('.header-overlay');
		const toggleIc = this.el.querySelector('.header-menu-toggle .header-circle-ic');
		const nav = this.el.querySelector('.header-nav');
		const navItems = this.el.querySelectorAll(
			'.header-nav-link, .header-nav-feature, .header-nav-cards > *'
		);

		this.tlNav = gsap.timeline({
			defaults: {
				ease: 'power2.inOut',
				duration: 0.45,
				overwrite: 'auto'
			},
			onComplete: () => {
				this.stopNameLoop();
				this.navLenis?.scrollTo(0, { immediate: true });
				this.el.classList.remove("on-open-nav");
				nav?.setAttribute('aria-hidden', 'true');
				document.querySelectorAll(".header-menu-toggle").forEach(el => {
					el.classList.remove("active");
					el.setAttribute('aria-expanded', 'false');
					el.setAttribute('aria-label', 'Open navigation');
				});
				gsap.set(
					[headerShape, shapeIc, shapeText, nameBox, pause, overlay, toggleIc, nav, ...navItems].filter(Boolean),
					{ clearProps: 'all' }
				);
			}
		});
		if (nameBox) this.tlNav.to(nameBox, { maxWidth: 0, autoAlpha: 0 }, 0);
		if (pause) this.tlNav.to(pause, { maxWidth: 0, autoAlpha: 0 }, 0);
		if (shapeText) this.tlNav.to(shapeText, { x: '5.5rem', force3D: true }, 0);
		if (headerShape) this.tlNav.to(headerShape, { width: '15rem' }, 0);
		if (overlay) this.tlNav.to(overlay, { autoAlpha: 0, duration: 0.35, ease: 'sine.inOut' }, 0);
		if (navItems.length) {
			this.tlNav.to(navItems, {
				y: '1.6rem',
				autoAlpha: 0,
				duration: 0.28,
				ease: 'power2.in',
				stagger: { each: 0.015, from: 'end' }
			}, 0);
		}
		if (nav) this.tlNav.to(nav, { autoAlpha: 0, duration: 0.32, ease: 'sine.inOut' }, 0.06);
		if (toggleIc) {
			this.tlNav.to(toggleIc, {
				rotation: 0,
				duration: 0.4,
				ease: 'power2.inOut',
				force3D: true
			}, 0);
		}
	}
}

export const header = new Header();
