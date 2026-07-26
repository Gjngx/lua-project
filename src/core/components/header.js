import { gsap } from '../gsap';
import { smoothScroll } from '../lenis';
import { viewport, cvUnit } from '../helpers';

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
	}

	init(data) {
		this.el = document.querySelector(".header");
		if (!this.el) return;

		this.toggleNav();
		this.setupScrollListener(data);
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
		const headerHeight = this.el.offsetHeight;
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
		const headerHeight = this.el.offsetHeight;

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
		const headerInner = this.el.querySelector('.header-inner');
		if (!headerInner) return null;
		const headerHeight = headerInner.offsetHeight;

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
		const headerInner = this.el.querySelector('.header-inner');
		if (!headerInner) return;
		const heightHeader = headerInner.offsetHeight;

		if (!this.el.classList.contains('on-hide')) {
			this.listDependent.forEach((entry) => {
				const el = entry.el || entry;
				const offset = entry.offset || 0;
				el.style.top = `${heightHeader - offset}px`;
			});
		} else {
			this.listDependent.forEach((entry) => {
				const el = entry.el || entry;
				const defaultTop = entry.defaultTop !== undefined ? entry.defaultTop : 0;
				el.style.top = `${defaultTop}px`;
			});
		}
	}

	registerDependent(dependentEl, offset = 0, defaultTop = 0) {
		this.listDependent.push({ el: dependentEl, offset, defaultTop });
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

		// Đóng khi click ra ngoài
		document.addEventListener('click', (e) => {
			if (!this.isOpen) return;
			if (
				e.target.closest('.header-menu-toggle') ||
				e.target.closest('.header-logo') ||
				e.target.closest('.header')
			) return;
			this.close();
		});
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
		this.el.querySelectorAll(".header-menu-toggle").forEach(el => el.classList.add("active"));
		this.isOpen = true;
		if (smoothScroll) smoothScroll.stop();

		this._savedScrollY = window.scrollY;
		this._preventTouch = (e) => e.preventDefault();
		document.addEventListener('touchmove', this._preventTouch, { passive: false });

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

		this.animateNavClose();
	}

	// ─── Nav Animations ──────────────────────────────────────────────
	animateNavOpen() {
		if (this.tlNav) this.tlNav.kill();
		const shapeIc = this.el.querySelector('.header-shape-ic');
		const shapeText = this.el.querySelector('.header-shape-text');
		const nameBox = this.el.querySelector('.header-shape-name-box');
		const pause = this.el.querySelector('.header-shape-pause');
		const overlay = this.el.querySelector('.header-overlay');
		const toggleIc = this.el.querySelector('.header-menu-toggle .header-circle-ic');

		this.tlNav = gsap.timeline({
			defaults: { duration: 0.7, ease: 'power2.inOut', overwrite: 'auto' }
		});
		if (shapeIc) this.tlNav.to(shapeIc, { marginRight: 0 }, 0);
		if (shapeText) this.tlNav.to(shapeText, { marginLeft: '4rem', marginRight: '4rem' }, 0);
		if (nameBox) this.tlNav.to(nameBox, { maxWidth: '20rem', autoAlpha: 1 }, 0);
		if (pause) this.tlNav.to(pause, { maxWidth: '5rem', autoAlpha: 1 }, 0);
		if (overlay) this.tlNav.to(overlay, { autoAlpha: 1, duration: 0.5, ease: 'sine.inOut' }, 0);
		if (toggleIc) {
			this.tlNav.to(toggleIc, {
				rotation: 225,
				duration: 0.65,
				ease: 'power2.inOut',
				force3D: true
			}, 0);
		}
		this.tlNav.call(() => this.startNameLoop(), null, 0.1);
	}

	startNameLoop() {
		if (this.tlNameLoop) this.tlNameLoop.kill();

		const name = this.el.querySelector('.header-shape-name');
		const track = name?.querySelector('.header-shape-name-track');
		const text = track?.querySelector('.txt');
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

		const name = this.el.querySelector('.header-shape-name');
		const track = name?.querySelector('.header-shape-name-track');
		name?.classList.remove('is-looping');
		if (track) gsap.set(track, { clearProps: 'transform' });
	}

	animateNavClose() {
		if (this.tlNav) this.tlNav.kill();
		if (this.tlNameLoop) {
			this.tlNameLoop.kill();
			this.tlNameLoop = null;
		}
		const shapeIc = this.el.querySelector('.header-shape-ic');
		const shapeText = this.el.querySelector('.header-shape-text');
		const nameBox = this.el.querySelector('.header-shape-name-box');
		const pause = this.el.querySelector('.header-shape-pause');
		const overlay = this.el.querySelector('.header-overlay');
		const toggleIc = this.el.querySelector('.header-menu-toggle .header-circle-ic');

		this.tlNav = gsap.timeline({
			defaults: {
				ease: 'power2.inOut',
				duration: 0.65,
				overwrite: 'auto'
			},
			onComplete: () => {
				this.stopNameLoop();
				this.el.classList.remove("on-open-nav");
				document.querySelectorAll(".header-menu-toggle").forEach(el => el.classList.remove("active"));
				gsap.set([shapeIc, shapeText, nameBox, pause, overlay, toggleIc].filter(Boolean), { clearProps: 'all' });
			}
		});
		if (nameBox) this.tlNav.to(nameBox, { maxWidth: 0, autoAlpha: 0 }, 0);
		if (pause) this.tlNav.to(pause, { maxWidth: 0, autoAlpha: 0 }, 0);
		if (shapeText) this.tlNav.to(shapeText, { marginLeft: 0, marginRight: 0 }, 0);
		if (shapeIc) this.tlNav.to(shapeIc, { marginRight: '4rem' }, 0);
		if (overlay) this.tlNav.to(overlay, { autoAlpha: 0, duration: 0.5, ease: 'sine.inOut' }, 0);
		if (toggleIc) {
			this.tlNav.to(toggleIc, {
				rotation: 0,
				duration: 0.6,
				ease: 'power2.inOut',
				force3D: true
			}, 0);
		}
	}
}

export const header = new Header();
