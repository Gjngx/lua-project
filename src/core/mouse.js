import { gsap } from './gsap.js';
import { isTouchDevice } from './helpers.js';

const CURSOR_STATE_CLASSES = [
	'has-ic-external',
	'has-video',
];

class Mouse {
	constructor() {
		this.cursor = null;
		this.cursorMain = null;
		this.mousePos = { x: 0, y: 0 };
		this.cacheMousePos = { x: 0, y: 0 };
		this.normalized = {
			current: { x: 0.5, y: 0.5 },
			target: { x: 0.5, y: 0.5 },
		};
		this.activeTarget = null;
		this.hasMoved = false;
		this.isTicking = false;
		this.isInitialized = false;
		this.viewportWidth = window.innerWidth;
		this.viewportHeight = window.innerHeight;
		this.setX = null;
		this.setY = null;
	}

	init() {
		if (this.isInitialized || window.innerWidth <= 991 || isTouchDevice()) return;

		this.cursor = document.querySelector('.cursor');
		this.cursorMain = this.cursor?.querySelector('.cursor-main');
		if (!this.cursor || !this.cursorMain) return;
		this.cursor.classList.add('active');

		this.setX = gsap.quickSetter(this.cursorMain, 'x', 'px');
		this.setY = gsap.quickSetter(this.cursorMain, 'y', 'px');
		this.isInitialized = true;

		window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
		window.addEventListener('resize', this.handleResize, { passive: true });
		window.addEventListener('scroll', this.syncTargetUnderPointer, { passive: true });
		document.addEventListener('pointerover', this.handlePointerOver, true);
		document.addEventListener('pointerout', this.handlePointerOut, true);
		document.addEventListener('pointerdown', this.handlePointerDown, true);
		document.addEventListener('pointerup', this.handlePointerUp, true);
	}

	handlePointerMove = (event) => {
		if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

		this.mousePos.x = event.clientX;
		this.mousePos.y = event.clientY;

		if (!this.hasMoved) {
			this.hasMoved = true;
			this.cacheMousePos.x = event.clientX;
			this.cacheMousePos.y = event.clientY;
			this.cursor.classList.add('is-visible');
		}

		this.syncTargetUnderPointer();
		this.startTicker();
	};

	handleResize = () => {
		this.viewportWidth = window.innerWidth;
		this.viewportHeight = window.innerHeight;
	};

	handlePointerOver = (event) => {
		const target = event.target.closest?.('[data-cursor]');
		if (target) this.setActiveTarget(target);
	};

	handlePointerOut = (event) => {
		if (!this.activeTarget) return;
		const nextTarget = event.relatedTarget?.closest?.('[data-cursor]') || null;
		if (nextTarget !== this.activeTarget) this.setActiveTarget(nextTarget);
	};

	handlePointerDown = () => {
		this.cursor?.classList.add('is-pressed');
	};

	handlePointerUp = () => {
		this.cursor?.classList.remove('is-pressed');
	};

	startTicker() {
		if (this.isTicking) return;
		this.isTicking = true;
		gsap.ticker.add(this.update);
	}

	update = () => {
		this.cacheMousePos.x += (this.mousePos.x - this.cacheMousePos.x) * 0.15;
		this.cacheMousePos.y += (this.mousePos.y - this.cacheMousePos.y) * 0.15;

		const target = this.normalized.target;
		const current = this.normalized.current;
		target.x = this.mousePos.x / this.viewportWidth;
		target.y = this.mousePos.y / this.viewportHeight;
		current.x += (target.x - current.x) * 0.12;
		current.y += (target.y - current.y) * 0.12;

		this.setX(this.cacheMousePos.x);
		this.setY(this.cacheMousePos.y);

		const delta = Math.hypot(
			this.mousePos.x - this.cacheMousePos.x,
			this.mousePos.y - this.cacheMousePos.y,
		);
		if (delta < 0.1) {
			this.setX(this.mousePos.x);
			this.setY(this.mousePos.y);
			this.isTicking = false;
			gsap.ticker.remove(this.update);
		}
	};

	syncTargetUnderPointer = () => {
		if (!this.hasMoved) return;
		const target = document
			.elementFromPoint(this.mousePos.x, this.mousePos.y)
			?.closest?.('[data-cursor]') || null;
		this.setActiveTarget(target);
	};

	setActiveTarget(target) {
		if (target === this.activeTarget) return;
		this.activeTarget = target;
		this.applyCursorState();
	}

	applyCursorState() {
		if (!this.cursor) return;

		this.cursor.classList.remove('hidden', ...CURSOR_STATE_CLASSES);
		this.cursor.removeAttribute('data-bg');

		const type = this.activeTarget?.dataset.cursor;
		const background = this.activeTarget?.dataset.bg;
		if (background) this.cursor.dataset.bg = background;

		switch (type) {
			case 'ic-external':
				this.cursor.classList.add('has-ic-external');
				break;
			case 'video':
				this.cursor.classList.add('has-video');
				break;
			case 'hidden':
				this.cursor.classList.add('hidden');
				break;
		}
	}

	resetState() {
		this.activeTarget = null;
		this.applyCursorState();
	}

	destroy() {
		if (!this.isInitialized) return;
		gsap.ticker.remove(this.update);
		window.removeEventListener('pointermove', this.handlePointerMove);
		window.removeEventListener('resize', this.handleResize);
		window.removeEventListener('scroll', this.syncTargetUnderPointer);
		document.removeEventListener('pointerover', this.handlePointerOver, true);
		document.removeEventListener('pointerout', this.handlePointerOut, true);
		document.removeEventListener('pointerdown', this.handlePointerDown, true);
		document.removeEventListener('pointerup', this.handlePointerUp, true);
		this.cursor?.classList.remove(
			'active',
			'is-visible',
			'is-pressed',
			'hidden',
			...CURSOR_STATE_CLASSES,
		);
		this.cursor?.removeAttribute('data-bg');
		this.isInitialized = false;
		this.isTicking = false;
	}
}

export const mouse = new Mouse();
