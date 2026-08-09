import { gsap, CustomEase } from '../gsap.js';
import { useSplitPretext } from '../../utils/pretext.js';

const BUTTON_SELECTOR = '[data-button-text]';
const LABEL_SELECTOR = '[data-button-text-label]';
const SHIFT = '1.3em';

CustomEase.create(
	'buttonTextEase',
	'M0,0 C0.12,0.88 0.24,1.08 0.4,1.02 0.62,0.98 0.78,1 1,1',
);

class ButtonText {
	constructor() {
		this.instances = new Map();
		this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
	}

	setup(button) {
		if (this.instances.has(button)) return;

		const label = button.querySelector(LABEL_SELECTOR);
		if (!label) return;

		// Pretext measures text with canvas and can differ from the DOM by a few
		// pixels (especially when letter-spacing is negative). Add a neutral
		// measurement buffer so a one-line button label never becomes two lines.
		const originalLabelStyles = {
			width: label.style.width,
			marginRight: label.style.marginRight,
		};
		const labelRect = label.getBoundingClientRect();
		const layoutWidth = label.scrollWidth || label.offsetWidth || labelRect.width;
		const fontSize = parseFloat(getComputedStyle(label).fontSize) || 14;
		const measurementBuffer = Math.ceil(fontSize);
		label.style.width = `${Math.ceil(layoutWidth + measurementBuffer)}px`;
		label.style.marginRight = `${-measurementBuffer}px`;

		const splitResult = useSplitPretext({
			selector: label,
			type: 'chars',
			isMask: false,
		});
		if (!splitResult?.elements.length) {
			label.style.width = originalLabelStyles.width;
			label.style.marginRight = originalLabelStyles.marginRight;
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
			animate(SHIFT);
		};
		const onPointerLeave = (event) => {
			if (event.pointerType && event.pointerType !== 'mouse') return;
			animate(0);
		};
		const onFocus = () => animate(SHIFT);
		const onBlur = () => animate(0);

		button.addEventListener('pointerenter', onPointerEnter);
		button.addEventListener('pointerleave', onPointerLeave);
		button.addEventListener('focus', onFocus);
		button.addEventListener('blur', onBlur);

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
			button.removeEventListener('pointerenter', onPointerEnter);
			button.removeEventListener('pointerleave', onPointerLeave);
			button.removeEventListener('focus', onFocus);
			button.removeEventListener('blur', onBlur);
			splitResult.revert();
			label.style.width = originalLabelStyles.width;
			label.style.marginRight = originalLabelStyles.marginRight;
			this.instances.delete(button);
		});
	}

	getButtons(root) {
		const buttons = [];
		if (root instanceof Element && root.matches(BUTTON_SELECTOR)) {
			buttons.push(root);
		}
		buttons.push(...root.querySelectorAll(BUTTON_SELECTOR));
		return buttons;
	}
}

export const buttonText = new ButtonText();
