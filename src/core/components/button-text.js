import { gsap, CustomEase } from '../gsap.js';
import { useSplitPretext } from '../../utils/pretext.js';
import hoverSound from '../../assets/audio/hover.mp3';
import closeSound from '../../assets/audio/close.mp3';

const BUTTON_SELECTOR = '[data-button-text]';
const LABEL_SELECTOR = '[data-button-text-label]';
const SOUND_SELECTOR = 'a, [data-sound-hover]';
const SHIFT = '1.3em';

CustomEase.create(
	'buttonTextEase',
	'M0,0 C0.12,0.88 0.24,1.08 0.4,1.02 0.62,0.98 0.78,1 1,1',
);

class ButtonText {
	constructor() {
		this.instances = new Map();
		this.soundInstances = new Map();
		this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.hoverAudios = new Map();
		this.hasPointerMoved = false;

		$(window).on('pointermove', (event) => {
			if (!event.pointerType || event.pointerType === 'mouse') {
				this.hasPointerMoved = true;
			}
		});
		$(window).on('pointerdown', () => {
			this.hasPointerMoved = false;
		});
		$(window).on('click', () => {
			this.hasPointerMoved = false;
		});
	}

	playHoverSound(button) {
		const sound = $(button).hasClass('header-menu-close')
			? closeSound
			: hoverSound;
		let audio = this.hoverAudios.get(sound);

		if (!audio) {
			audio = new Audio(sound);
			audio.preload = 'auto';
			audio.volume = 1;
			this.hoverAudios.set(sound, audio);
		}

		audio.currentTime = 0;
		audio.play().catch(() => {
			// Trình duyệt có thể chặn audio trước tương tác đầu tiên của người dùng.
		});
	}

	async mount(root = document) {
		if (this.reducedMotion.matches) return;

		try {
			await document.fonts?.ready;
		} catch {
			// Font loading failure should not block the button interaction.
		}

		if (root !== document && !root.isConnected) return;

		this.getButtons(root).forEach((button) => this.setup(button));
		this.getSoundTargets(root).forEach((target) => this.setupSoundHover(target));
	}

	setupSoundHover(target) {
		// data-button-text đã phát sound trong listener animation riêng.
		if (this.instances.has(target) || this.soundInstances.has(target)) return;

		const parentLink = $(target).closest('a')[0];
		if (parentLink && parentLink !== target) return;

		const onPointerEnter = (event) => {
			if (event.pointerType && event.pointerType !== 'mouse') return;
			if (this.hasPointerMoved) {
				this.playHoverSound(target);
			}
			this.hasPointerMoved = false;
		};

		$(target).on('pointerenter', onPointerEnter);
		this.soundInstances.set(target, { onPointerEnter });
	}

	setup(button) {
		if (this.instances.has(button)) return;

		const label = $(button).find(LABEL_SELECTOR)[0];
		if (!label) return;

		// Pretext measures text with canvas and can differ from the DOM by a few
		// pixels (especially when letter-spacing is negative). Add a neutral
		// measurement buffer so a one-line button label never becomes two lines.
		const originalLabelStyles = {
			width: $(label).css('width'),
			marginRight: $(label).css('margin-right'),
		};
		const labelRect = label.getBoundingClientRect();
		const layoutWidth = label.scrollWidth || label.offsetWidth || labelRect.width;
		const fontSize = parseFloat(getComputedStyle(label).fontSize) || 14;
		const measurementBuffer = Math.ceil(fontSize);
		$(label).css({
			width: `${Math.ceil(layoutWidth + measurementBuffer)}px`,
			marginRight: `${-measurementBuffer}px`,
		});

		const splitResult = useSplitPretext({
			selector: label,
			type: 'chars',
			isMask: false,
		});
		if (!splitResult?.elements.length) {
			$(label).css(originalLabelStyles);
			return;
		}

		const chars = splitResult.elements;
		const animate = (y) => {
			gsap.killTweensOf(chars);
			gsap.to(chars, {
				y,
				duration: 0.62,
				ease: 'buttonTextEase',
				stagger: {
					each: 0.017,
					from: 'random',
				},
				overwrite: true,
			});
		};

		const onPointerEnter = (event) => {
			if (event.pointerType && event.pointerType !== 'mouse') return;
			if (this.hasPointerMoved) {
				this.playHoverSound(button);
			}
			this.hasPointerMoved = false;
			animate(SHIFT);
		};
		const onPointerLeave = (event) => {
			if (event.pointerType && event.pointerType !== 'mouse') return;
			animate(0);
		};
		const onFocus = () => animate(SHIFT);
		const onBlur = () => animate(0);

		$(button).on('pointerenter', onPointerEnter);
		$(button).on('pointerleave', onPointerLeave);
		$(button).on('focus', onFocus);
		$(button).on('blur', onBlur);

		this.instances.set(button, {
			chars,
			splitResult,
			label,
			originalLabelStyles,
			handlers: {
				onPointerEnter,
				onPointerLeave,
				onFocus,
				onBlur,
			},
		});
	}

	destroy(root = document) {
		this.instances.forEach((instance, button) => {
			const belongsToRoot =
				root === document || root === button || root.contains(button);
			if (!belongsToRoot) return;

			const {
				chars,
				splitResult,
				label,
				originalLabelStyles,
				handlers: {
					onPointerEnter,
					onPointerLeave,
					onFocus,
					onBlur,
				},
			} = instance;

			gsap.killTweensOf(chars);
			$(button).off('pointerenter', onPointerEnter);
			$(button).off('pointerleave', onPointerLeave);
			$(button).off('focus', onFocus);
			$(button).off('blur', onBlur);
			splitResult.revert();
			$(label).css(originalLabelStyles);
			this.instances.delete(button);
		});

		this.soundInstances.forEach(({ onPointerEnter }, target) => {
			const belongsToRoot =
				root === document || root === target || root.contains(target);
			if (!belongsToRoot) return;

			$(target).off('pointerenter', onPointerEnter);
			this.soundInstances.delete(target);
		});
	}

	getButtons(root) {
		const buttons = [];
		if (root instanceof Element && $(root).is(BUTTON_SELECTOR)) {
			buttons.push(root);
		}
		buttons.push(...$(root).find(BUTTON_SELECTOR).toArray());
		return buttons;
	}

	getSoundTargets(root) {
		const targets = [];
		if (root instanceof Element && $(root).is(SOUND_SELECTOR)) {
			targets.push(root);
		}
		targets.push(...$(root).find(SOUND_SELECTOR).toArray());
		return [...new Set(targets)];
	}
}

export const buttonText = new ButtonText();
