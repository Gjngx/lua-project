import { gsap, ScrollTrigger } from './gsap.js';
import { useSplitPretext } from '../utils/pretext.js';

const fontsReady = () => document.fonts?.ready || Promise.resolve();

const splitText = (el, type = 'words', isMask = false) => {
	const result = useSplitPretext({ selector: el, type, isMask });
	if (!result) return null;

	return {
		words: type === 'words' ? result.elements : [],
		lines: type === 'lines' ? result.elements : result.lines,
		revert: result.revert,
	};
};

export const parseRem = (input) => {
	const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
	return (input / 10) * rootFontSize;
};

export function getScreenType() {
	const size = window.innerWidth;
	const isMobile = size <= 767;
	const isTablet = size > 767 && size <= 991;
	const isDesktop = size > 991;
	const type = isDesktop ? 'dsk' : isTablet ? 'tb' : 'mb';

	return { type, size, isMobile, isDesktop, isTablet };
}

export function convertHyphen(el) {
	if (!el) return;
	el.childNodes.forEach((node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			node.nodeValue = node.nodeValue.replace(/-/g, '‑');
		}
	});
}

const getTextColors = (color) => {
	const isDefault = color === 'white' || color === 'black';
	return {
		isDefault,
		fromColor: !isDefault || color === 'white'
			? 'rgba(255,255,255, 0)'
			: 'rgba(29,29,29, 0)',
		toColor: !isDefault
			? color
			: color === 'white'
				? 'rgba(255,255,255, 1)'
				: 'rgba(29,29,29, 1)',
	};
};

export class MasterTimeline {
	constructor({
		triggerInit,
		timeline,
		tweenArr = [],
		stagger = 0.1,
		scrollTrigger,
		allowMobile,
	} = {}) {
		this.timeline = timeline || null;
		this.ownsTimeline = !timeline;
		this.triggerInit = triggerInit;
		this.scrollTrigger = scrollTrigger;
		this.tweenArr = tweenArr.filter(Boolean);
		this.stagger = stagger;
		this.allowMobile = getScreenType().isTablet ? Boolean(allowMobile) : true;
		this.initTrigger = null;
		this.ready = fontsReady().then(() => this.setup());
	}

	async setup() {
		if (!this.allowMobile) return this;
		await Promise.all(this.tweenArr.map((item) => item.ready).filter(Boolean));

		if (this.triggerInit) {
			this.initTrigger = ScrollTrigger.create({
				trigger: this.triggerInit,
				start: 'top bottom+=100vh',
				end: 'bottom top',
				once: true,
				onEnter: () => {
					this.tweenArr.forEach((item) => item.init?.());
				},
			});
		}

		if (!this.timeline) {
			this.timeline = gsap.timeline({
				scrollTrigger: {
					start: 'top top+=80%',
					end: '+=100%',
					scrub: false,
					once: true,
					...this.scrollTrigger,
				},
			});
		}

		this.tweenArr.forEach((item) => {
			if (!item.animation) return;
			this.timeline.add(item.animation, item.delay ?? `<=${this.stagger}`);
		});

		return this;
	}

	destroy() {
		this.initTrigger?.kill();
		this.initTrigger = null;
		if (this.ownsTimeline) this.timeline?.kill();
		this.tweenArr.forEach((item) => item.destroy?.());
		this.timeline = null;
	}
}

export class RevealText {
	constructor({
		el,
		color = 'black',
		delay,
		isDisableRevert,
		isHighlight = false,
		isFast = false,
		...props
	} = {}) {
		this.DOM = { el };
		this.delay = delay;
		this.animation = null;
		this.textSplit = null;
		this.isDisableRevert = isDisableRevert;
		if (!el) return;

		const colors = getTextColors(color);
		this.fromColor = colors.fromColor;
		this.toColor = colors.toColor;
		this.textSplit = splitText(el, 'words');
		if (!this.textSplit) return;
		const duration = isFast ? 0.8 : 1;
		const stagger = isFast ? 0.03 : 0.08;

		if (isHighlight) {
			this.animation = gsap.timeline({
				onComplete: () => this.revert(),
				...props,
			});
			this.textSplit.words.forEach((word, index) => {
				const toColor = $(word).closest('.txt-highlight').length ? '#FF6B30' : this.toColor;
				this.animation.to(word, {
					keyframes: {
						color: [this.fromColor, '#FF6B30', toColor],
						easeEach: 'power2.in',
						ease: 'power1.out',
					},
					duration,
				}, index * stagger);
			});
		} else {
			this.animation = gsap.to(this.textSplit.words, {
				keyframes: {
					color: [this.fromColor, '#232323', this.toColor],
					easeEach: 'power2.in',
					ease: 'power1.out',
				},
				duration,
				stagger,
				onComplete: () => this.revert(),
				...props,
			});
		}
	}

	init() {
		if (this.textSplit) gsap.set(this.textSplit.words, { color: this.fromColor });
	}

