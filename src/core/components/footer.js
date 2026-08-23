import { TriggerSetup } from "../trigger-setup";
import { isTouchDevice, viewport } from "../helpers";
import { MasterTimeline, FadeIn, FadeSplitText } from '../../core/animation.js';
import { fade } from "astro/virtual-modules/transitions.js";
export class Footer extends TriggerSetup {
	constructor() {
		super();
		this.el = null;
		this.trail = null;
		this.trailSeed = null;
		this.trailItems = new Set();
		this.occupiedTrailCells = new Set();
		this.lastTrailPoint = null;
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
		if (viewport.width > 991) {
			this.animationReveal();
		}
	}
	setup() {
		if (!this.el) return;
		if (window.innerWidth <= 991 || isTouchDevice()) return;

		this.trail = $(this.el).find('.footer-cursor-trail')[0];
		this.trailSeed = $(this.trail).find('.footer-cursor-trail-seed')[0];
		if (!this.trail || !this.trailSeed) return;

		$(this.el).on('pointermove', this.handleTrailMove);
		$(this.el).on('pointerleave', this.handleTrailLeave);
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
	handleTrailMove = (event) => {
		if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
		if ($(event.target).closest('.txt, .footer-sub-content, .footer-info-link, .footer-info-right-phone')[0] || null) {
			this.lastTrailPoint = null;
			return;
		}

		const point = { x: event.clientX, y: event.clientY };
		if (!this.lastTrailPoint) {
			this.lastTrailPoint = point;
			this.addTrailGroup(point, 'horizontal');
			return;
		}

		const deltaX = point.x - this.lastTrailPoint.x;
		const deltaY = point.y - this.lastTrailPoint.y;
		const distance = Math.hypot(deltaX, deltaY);
		const spacing = 22;
		if (distance < spacing) return;

		const clusterAxis = Math.abs(deltaX) >= Math.abs(deltaY) ? 'vertical' : 'horizontal';
		const stepCount = Math.floor(distance / spacing);
		for (let step = 1; step <= stepCount; step += 1) {
			const progress = Math.min((step * spacing) / distance, 1);
			this.addTrailGroup({
				x: this.lastTrailPoint.x + deltaX * progress,
				y: this.lastTrailPoint.y + deltaY * progress,
			}, clusterAxis);
		}
		this.lastTrailPoint = point;
	};
	addTrailGroup(point, clusterAxis) {
		const lanes = Math.random() < 0.5 ? [0] : [-1, 0, 1];
		lanes.forEach((lane) => this.addTrailItem(point, lane, clusterAxis));
	}
	handleTrailLeave = () => {
		this.lastTrailPoint = null;
	};
	addTrailItem(point, lane, clusterAxis) {
		if (!this.trail || !this.trailSeed || !this.el) return;

		const bounds = this.el.getBoundingClientRect();
		const cellWidth = 22;
		const cellHeight = 28;
		const halfIconWidth = 8;
		const halfIconHeight = 12;
		const maxColumn = Math.max(0, Math.floor((bounds.width - halfIconWidth * 2) / cellWidth));
		const maxRow = Math.max(0, Math.floor((bounds.height - halfIconHeight * 2) / cellHeight));
		const rawColumn = Math.round((point.x - bounds.left - halfIconWidth) / cellWidth)
			+ (clusterAxis === 'horizontal' ? lane : 0);
		const rawRow = Math.round((point.y - bounds.top - halfIconHeight) / cellHeight)
			+ (clusterAxis === 'vertical' ? lane : 0);
		const column = Math.min(maxColumn, Math.max(0, rawColumn));
		const row = Math.min(maxRow, Math.max(0, rawRow));
		const cellKey = `${column}:${row}`;
		if (this.occupiedTrailCells.has(cellKey)) return;
		this.occupiedTrailCells.add(cellKey);

		const item = this.trailSeed.cloneNode(true);
		$(item).removeClass(['footer-cursor-trail-seed']);
		$(item).addClass(['footer-cursor-trail-item']);
		$(item).css({
			left: `${halfIconWidth + column * cellWidth}px`,
			top: `${halfIconHeight + row * cellHeight}px`,
		});
		item.dataset.trailCell = cellKey;
		this.trail.append(item);
		this.trailItems.add(item);
		const transform = (scale) => `translate(-50%, -50%) scale(${scale})`;

		const animation = item.animate(
			[
				{ opacity: 0, color: 'var(--cl-content-strong)', transform: transform(0.45) },
				{ opacity: 1, color: 'var(--cl-content-strong)', transform: transform(1), offset: 0.1 },
				{ opacity: 1, color: 'var(--cl-content-strong)', transform: transform(1), offset: 0.38 },
				{ opacity: 1, color: 'var(--cl-brand)', transform: transform(1), offset: 0.52 },
				{ opacity: 1, color: 'var(--cl-brand)', transform: transform(1), offset: 0.72 },
				{ opacity: 0, color: 'var(--cl-brand)', transform: transform(0.8) },
			],
			{ duration: 2400, easing: 'ease-out', fill: 'forwards' },
		);

		animation.addEventListener('finish', () => {
			this.trailItems.delete(item);
			this.occupiedTrailCells.delete(cellKey);
			item.remove();
		}, { once: true });
	}
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
		$(this.el).off('pointermove', this.handleTrailMove);
		$(this.el).off('pointerleave', this.handleTrailLeave);
		this.iconHoverButtons.forEach((button) => {
			$(button).off('pointerenter', this.handleIconHoverPoint);
			$(button).off('pointerleave', this.handleIconHoverPoint);
		});
		this.iconHoverButtons = [];
		this.trailItems.forEach((item) => {
			item.getAnimations().forEach((animation) => animation.cancel());
			this.occupiedTrailCells.delete(item.dataset.trailCell);
			item.remove();
		});
		this.trailItems.clear();
		this.occupiedTrailCells.clear();
		this.lastTrailPoint = null;
		super.cleanTrigger();
	}
}

export const footer = new Footer();
