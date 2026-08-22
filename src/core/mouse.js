import $ from 'jquery';
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
		this.cursorVideo = null;
		this.cursorVideoMedia = null;
		this.mousePos = { x: 0, y: 0 };
		this.activeTarget = null;
		this.hasMoved = false;
		this.isInitialized = false;
		this.viewportWidth = window.innerWidth;
		this.viewportHeight = window.innerHeight;
		this.moveCursorX = null;
		this.moveCursorY = null;
		this.rotateVideoX = null;
		this.rotateVideoY = null;
		this.scaleVideoX = null;
		this.scaleVideoY = null;
		this.videoResetCall = null;
	}

	init() {
		if (this.isInitialized || window.innerWidth <= 991 || isTouchDevice()) return;

		this.cursor = $('.cursor')[0];
		this.cursorMain = $(this.cursor).find('.cursor-main')[0];
		if (!this.cursor || !this.cursorMain) return;
		this.cursorVideo = $(this.cursor).find('.cursor-video')[0];
		this.cursorVideoMedia = $(this.cursor).find('.cursor-video-inner video')[0];
		$(this.cursor).addClass(['active']);

		this.moveCursorX = gsap.quickTo(this.cursorMain, 'x', {
			duration: 1,
			ease: 'power4',
		});
		this.moveCursorY = gsap.quickTo(this.cursorMain, 'y', {
			duration: 1,
			ease: 'power4',
		});
		if (this.cursorVideo) {
			gsap.set(this.cursorVideo, {
				transformPerspective: 1000,
				transformOrigin: '50% 50%',
			});
			this.rotateVideoX = gsap.quickTo(this.cursorVideo, 'rotationX', {
				duration: 1,
				ease: 'power4',
			});
			this.rotateVideoY = gsap.quickTo(this.cursorVideo, 'rotationY', {
				duration: 1,
				ease: 'power4',
			});
		}
		if (this.cursorVideoMedia) {
			gsap.set(this.cursorVideoMedia, { scale: 1.2 });
			this.scaleVideoX = gsap.quickTo(this.cursorVideoMedia, 'scaleX', {
				duration: 2,
				ease: 'power1',
			});
			this.scaleVideoY = gsap.quickTo(this.cursorVideoMedia, 'scaleY', {
				duration: 2,
				ease: 'power1',
			});
		}
		this.isInitialized = true;

		$(window).on('pointermove', this.handlePointerMove);
		$(window).on('resize', this.handleResize);
		$(window).on('scroll', this.syncTargetUnderPointer);
		document.addEventListener('pointerover', this.handlePointerOver, true);
		document.addEventListener('pointerout', this.handlePointerOut, true);
		document.addEventListener('pointerdown', this.handlePointerDown, true);
		document.addEventListener('pointerup', this.handlePointerUp, true);
	}

	handlePointerMove = (event) => {
		if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

		const deltaX = this.hasMoved ? event.clientX - this.mousePos.x : 0;
		const deltaY = this.hasMoved ? event.clientY - this.mousePos.y : 0;
		this.mousePos.x = event.clientX;
		this.mousePos.y = event.clientY;

		if (!this.hasMoved) {
			this.hasMoved = true;
			gsap.set(this.cursorMain, { x: event.clientX, y: event.clientY });
			$(this.cursor).addClass(['is-visible']);
		}

		this.moveCursorX?.(event.clientX);
		this.moveCursorY?.(event.clientY);
		const rotationY = gsap.utils.clamp(-12, 12, deltaX * 1.2);
		const rotationX = gsap.utils.clamp(-12, 12, -deltaY * 1.2);
		this.rotateVideoY?.(rotationY);
		this.rotateVideoX?.(rotationX);
		this.scaleVideoX?.(1);
		this.scaleVideoY?.(1);

		this.videoResetCall?.kill();
		this.videoResetCall = gsap.delayedCall(0.066, () => {
			this.rotateVideoX?.(0);
			this.rotateVideoY?.(0);
			this.scaleVideoX?.(1.2);
			this.scaleVideoY?.(1.2);
			this.videoResetCall = null;
		});

		this.syncTargetUnderPointer();
	};

	handleResize = () => {
		this.viewportWidth = window.innerWidth;
		this.viewportHeight = window.innerHeight;
	};

	handlePointerOver = (event) => {
		const target = $(event.target).closest('[data-cursor]')[0] || null;
		if (target) this.setActiveTarget(target);
	};

	handlePointerOut = (event) => {
		if (!this.activeTarget) return;
		const nextTarget = $(event.relatedTarget).closest('[data-cursor]')[0] || null;
		if (nextTarget !== this.activeTarget) this.setActiveTarget(nextTarget);
	};

	handlePointerDown = () => {
		$(this.cursor).addClass(['is-pressed']);
	};

	handlePointerUp = () => {
		$(this.cursor).removeClass(['is-pressed']);
	};

	syncTargetUnderPointer = () => {
		if (!this.hasMoved) return;
		const target = $(document
			.elementFromPoint(this.mousePos.x, this.mousePos.y)).closest('[data-cursor]')[0] || null;
		this.setActiveTarget(target);
	};

	setActiveTarget(target) {
		if (target === this.activeTarget) return;
		this.activeTarget = target;
		this.applyCursorState();
	}

	applyCursorState() {
		if (!this.cursor) return;

		$(this.cursor).removeClass(['hidden', ...CURSOR_STATE_CLASSES]);
		$(this.cursor).removeAttr('data-bg');

		const type = this.activeTarget?.dataset.cursor;
		const background = this.activeTarget?.dataset.bg;
		if (background) this.cursor.dataset.bg = background;

		switch (type) {
			case 'ic-external':
				$(this.cursor).addClass(['has-ic-external']);
				break;
			case 'video':
				$(this.cursor).addClass(['has-video']);
				break;
			case 'hidden':
				$(this.cursor).addClass(['hidden']);
				break;
		}
	}

	resetState() {
		this.activeTarget = null;
		this.applyCursorState();
	}

	destroy() {
		if (!this.isInitialized) return;
		this.videoResetCall?.kill();
		this.videoResetCall = null;
		$(window).off('pointermove', this.handlePointerMove);
		$(window).off('resize', this.handleResize);
		$(window).off('scroll', this.syncTargetUnderPointer);
		document.removeEventListener('pointerover', this.handlePointerOver, true);
		document.removeEventListener('pointerout', this.handlePointerOut, true);
		document.removeEventListener('pointerdown', this.handlePointerDown, true);
		document.removeEventListener('pointerup', this.handlePointerUp, true);
		$(this.cursor).removeClass(['active', 'is-visible', 'is-pressed', 'hidden', ...CURSOR_STATE_CLASSES]);
		$(this.cursor).removeAttr('data-bg');
		gsap.killTweensOf([this.cursorMain, this.cursorVideo, this.cursorVideoMedia]);
		if (this.cursorVideo) gsap.set(this.cursorVideo, { rotationX: 0, rotationY: 0 });
		if (this.cursorVideoMedia) gsap.set(this.cursorVideoMedia, { scale: 1.2 });
		this.isInitialized = false;
	}
}

export const mouse = new Mouse();