	revert() {
		if (!this.isDisableRevert) this.textSplit?.revert();
	}

	destroy() {
		this.animation?.kill();
		this.textSplit?.revert();
	}
}

export class RevealTextReset {
	constructor({
		el,
		color = 'black',
		delay,
		isFast = false,
		isHighlight = false,
		...props
	} = {}) {
		this.DOM = { el };
		this.delay = delay;
		this.color = color;
		this.isFast = isFast;
		this.isHighlight = isHighlight;
		this.animation = null;
		this.textSplit = null;
		this.resetTriggers = [];
		if (!el) return;

		const colors = getTextColors(color);
		this.isColorDefault = colors.isDefault;
		this.fromColor = colors.fromColor;
		this.toColor = colors.toColor;
		this.textSplit = splitText(el, 'words');
		if (!this.textSplit) return;
		const duration = isFast ? 0.8 : 1;
		const stagger = isFast ? 0.03 : 0.08;

		if (isHighlight) {
			this.animation = gsap.timeline({
				onComplete: () => this.reset(),
				...props,
			});
			this.addHighlightTweens(this.animation);
		} else {
			this.animation = gsap.to(this.textSplit.words, {
				keyframes: {
					color: [this.fromColor, '#FF6B30', this.toColor],
					easeEach: 'power2.in',
					ease: 'power1.out',
				},
				duration,
				stagger,
				onComplete: () => this.reset(),
				...props,
			});
		}
	}

	addHighlightTweens(timeline) {
		const duration = this.isFast ? 0.8 : 1;
		const stagger = this.isFast ? 0.03 : 0.08;
		this.textSplit.words.forEach((word, index) => {
			const toColor = $(word).closest('.txt-highlight').length ? '#FF6B30' : this.toColor;
			timeline.to(word, {
				keyframes: {
					color: [this.fromColor, '#FF6B30', toColor],
					easeEach: 'power2.in',
					ease: 'power1.out',
				},
				duration,
			}, index * stagger);
		});
	}

	init() {
		if (!this.textSplit) return;
		if (getScreenType().isMobile) {
			this.fromColor = !this.isColorDefault || this.color === 'white'
				? 'rgba(255,255,255, .1)'
				: 'rgba(29,29,29, .1)';
			this.reset();
		}
		gsap.set(this.textSplit.words, { color: this.fromColor });
	}

	reset() {
		if (!this.DOM.el || this.resetTriggers.length) return;
		let isReset = true;
		let isInit = getScreenType().isMobile;

		this.resetTriggers.push(
			ScrollTrigger.create({
				trigger: this.DOM.el,
				start: 'top top+=65%',
				end: 'bottom top+=65%',
				onEnter: () => {
					if (!isReset || !isInit) return;
					isReset = false;
					if (this.isHighlight) {
						this.addHighlightTweens(gsap.timeline());
					} else {
						gsap.to(this.textSplit.words, {
							keyframes: {
								color: [this.fromColor, '#FF6B30', this.toColor],
								easeEach: 'power2.in',
								ease: 'power1.out',
							},
							overwrite: true,
							duration: this.isFast ? 0.8 : 1,
							stagger: this.isFast ? 0.03 : 0.08,
						});
					}
				},
			}),
			ScrollTrigger.create({
				trigger: this.DOM.el,
				start: 'top bottom',
				end: 'bottom top',
				onLeaveBack: () => {
					if (!isInit) {
						this.fromColor = !this.isColorDefault || this.color === 'white'
							? 'rgba(255,255,255, .1)'
							: 'rgba(29,29,29, .1)';
					}
					isInit = true;
					isReset = true;
					gsap.set(this.textSplit.words, {
						color: this.fromColor,
						overwrite: true,
					});
				},
			}),
		);
	}

	destroy() {
		this.animation?.kill();
		this.resetTriggers.forEach((trigger) => trigger.kill());
		this.resetTriggers = [];
		this.textSplit?.revert();
	}
}

export class FadeSplitText {
	constructor({ el, delay, splitType = 'words', isDisableRevert, ...props } = {}) {
		this.DOM = { el };
		this.delay = delay;
		this.splitType = splitType;
		this.isDisableRevert = isDisableRevert;
		this.textSplit = null;
		this.animation = null;
		this.ready = !el || !el.textContent.trim()
			? Promise.resolve(this)
			: fontsReady().then(() => this.setup(props));
	}

