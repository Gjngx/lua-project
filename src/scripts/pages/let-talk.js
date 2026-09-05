import { gsap, ScrollTrigger } from '../../core/gsap.js';
import { MasterTimeline, FadeIn, FadeSplitText } from '../../core/animation.js';

export const LetTalkPage = {
	Hero: class {
		constructor() {
			this.el = null;
			this.footerLinkCleanups = [];
			this.tlOnce = null;
			this.tlEnter = null;
			this.tlIntro = null;
			this.tlMove = null;
			this.masterReveal = null;
			this.revealReady = null;
			this.footerReveal = null;
			this.footerRevealTimeline = null;
			this.footerRevealReady = null;
			this.footerRevealRequested = false;
		}

		setup(data, mode) {
			this.el = $(data.next.container).find('.let-talk-wrap')[0];
			if (!this.el) return;
			this.interact();

			if (mode === 'once') {
				this.setupOnce(data);
			} else if (mode === 'enter') {
				this.setupEnter(data);
			}
			const footerItems = [
				$(this.el).find('.let-talk-footer-phone-inner')[0],
				$(this.el).find('.let-talk-footer-email-inner')[0],
				$(this.el).find('.let-talk-footer-link-inner')[0],
			];
			gsap.set(footerItems, { yPercent: 100});
		}

		setupOnce(data) {
			this.animationScrub();

			this.tlOnce = gsap.timeline({
				paused: true,
			});

			this.revealReady = this.animationReveal(this.tlOnce);
		}

		setupEnter(data) {
			this.animationScrub();

			this.tlEnter = gsap.timeline({
				paused: true,
			});

			this.revealReady = this.animationReveal(this.tlEnter);
		}

		async playOnce() {
			await this.revealReady;
			if (this.tlOnce) this.tlOnce.play(0);
		}

		async playEnter() {
			await this.revealReady;
			if (this.tlEnter) this.tlEnter.play(0);
		}

		animationReveal(timeline) {
			const textItems = $(this.el)
				.find('.let-talk-top-block, .let-talk-top > .h0 > span.let-talk-top-line')
				.toArray();

			this.masterReveal = new MasterTimeline({
				timeline,
				tweenArr: [
					...textItems.map((el, index) =>
						new FadeSplitText({ el, delay: index * 0.08 }),
					),
					new FadeIn({ el: $(this.el).find('.let-talk-img').get(0), delay: 0.08 }),
				],
			});

			return this.masterReveal.ready;
		}

		animationScrub(){
			const decorWraps = $(this.el).find('.let-talk-decor-wrap').toArray();
			const scrollInner = $(this.el).find('.let-talk-scroll-inner')[0];
			let isScrollInnerHidden = false;
			const setScrollInnerHidden = (hidden) => {
				if (hidden === isScrollInnerHidden) return;
				isScrollInnerHidden = hidden;
				gsap.to(scrollInner, {
					yPercent: hidden ? 100 : 0,
					duration: 0.3,
					ease: 'power2.inOut',
					overwrite: true,
				});
			};
			const getWrapWidth = () => $(this.el).find('.let-talk-decor-inner')[0].getBoundingClientRect().width;
			const getDecorTranslateX = () => (
				getWrapWidth() / 2 - decorWraps[0].getBoundingClientRect().width
			);

			const itemServices = $(this.el).find('.let-talk-decor-service-inner').toArray();
			const footerItems = [
				$(this.el).find('.let-talk-footer-phone-inner')[0],
				$(this.el).find('.let-talk-footer-email-inner')[0],
				$(this.el).find('.let-talk-footer-link-inner')[0],
			].filter(Boolean);
			this.tlIntro = gsap.timeline({
				scrollTrigger: {
					trigger: $(this.el).find('.let-talk-top')[0],
					start: 'top top',
					end: 'bottom top',
					scrub: true,
					onUpdate: (self) => {
						if (self.direction > 0 && self.progress > 0) {
							setScrollInnerHidden(true);
						} else if (self.direction < 0 && self.progress === 0) {
							setScrollInnerHidden(false);
						}
					},
					onLeave: () => {
						gsap.to(footerItems, {
							yPercent: 0,
							duration: 0.3,
							ease: 'power2.inOut',
							stagger: 0.02,
							overwrite: true,
						});
					},
				},
			});

			this.tlIntro
				.to($(this.el).find('.let-talk-top .h0')[0], { scale: 0.6, ease: 'none', duration: 1 })
				.to($(this.el).find('.let-talk-decor')[0], { yPercent: -15, ease: 'none' }, '<')
				.to(decorWraps[0], { x: () => getDecorTranslateX(), ease: 'none', duration: 1 }, '<')
				.to(decorWraps[1], { x: () => -getDecorTranslateX(), ease: 'none', duration: 1 }, '<')
				.to(itemServices, { yPercent: -100, ease: 'power4.inOut', duration: 0.3 },);
		}
		
		interact() {
			this.footerLinkCleanups.forEach((cleanup) => cleanup());
			this.footerLinkCleanups = [];

			$(this.el).find('.let-talk-footer-link').toArray().forEach((link) => {
				let hoverFrame = null;
				const handleHoverPoint = (event) => {
					const bounds = event.currentTarget.getBoundingClientRect();
					const x = ((event.clientX - bounds.left) / bounds.width) * 100;
					const y = ((event.clientY - bounds.top) / bounds.height) * 100;
					$(event.currentTarget).css({
						'--footer-icon-hover-x': `${x}%`,
						'--footer-icon-hover-y': `${y}%`,
					});
				};
				const handlePointerEnter = (event) => {
					handleHoverPoint(event);
					if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
					$(link).removeClass(['is-hovered']);
					getComputedStyle(link, '::before').clipPath;
					hoverFrame = requestAnimationFrame(() => {
						$(link).addClass(['is-hovered']);
						hoverFrame = null;
					});
				};
				const handlePointerLeave = (event) => {
					handleHoverPoint(event);
					if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
					getComputedStyle(link, '::before').clipPath;
					hoverFrame = requestAnimationFrame(() => {
						$(link).removeClass(['is-hovered']);
						hoverFrame = null;
					});
				};

				$(link).on('pointerenter', handlePointerEnter);
				$(link).on('pointerleave', handlePointerLeave);
				this.footerLinkCleanups.push(() => {
					$(link).off('pointerenter', handlePointerEnter);
					$(link).off('pointerleave', handlePointerLeave);
					if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
					$(link).removeClass(['is-hovered']);
				});
			});
		}

		destroy() {
			this.footerLinkCleanups.forEach((cleanup) => cleanup());
			this.footerLinkCleanups = [];
			this.masterReveal?.destroy();
			this.footerReveal?.destroy();
			this.tlOnce?.kill();
			this.tlEnter?.kill();
			this.tlIntro?.kill();
			this.tlMove?.kill();
			this.footerRevealTimeline?.kill();
			this.masterReveal = null;
			this.revealReady = null;
			this.footerReveal = null;
			this.footerRevealTimeline = null;
			this.footerRevealReady = null;
			this.footerRevealRequested = false;
			this.el = null;
		}
	},
};
