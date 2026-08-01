import { smoothScroll } from '../lenis';
import { viewport, cvUnit } from '../helpers';
import { audioManager } from './audio';

export class Header {
	constructor() {
		this.el = null;
		this.isOpen = false;
		this.listDependent = [];
		this.currentMode = null;
		this.currentData = null;
		this.onScroll = null;
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
		const collapseAt = headerHeight * 2;
		const expandAt = headerHeight * 1.5;
		const isCollapsed = this.el.classList.contains("on-scroll");

		if (!isCollapsed && inst.scroll > collapseAt) {
			this.el.classList.add("on-scroll");
		} else if (isCollapsed && inst.scroll < expandAt) {
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
	 * `data-hidden="logo"` sẽ thêm class `hidden-logo` vào header.
	 */
	toggleMode() {
		const section = this.getCurrentSection('[data-section]');
		const mode = section ? section.getAttribute('data-section') : null;
		const hiddenRules = section?.getAttribute('data-hidden')?.split(/\s+/) || [];
		this.el.classList.toggle('hidden-logo', hiddenRules.includes('logo'));

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
		const toggles = this.el.querySelectorAll('[data-header-toggle]');
		toggles.forEach(btn => {
			btn.addEventListener("click", this.handleClick.bind(this));
		});

		this.el.querySelectorAll('[data-header-nav] a').forEach(link => {
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
				e.target.closest('[data-header-toggle]') ||
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

		const name = this.el.querySelector('[data-header-name-text]');
		if (name) name.textContent = track.title;
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
		this.el.querySelector('[data-header-nav]')?.setAttribute('aria-hidden', 'false');
		this.el.querySelectorAll('[data-header-toggle]').forEach(el => {
			el.classList.add("active");
			el.setAttribute('aria-expanded', 'true');
			el.setAttribute('aria-label', 'Close navigation');
		});
		this.isOpen = true;
		if (smoothScroll) smoothScroll.stop();

		this._savedScrollY = window.scrollY;
		this._preventTouch = (e) => {
			if (!e.target.closest('[data-header-nav]')) e.preventDefault();
		};
		document.addEventListener('touchmove', this._preventTouch, { passive: false });

	}

	close() {
		if (!this.isOpen || !this.el) return;
		this.isOpen = false;

		if (this._preventTouch) {
			document.removeEventListener('touchmove', this._preventTouch);
			this._preventTouch = null;
		}

		if (smoothScroll) smoothScroll.start();
		this.el.classList.remove("on-open-nav");
		this.el.querySelector('[data-header-nav]')?.setAttribute('aria-hidden', 'true');
		this.el.querySelectorAll('[data-header-toggle]').forEach(el => {
			el.classList.remove("active");
			el.setAttribute('aria-expanded', 'false');
			el.setAttribute('aria-label', 'Open navigation');
		});
	}
}

export const header = new Header();