	setup(props) {
		const el = this.DOM.el;
		if (!el?.isConnected) return this;
		gsap.set(el, { width: el.offsetWidth + 5 });
		this.textSplit = splitText(el, this.splitType, true);
		if (!this.textSplit) return this;
		const targets = this.textSplit[this.splitType];
		gsap.set(targets, { autoAlpha: 0, yPercent: 100 });
		this.animation = gsap.to(targets, {
			autoAlpha: 1,
			yPercent: 0,
			stagger: this.splitType === 'words' ? 0.02 : 0.1,
			duration: 0.8,
			willChange: 'transform, opacity',
			ease: 'power2.out',
			clearProps: 'overflow',
			onStart: () => {
				window.setTimeout(() => {
					$(el).find('.txt-strike, .heading-decor').toArray()
						.forEach((item) => $(item).addClass(['active']));
				}, 450);
			},
			onComplete: () => {
				if (!this.isDisableRevert) {
					this.textSplit?.revert();
					convertHyphen(el);
				} else {
					gsap.set($(el).find('[aria-hidden="true"]').toArray(), {
						clearProps: 'overflow',
					});
				}
			},
			...props,
		});
		return this;
	}

	init() {}

	destroy() {
		this.animation?.kill();
		this.textSplit?.revert();
	}
}

export class FadeIn {
	constructor({ el, type = 'default', delay, isDisableRevert, from, to, ...props } = {}) {
		this.DOM = { el };
		this.type = type;
		this.delay = delay;
		this.animation = null;
		this.options = {
			bottom: {
				set: { opacity: 0, y: parseRem(32), ...from },
				to: { opacity: 1, y: 0, ...to },
			},
			top: {
				set: { opacity: 0, y: parseRem(-32), ...from },
				to: { opacity: 1, y: 0, ...to },
			},
			left: {
				set: { opacity: 0, x: parseRem(32), ...from },
				to: { opacity: 1, x: 0, ...to },
			},
			right: {
				set: { opacity: 0, x: parseRem(-32), ...from },
				to: { opacity: 1, x: 0, ...to },
			},
			default: {
				set: { opacity: 0, y: parseRem(32), ...from },
				to: { opacity: 1, y: 0, ...to },
			},
		};

		if (!el) return;
		const option = this.options[type] || this.options.default;
		this.animation = gsap.fromTo(el, { ...option.set }, {
			...option.to,
			duration: 1,
			ease: 'power3',
			clearProps: isDisableRevert ? '' : 'all',
			...props,
		});
	}

	init() {
		if (!this.DOM.el) return;
		const option = this.options[this.type] || this.options.default;
		gsap.set(this.DOM.el, { ...option.set });
	}

	destroy() {
		this.animation?.kill();
	}
}

export class ScaleLine {
	constructor({ el, type = 'default', isCenter, delay, isDisableRevert, ...props } = {}) {
		this.DOM = { el };
		this.type = type;
		this.delay = delay;
		this.animation = null;
		this.options = {
			top: {
				set: { scaleY: 0, transformOrigin: isCenter ? 'center center' : 'top left' },
				to: { scaleY: 1 },
			},
			left: {
				set: { scaleX: 0, transformOrigin: isCenter ? 'center center' : 'top left' },
				to: { scaleX: 1 },
			},
			right: {
				set: { scaleX: 0, transformOrigin: isCenter ? 'center center' : 'top right' },
				to: { scaleX: 1 },
			},
			bottom: {
				set: { scaleX: 0, transformOrigin: isCenter ? 'center center' : 'bottom right' },
				to: { scaleX: 1 },
			},
			default: {
				set: { scaleX: 0, transformOrigin: isCenter ? 'center center' : 'top left' },
				to: { scaleX: 1 },
			},
		};

		if (!el) return;
		const option = this.options[type] || this.options.default;
		this.animation = gsap.fromTo(el, { ...option.set }, {
			...option.to,
			duration: 1.2,
			ease: 'power1.out',
			clearProps: isDisableRevert ? '' : 'all',
			...props,
		});
	}

	init() {
		if (!this.DOM.el) return;
		const option = this.options[this.type] || this.options.default;
		gsap.set(this.DOM.el, { ...option.set });
	}

	destroy() {
		this.animation?.kill();
	}
}

export class ScaleInset {
	constructor({ el, elInner, delay, duration = 2, isDisableRevert } = {}) {
		this.DOM = { el, elInner: elInner || $(el).find('img')[0] };
		this.delay = delay;
		this.animation = null;
		if (!el) return;

		this.borderRad = gsap.getProperty(el, 'border-radius');
		const clearProps = isDisableRevert ? '' : 'all';
		this.animation = gsap.timeline().to(el, {
			clipPath: `inset(0% round ${this.borderRad}px)`,
			duration,
			ease: 'expo.out',
			clearProps,
		});
		if (this.DOM.elInner) {
			this.animation.to(this.DOM.elInner, {
				scale: 1,
				duration,
				autoAlpha: 1,
				ease: 'expo.out',
				clearProps,
				overwrite: true,
			}, '<=0');
		}
	}

	init() {
		if (!this.DOM.el) return;
		gsap.set(this.DOM.el, {
			clipPath: `inset(20% round ${this.borderRad}px)`,
		});
		if (this.DOM.elInner) {
			gsap.set(this.DOM.elInner, { scale: 1.4, autoAlpha: 0 });
		}
	}

	destroy() {
		this.animation?.kill();
	}
}
