import { gsap, CustomEase } from '../gsap.js';
import { useSplitPretext } from '../../utils/pretext.js';
import hoverSound from '../../assets/audio/hover.mp3';
import closeSound from '../../assets/audio/close.mp3';

const BUTTON_SELECTOR = '[data-button-text]';
const LABEL_SELECTOR = '[data-button-text-label]';
const SOUND_SELECTOR = '[data-sound-hover]';
const CLOSE_SOUND_SELECTOR = '[data-click-close]';
const SHIFT = '1.3em';

const readSanitySoundEffects = () => {
	const dataElement = document.getElementById('sanity-sound-effects');
	if (!dataElement?.textContent) return {};

	try {
		const sounds = JSON.parse(dataElement.textContent);
		return sounds && typeof sounds === 'object' ? sounds : {};
	} catch (error) {
		console.warn('Không thể đọc sound effects từ Sanity:', error);
		return {};
	}
};

CustomEase.create(
	'buttonTextEase',
	'M0,0 C0.12,0.88 0.24,1.08 0.4,1.02 0.62,0.98 0.78,1 1,1',
);

class ButtonText {
	constructor() {
		const sanitySounds = readSanitySoundEffects();
		this.instances = new Map();
		this.soundInstances = new Map();
		this.closeSoundInstances = new Map();
		this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.soundAudios = new Map();
		this.sounds = {
			hover: sanitySounds.hover?.src || hoverSound,
			close: sanitySounds.close?.src || closeSound,
		};
		this.hasPointerMoved = false;

		window.addEventListener('pointermove', this.handlePointerMove, true);
		window.addEventListener('pointerdown', this.handlePointerDown, true);
	}

	handlePointerMove = (event) => {
		if (event.pointerType && event.pointerType !== 'mouse') return;
		if (event.movementX !== 0 || event.movementY !== 0) {
			this.hasPointerMoved = true;
		}
	};

	handlePointerDown = () => {
		// Menu và Close nằm cùng vị trí. Việc đổi nút dưới con trỏ sau click
		// không được tính là một lần hover mới.
		this.hasPointerMoved = false;
	};

	playHoverSound() {
		if (!this.hasPointerMoved) return;
		this.hasPointerMoved = false;
		this.playSound('hover');
	}

	playSound(type) {
		const sound = this.sounds[type];
		if (!sound) return;
		let audio = this.soundAudios.get(sound);

		if (!audio) {
			audio = new Audio(sound);
			audio.preload = 'auto';
			audio.volume = 1;
			this.soundAudios.set(sound, audio);
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
		this.getCloseSoundTargets(root).forEach((target) => this.setupCloseSoundClick(target));
	}

	setupSoundHover(target) {
		// data-button-text tự xử lý hover sound khi chính button được opt-in.
		if (this.instances.has(target) || this.soundInstances.has(target)) return;

		const onPointerEnter = (event) => {
			if (event.pointerType && event.pointerType !== 'mouse') return;
			this.playHoverSound();
		};

		$(target).on('pointerenter', onPointerEnter);
		this.soundInstances.set(target, { onPointerEnter });
	}

	setupCloseSoundClick(target) {
		if (this.closeSoundInstances.has(target)) return;

		const onClick = () => this.playSound('close');
		$(target).on('click', onClick);
		this.closeSoundInstances.set(target, { onClick });
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
			if ($(button).is(SOUND_SELECTOR)) {
				this.playHoverSound();
			}
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

		this.closeSoundInstances.forEach(({ onClick }, target) => {
			const belongsToRoot = root === document || root === target || root.contains(target);
			if (!belongsToRoot) return;

			$(target).off('click', onClick);
			this.closeSoundInstances.delete(target);
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

	getCloseSoundTargets(root) {
		const targets = [];
		if (root instanceof Element && $(root).is(CLOSE_SOUND_SELECTOR)) {
			targets.push(root);
		}
		targets.push(...$(root).find(CLOSE_SOUND_SELECTOR).toArray());
		return [...new Set(targets)];
	}
}

export const buttonText = new ButtonText();
