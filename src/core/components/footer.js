import { TriggerSetup } from "../trigger-setup";
import { isTouchDevice, viewport } from "../helpers";
import { MasterTimeline, FadeIn, FadeSplitText } from '../../core/animation.js';

export class Footer extends TriggerSetup {
	constructor() {
		super();
		this.el = null;
		this.iconHoverButtons = [];
		this.revealTimelines = [];
	}
	trigger(data) {
		this.el = $(".footer")[0];
		if (this.el) {
			super.setTrigger(this.el, this.onTrigger.bind(this));
		}
	}
	onTrigger() {
		this.setup();
		if (viewport.w > 991) {
			this.animationReveal();
		}
	}
	setup() {
		if (!this.el) return;
		if (window.innerWidth <= 991 || isTouchDevice()) return;

		this.setupIconHovers();
	}
	setupIconHovers() {
		this.iconHoverButtons = Array.from(
			$(this.el).find('.footer-info-center-ic-wrap').toArray()
		);
		this.iconHoverButtons.forEach((button) => {
			$(button).on('pointerenter', this.handleIconHoverPoint);
			$(button).on('pointerleave', this.handleIconHoverPoint);
		});
	}
	handleIconHoverPoint = (event) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		const x = ((event.clientX - bounds.left) / bounds.width) * 100;
		const y = ((event.clientY - bounds.top) / bounds.height) * 100;
		$(event.currentTarget).css({
			'--footer-icon-hover-x': `${x}%`,
			'--footer-icon-hover-y': `${y}%`,
		});
	};
	animationReveal() {
		const mainReveal = new MasterTimeline({
			triggerInit: this.el,
			scrollTrigger: { trigger: $(this.el).find('.footer-main-content').get(0) },
			tweenArr: [
				new FadeIn({ el: $(this.el).find('.footer-main-decor').get(0) }),
				new FadeIn({ el: $(this.el).find('.footer-main-decor').get(1) }),
				new FadeSplitText({ el: $(this.el).find('.footer-main-content .heading').get(0) }),
				new FadeSplitText({ el: $(this.el).find('.footer-sub-label .txt').get(0), delay: 0.3 }),
				new FadeSplitText({ el: $(this.el).find('.footer-sub-link-text').get(0), delay: 0.4 }),
			]
		});

		const footerInfo = $(this.el).find('.footer-info').get(0);
		const leftTextTweens = $(footerInfo).find('.footer-info-left .txt').toArray().map((el, index) =>
			new FadeIn({ el, delay: index * 0.04 }),
		);
		const iconTweens = $(footerInfo).find('.footer-info-center-ic-wrap').toArray().map((el, index) =>
			new FadeIn({
				el,
				type: 'bottom',
				delay: 0.12 + index * 0.06,
				from: { scale: 0.8 },
				to: { scale: 1 },
				duration: 0.6,
			}),
		);
		const rightTextTweens = $(footerInfo).find('.footer-info-right .txt').toArray().map((el, index) =>
			new FadeIn({ el, delay: 0.2 + index * 0.05 }),
		);
		const infoReveal = new MasterTimeline({
			triggerInit: this.el,
			scrollTrigger: { trigger: footerInfo, start: 'top top+=95%'},
			tweenArr: [
				...leftTextTweens,
				...iconTweens,
				...rightTextTweens,
			]
		});

		this.revealTimelines = [mainReveal, infoReveal];
	}
	destroy() {
		this.revealTimelines.forEach((timeline) => timeline.destroy());
		this.revealTimelines = [];
		this.iconHoverButtons.forEach((button) => {
			$(button).off('pointerenter', this.handleIconHoverPoint);
			$(button).off('pointerleave', this.handleIconHoverPoint);
		});
		this.iconHoverButtons = [];
		super.cleanTrigger();
	}
}

export const footer = new Footer();
