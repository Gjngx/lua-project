import { smoothScroll } from '../lenis';
import { viewport, cvUnit } from '../helpers';
import { audioManager } from './audio';
import { gsap } from '../gsap';

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
		this.navCardReels = [];
		this.navCardReelFrame = null;
		this.navCardReelLastTime = 0;
		this.isNavCardReelHovered = false;
		this.lastNavCardReelResult = null;
		this.portraitTimeline = null;
		this.portraitLayers = [];
		this.portraitMarker = null;
		this.portraitResetCall = null;
		this.prefersReducedMotion = false;
		this.navTransition = null;
	}

	init(data) {
		this.el = document.querySelector(".header");
		if (!this.el) return;

		this.setupHeaderMetrics();
		this.setupNavCardReels();
		this.setupPortraitAnimation();
		this.toggleNav();
		this.setupScrollListener(data);
	}

	setupPortraitAnimation() {
		if (this.portraitTimeline || !this.el) return;

		const portrait = this.el.querySelector('[data-header-portrait]');
		if (!portrait) return;

		this.portraitLayers = Array.from(portrait.querySelectorAll('[data-portrait-layer]'));
		this.portraitMarker = portrait.querySelector('[data-portrait-marker]');
		if (this.portraitLayers.length !== 3 || !this.portraitMarker) return;

		portrait.addEventListener('pointerenter', () => this.playPortraitAnimation());
		portrait.addEventListener('pointerleave', () => this.reversePortraitAnimation());

		this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const markerCircle = this.portraitMarker.querySelector('circle');
		const angles = this.pickPortraitAngles();
		const [outer, middle, inner] = this.portraitLayers;

		gsap.set(this.portraitLayers, { rotation: 0, transformOrigin: '50% 50%' });
		gsap.set(this.portraitMarker, {
			scale: 2,
			rotation: 0,
			transformOrigin: '50% 50%',
		});

		if (this.prefersReducedMotion) return;

		const timeline = gsap.timeline({
			repeat: -1,
			paused: true,
			defaults: { ease: 'power3.inOut' },
		});

		if (markerCircle) {
			timeline.fromTo(
				markerCircle,
				{ strokeDashoffset: 0, opacity: 0.45 },
				{ strokeDashoffset: -28, opacity: 1, duration: 1, ease: 'none' }
			);
		} else {
			timeline.to({}, { duration: 1 });
		}

		timeline
			.to(this.portraitMarker, { scale: 1, duration: 0.4 })
			.to(inner, { rotation: angles[0], duration: 0.75 })
			.to(this.portraitMarker, { rotation: `+=${angles[0]}`, duration: 0.75 }, '<')
			.to(this.portraitMarker, { scale: 1.5, duration: 0.4 })
			.to(middle, { rotation: angles[1], duration: 0.75 })
			.to(this.portraitMarker, { rotation: `+=${angles[1]}`, duration: 0.75 }, '<')
			.to(this.portraitMarker, { scale: 2, duration: 0.4 })
			.to(outer, { rotation: angles[2], duration: 0.75 })
			.to(this.portraitMarker, { rotation: `+=${angles[2]}`, duration: 0.75 }, '<')
			.to(this.portraitMarker, { scale: 1, duration: 0.4 })
			.to(inner, { rotation: 0, duration: 0.45 })
			.to(this.portraitMarker, { rotation: `+=${-angles[0]}`, duration: 0.45 }, '<')
			.to(this.portraitMarker, { scale: 1.5, duration: 0.4 })
			.to(middle, { rotation: 0, duration: 0.45 })
			.to(this.portraitMarker, { rotation: `+=${-angles[1]}`, duration: 0.45 }, '<')
			.to(this.portraitMarker, { scale: 2, duration: 0.4 })
			.to(outer, { rotation: 0, duration: 0.45 })
			.to(this.portraitMarker, { rotation: `+=${-angles[2]}`, duration: 0.45 }, '<')
			.to(markerCircle || {}, { opacity: 0.45, duration: 0.35 });

		this.portraitTimeline = timeline;
	}

	pickPortraitAngles() {
		const pick = () => {
			let angle = gsap.utils.random(-160, 160);
			while (Math.abs(angle) < 30) angle = gsap.utils.random(-160, 160);
			return angle;
		};

		const angles = [pick()];
		while (angles.length < 3) {
			const angle = pick();
			if (Math.abs(angle - angles[angles.length - 1]) >= 45) angles.push(angle);
		}
		return angles;
	}

	playPortraitAnimation() {
		this.portraitResetCall?.kill();
		this.portraitResetCall = null;
		if (!this.prefersReducedMotion) this.portraitTimeline?.play();
	}

	reversePortraitAnimation() {
		this.portraitResetCall?.kill();
		this.portraitResetCall = null;
		if (this.prefersReducedMotion || !this.portraitTimeline) return;

		// Keep only the current loop so reversing always returns to the initial frame.
		this.portraitTimeline.totalTime(this.portraitTimeline.time(), true).reverse();
	}

	pausePortraitAnimation(delay = 0.55) {
		this.portraitResetCall?.kill();
		this.portraitResetCall = gsap.delayedCall(delay, () => {
			this.portraitTimeline?.pause(0);
			this.portraitResetCall = null;
		});
	}

	setupNavCardReels() {
		if (this.navCardReels.length) return;

		this.el.querySelectorAll('[data-header-reel]').forEach((reel, index) => {
			if (reel.hasAttribute('data-header-reel-ready')) return;

			const icons = Array.from(reel.children).map((icon) => icon.cloneNode(true));
			if (!icons.length) return;

			const track = document.createElement('div');
			track.setAttribute('data-header-reel-track', '');
			track.setAttribute('aria-hidden', 'true');
			for (let cycle = 0; cycle < 2; cycle += 1) {
				icons.forEach((icon) => track.append(icon.cloneNode(true)));
			}
			const ghostFar = track.cloneNode(true);
			ghostFar.removeAttribute('data-header-reel-track');
			ghostFar.setAttribute('data-header-reel-ghost', 'far');
			const ghostNear = track.cloneNode(true);
			ghostNear.removeAttribute('data-header-reel-track');
			ghostNear.setAttribute('data-header-reel-ghost', 'near');
			reel.replaceChildren(ghostFar, ghostNear, track);

			reel.setAttribute('data-header-reel-ready', '');
			this.navCardReels.push({
				el: reel,
				track,
				ghosts: [ghostNear, ghostFar],
				icons,
				index,
				stepSize: 0,
				cycleSize: 0,
				position: 0,
				baseSpeed: 0,
				maxSpeed: 0,
				cruiseSpeed: 0,
				acceleration: 0,
				currentSpeed: 0,
				state: 'idle',
				motion: null,
			});
		});

		const reelGroup = this.el.querySelector('[data-header-reel-group]');
		if (reelGroup && !reelGroup.hasAttribute('data-header-reel-group-ready')) {
			reelGroup.addEventListener('pointerenter', () => this.stopNavCardReelsRandomly());
			reelGroup.addEventListener('pointerleave', () => this.resumeNavCardReels());
			reelGroup.setAttribute('data-header-reel-group-ready', '');
		}
	}

	startNavCardReels() {
		this.stopNavCardReels();
		this.navCardReels.forEach((reel, index) => {
			this.measureNavCardReel(reel);
			reel.position = Math.random() * reel.cycleSize;
			reel.baseSpeed = reel.stepSize / (290 + index * 22 + Math.random() * 14);
			reel.maxSpeed = reel.baseSpeed * 1.7;
			reel.cruiseSpeed = reel.baseSpeed;
			reel.acceleration = (reel.maxSpeed - reel.baseSpeed) / 8000;
			reel.currentSpeed = reel.cruiseSpeed;
			reel.state = 'running';
			reel.motion = null;
			this.renderNavCardReel(reel);
		});

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		this.navCardReelLastTime = performance.now();
		this.navCardReelFrame = window.requestAnimationFrame((time) => this.updateNavCardReels(time));
	}

	measureNavCardReel(reel) {
		const icon = reel.track.firstElementChild;
		if (!icon) return;

		const iconHeight = icon.getBoundingClientRect().height;
		const reelHeight = reel.el.getBoundingClientRect().height;
		reel.stepSize = Math.max(iconHeight, (reelHeight - iconHeight) / 2);
		reel.cycleSize = reel.stepSize * reel.icons.length;
		reel.el.style.setProperty('--header-reel-gap', `${Math.max(0, reel.stepSize - iconHeight)}px`);
	}

	updateNavCardReels(time) {
		if (!this.isOpen) return;

		const deltaTime = Math.min(time - this.navCardReelLastTime, 50);
		this.navCardReelLastTime = time;

		this.navCardReels.forEach((reel) => {
			if (!reel.cycleSize) return;

			if (reel.state === 'running') {
				reel.cruiseSpeed = Math.min(reel.maxSpeed, reel.cruiseSpeed + reel.acceleration * deltaTime);
				reel.position = (reel.position + reel.cruiseSpeed * deltaTime) % reel.cycleSize;
				reel.currentSpeed = reel.cruiseSpeed;
			} else if (reel.state === 'pending-stop') {
				reel.cruiseSpeed = Math.min(reel.maxSpeed, reel.cruiseSpeed + reel.acceleration * deltaTime);
				reel.position = (reel.position + reel.cruiseSpeed * deltaTime) % reel.cycleSize;
				reel.currentSpeed = reel.cruiseSpeed;
				if (time >= reel.motion.startAt) this.beginNavCardReelStop(reel, time);
			} else if (reel.state === 'stopping') {
				const progress = Math.min((time - reel.motion.startTime) / reel.motion.duration, 1);
				const distance =
					reel.motion.velocityDistance * progress +
					reel.motion.curveA * progress ** 2 +
					reel.motion.curveB * progress ** 3;
				reel.position = (reel.motion.from + distance) % reel.cycleSize;
				reel.currentSpeed = Math.max(0, (
					reel.motion.velocityDistance +
					2 * reel.motion.curveA * progress +
					3 * reel.motion.curveB * progress ** 2
				) / reel.motion.duration);

				if (progress === 1) {
					const { targetPosition, overshoot, rebound } = reel.motion;
					reel.position = targetPosition + overshoot;
					reel.currentSpeed = 0;
					reel.state = 'rebounding';
					reel.motion = {
						startTime: time,
						duration: 140,
						targetPosition,
						fromOffset: overshoot,
						toOffset: -rebound,
					};
				}
			} else if (reel.state === 'rebounding') {
				const progress = Math.min((time - reel.motion.startTime) / reel.motion.duration, 1);
				const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
				const offset = reel.motion.fromOffset + (reel.motion.toOffset - reel.motion.fromOffset) * eased;
				reel.position = this.normalizeNavCardReelPosition(reel, reel.motion.targetPosition + offset);
				reel.currentSpeed = (reel.motion.toOffset - reel.motion.fromOffset) * 0.5 * Math.PI * Math.sin(progress * Math.PI) / reel.motion.duration;

				if (progress === 1) {
					const { targetPosition, toOffset } = reel.motion;
					reel.currentSpeed = 0;
					reel.state = 'locking';
					reel.motion = {
						startTime: time,
						duration: 110,
						targetPosition,
						fromOffset: toOffset,
					};
				}
			} else if (reel.state === 'locking') {
				const progress = Math.min((time - reel.motion.startTime) / reel.motion.duration, 1);
				const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
				const offset = reel.motion.fromOffset * (1 - eased);
				reel.position = this.normalizeNavCardReelPosition(reel, reel.motion.targetPosition + offset);
				reel.currentSpeed = -reel.motion.fromOffset * 0.5 * Math.PI * Math.sin(progress * Math.PI) / reel.motion.duration;

				if (progress === 1) {
					reel.position = reel.motion.targetPosition;
					reel.currentSpeed = 0;
					reel.state = 'stopped';
					reel.motion = null;
				}
			} else if (reel.state === 'pending-resume') {
				if (time >= reel.motion.startAt) {
					reel.state = 'accelerating';
					reel.motion = {
						startTime: time,
						duration: 460,
						fromSpeed: 0,
					};
				}
			} else if (reel.state === 'accelerating') {
				const progress = Math.min((time - reel.motion.startTime) / reel.motion.duration, 1);
				const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
				reel.currentSpeed = reel.motion.fromSpeed + (reel.cruiseSpeed - reel.motion.fromSpeed) * eased;
				reel.position = (reel.position + reel.currentSpeed * deltaTime) % reel.cycleSize;

				if (progress === 1) {
					reel.state = 'running';
					reel.currentSpeed = reel.cruiseSpeed;
					reel.motion = null;
				}
			}

			this.renderNavCardReel(reel);
		});

		this.navCardReelFrame = window.requestAnimationFrame((nextTime) => this.updateNavCardReels(nextTime));
	}

	renderNavCardReel(reel) {
		const speedRatio = reel.baseSpeed
			? Math.min(Math.abs(reel.currentSpeed) / reel.baseSpeed, 1.7)
			: 0;
		const trailStrength = speedRatio < 0.18
			? 0
			: Math.min((speedRatio - 0.18) / 0.82, 1);
		const direction = Math.sign(reel.currentSpeed) || 1;
		const trailOffsets = [0.11, 0.24];
		const trailOpacities = [0.26, 0.11];

		reel.track.style.transform = `translate3d(0, ${-reel.position}px, 0)`;
		reel.ghosts.forEach((ghost, index) => {
			const lag = reel.stepSize * trailOffsets[index] * speedRatio;
			const ghostPosition = this.normalizeNavCardReelPosition(
				reel,
				reel.position - direction * lag
			);
			ghost.style.transform = `translate3d(0, ${-ghostPosition}px, 0)`;
			ghost.style.opacity = String(trailOpacities[index] * trailStrength);
		});
	}

	normalizeNavCardReelPosition(reel, position) {
		return ((position % reel.cycleSize) + reel.cycleSize) % reel.cycleSize;
	}

	stopNavCardReelsRandomly() {
		if (!this.isOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		this.isNavCardReelHovered = true;
		const now = performance.now();
		let result = this.navCardReels.map((reel) => Math.floor(Math.random() * reel.icons.length));
		let attempts = 0;
		while (
			this.lastNavCardReelResult &&
			result.filter((target, index) => target !== this.lastNavCardReelResult[index]).length < 2 &&
			attempts < 12
		) {
			result = this.navCardReels.map((reel) => Math.floor(Math.random() * reel.icons.length));
			attempts += 1;
		}
		if (
			this.lastNavCardReelResult &&
			result.filter((target, index) => target !== this.lastNavCardReelResult[index]).length < 2
		) {
			result = this.lastNavCardReelResult.map((target, index) =>
				(target + 1 + (index % 2)) % this.navCardReels[index].icons.length
			);
		}
		this.lastNavCardReelResult = [...result];

		this.navCardReels.forEach((reel, index) => {
			reel.state = 'pending-stop';
			reel.motion = {
				startAt: now + index * 240,
				targetStep: result[index],
				duration: 1450,
			};
		});
	}

	beginNavCardReelStop(reel, time) {
		const targetPosition = reel.motion.targetStep * reel.stepSize;
		const distanceToTarget = (targetPosition - reel.position + reel.cycleSize) % reel.cycleSize;
		const overshoot = reel.stepSize * 0.1;
		const rebound = reel.stepSize * 0.025;
		const duration = reel.motion.duration;
		const velocityDistance = reel.currentSpeed * duration;
		let distance = reel.cycleSize + distanceToTarget + overshoot;
		while (distance < velocityDistance / 3) distance += reel.cycleSize;
		reel.motion = {
			...reel.motion,
			startTime: time,
			from: reel.position,
			distance,
			targetPosition,
			overshoot,
			rebound,
			velocityDistance,
			curveA: 3 * distance - 2 * velocityDistance,
			curveB: velocityDistance - 2 * distance,
		};
		reel.state = 'stopping';
	}

	resumeNavCardReels() {
		if (!this.isOpen || !this.isNavCardReelHovered) return;

		this.isNavCardReelHovered = false;
		const now = performance.now();
		this.navCardReels.forEach((reel, index) => {
			const fromSpeed = Math.max(0, reel.currentSpeed);
			if (fromSpeed >= reel.baseSpeed * 0.98) {
				reel.cruiseSpeed = Math.min(fromSpeed, reel.maxSpeed);
				reel.state = 'running';
				reel.currentSpeed = reel.cruiseSpeed;
				reel.motion = null;
				return;
			}

			reel.cruiseSpeed = reel.baseSpeed;
			if (reel.state === 'stopped') {
				reel.state = 'pending-resume';
				reel.motion = { startAt: now + index * 90 };
				return;
			}

			reel.state = 'accelerating';
			reel.motion = {
				startTime: now,
				duration: 460,
				fromSpeed,
			};
		});
	}

	stopNavCardReels() {
		if (this.navCardReelFrame) window.cancelAnimationFrame(this.navCardReelFrame);
		this.navCardReelFrame = null;
		this.isNavCardReelHovered = false;

		this.navCardReels.forEach((reel) => {
			reel.state = 'idle';
			reel.currentSpeed = 0;
			reel.motion = null;
		});
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

	getNavAnimationElements() {
		const nav = this.el?.querySelector('[data-header-nav]');
		const grid = nav?.querySelector('.header-nav-grid');
		const lead = nav?.querySelector('.header-nav-links');
		const socialGroup = nav?.querySelector('.header-nav-socials');
		const cards = [];
		Array.from(grid?.children || []).forEach((item) => {
			if (item === lead) return;
			if (item === socialGroup) {
				cards.push(...item.querySelectorAll('.header-nav-social'));
				return;
			}
			cards.push(item);
		});
		const overlay = this.el?.querySelector('.header-overlay');

		return { nav, lead, cards, overlay };
	}

	clearNavAnimationStyles(elements = this.getNavAnimationElements()) {
		const targets = [
			elements.nav,
			elements.lead,
			...elements.cards,
			elements.overlay,
		].filter(Boolean);

		if (!targets.length) return;
		gsap.set(targets, {
			clearProps:
				'opacity,visibility,transform,transformOrigin,clipPath,pointerEvents,overflow,willChange',
		});
	}

	finishNavClose(elements = this.getNavAnimationElements()) {
		if (!this.el) return;

		this.el.classList.remove('on-open-nav', 'is-nav-closing');
		this.clearNavAnimationStyles(elements);
		this.portraitTimeline?.pause(0);
		this.navTransition = null;
	}

	playNavOpenAnimation() {
		const elements = this.getNavAnimationElements();
		const { nav, lead, cards, overlay } = elements;
		if (!nav || !lead) return;

		const navWidth = nav.getBoundingClientRect().width;
		const travel = Math.max(72, Math.min(navWidth * 0.34, 190));

		gsap.set([lead, ...cards], { willChange: 'transform, opacity' });
		gsap.set(overlay, { willChange: 'opacity' });
		gsap.set(nav, { overflow: 'visible' });
		gsap.set(overlay, { autoAlpha: 0 });
		gsap.set(lead, {
			scaleX: 0.12,
			scaleY: 0.12,
			autoAlpha: 0,
			transformOrigin: '100% 0%',
			force3D: true,
		});
		gsap.set(cards, {
			x: (index) => travel + index * 8,
			y: (index) => -10 + Math.min(index, 4) * 4,
			rotation: (index) => (index % 2 ? 0.9 : -0.9),
			scale: 0.99,
			autoAlpha: 0,
			transformOrigin: 'top right',
		});

		this.navTransition = gsap.timeline({
			onComplete: () => {
				this.clearNavAnimationStyles(elements);
				this.navTransition = null;
				if (this.isOpen) this.startNavCardReels();
			},
		});

		this.navTransition
			.to(
				overlay,
				{
					autoAlpha: 1,
					duration: 0.28,
					ease: 'power2.out',
				},
				0,
			)
			.to(
				lead,
				{
					scaleX: 1,
					scaleY: 1,
					autoAlpha: 1,
					duration: 0.6,
					ease: 'power4.out',
					force3D: true,
				},
				0,
			)
			.to(
				cards,
				{
					x: 0,
					y: 0,
					rotation: 0,
					scale: 1,
					autoAlpha: 1,
					duration: 0.5,
					stagger: 0.032,
					ease: 'power4.out',
				},
				0.025,
			);
	}

	playNavCloseAnimation() {
		const elements = this.getNavAnimationElements();
		const { nav, lead, cards, overlay } = elements;
		if (!nav || !lead) {
			this.finishNavClose(elements);
			return;
		}

		const navWidth = nav.getBoundingClientRect().width;
		const travel = Math.max(120, Math.min(navWidth * 0.46, 250));
		const rotations = [-3.5, 2.8, -2.4, 4.2, -4.5];
		gsap.set([lead, ...cards], { willChange: 'transform, opacity' });
		gsap.set(overlay, { willChange: 'opacity' });
		gsap.set([nav, overlay].filter(Boolean), { pointerEvents: 'none' });
		gsap.set(nav, { overflow: 'visible' });

		this.navTransition = gsap.timeline({
			onComplete: () => this.finishNavClose(elements),
		});

		this.navTransition
			.to(
				overlay,
				{
					opacity: 0,
					duration: 0.24,
					ease: 'power2.out',
				},
				0,
			)
			.to(
				lead,
				{
					scaleX: 0.12,
					scaleY: 0.12,
					autoAlpha: 0,
					duration: 0.52,
					ease: 'power3.in',
					transformOrigin: '100% 0%',
					force3D: true,
				},
				0.015,
			)
			.to(
				cards,
				{
					x: (index) => travel * (1.05 + index * 0.16),
					y: (index) => 42 + Math.min(index, 5) * 48,
					rotation: (index) => rotations[index % rotations.length],
					scale: (index) => 1 - Math.min(index, 5) * 0.008,
					autoAlpha: 0,
					duration: (index) => 0.62 + Math.min(index, 4) * 0.035,
					stagger: 0.025,
					ease: 'power2.in',
				},
				0.025,
			);
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

		this.navTransition?.kill();
		this.navTransition = null;
		this.portraitResetCall?.kill();
		this.portraitResetCall = null;
		this.clearNavAnimationStyles();
		this.el.classList.remove('is-nav-closing');
		this.el.classList.add('on-open-nav');
		this.el.querySelector('[data-header-nav]')?.setAttribute('aria-hidden', 'false');
		this.el.querySelectorAll('[data-header-toggle]').forEach((el) => {
			el.classList.add('active');
			el.setAttribute('aria-expanded', 'true');
			el.setAttribute('aria-label', 'Close navigation');
		});
		this.isOpen = true;
		if (this.prefersReducedMotion) {
			this.startNavCardReels();
		} else {
			this.playNavOpenAnimation();
		}
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
		this.navTransition?.kill();
		this.navTransition = null;
		this.clearNavAnimationStyles();
		this.stopNavCardReels();
		this.pausePortraitAnimation(this.prefersReducedMotion ? 0 : 0.9);

		if (this._preventTouch) {
			document.removeEventListener('touchmove', this._preventTouch);
			this._preventTouch = null;
		}

		if (smoothScroll) smoothScroll.start();
		this.el.classList.add('is-nav-closing');
		this.el.querySelector('[data-header-nav]')?.setAttribute('aria-hidden', 'true');
		this.el.querySelectorAll('[data-header-toggle]').forEach((el) => {
			el.classList.remove('active');
			el.setAttribute('aria-expanded', 'false');
			el.setAttribute('aria-label', 'Open navigation');
		});

		if (this.prefersReducedMotion) {
			this.finishNavClose();
		} else {
			this.playNavCloseAnimation();
		}
	}
}

export const header = new Header();
