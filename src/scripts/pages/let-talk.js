import { gsap, ScrollTrigger } from '../../core/gsap.js';

export const LetTalkPage = {
	Hero: class {
		constructor() {
			this.el = null;
			this.footerLinkCleanups = [];
			this.tlIntro = null;
			this.tlMove = null;
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
		}

		setupOnce(data) {
			this.animationScrub();

			this.tlOnce = gsap.timeline({
				paused: true,
			});

			this.animationReveal(this.tlOnce);
		}

		setupEnter(data) {
			this.animationScrub();

			this.tlEnter = gsap.timeline({
				paused: true,
			});

			this.animationReveal(this.tlEnter);
		}

		playOnce() {
			if (this.tlOnce) {
				this.tlOnce.play();
			}
		}

		playEnter() {
			if (this.tlEnter) {
				this.tlEnter.play();
			}
		}

		animationReveal(timeline) {
			
		}

		animationScrub(){
			const decorWraps = $(this.el).find('.let-talk-decor-wrap').toArray();
			const getWrapWidth = () => $(this.el).find('.let-talk-decor-inner')[0].getBoundingClientRect().width;
			const getDecorTranslateX = () => (
				getWrapWidth() / 2 - decorWraps[0].getBoundingClientRect().width
			);

			const itemServices = $(this.el).find('.let-talk-decor-service-inner').toArray();
			const itemPhone = $(this.el).find('.let-talk-footer-phone-inner')[0];
			const itemEmail = $(this.el).find('.let-talk-footer-email-inner')[0];
			const itemLinks = $(this.el).find('.let-talk-footer-link-inner')[0];
			const scrollText = $(this.el).find('.let-talk-scroll-inner')[0];

			this.tlIntro = gsap.timeline({
				scrollTrigger: {
					trigger: $(this.el).find('.let-talk-top')[0],
					start: 'top top',
					endTrigger: $(this.el).find('.let-talk-top .heading')[0],
					end: 'bottom top',
					scrub: 1,
				},
			});

			this.tlMove = gsap.timeline({
				scrollTrigger: {
					trigger: $(this.el).find('.let-talk-top .heading')[0],
					start: 'bottom top',
					endTrigger: this.el,
					end: 'bottom bottom',
					scrub: 1
				},
			});

			this.tlIntro
			.to($(this.el).find('.let-talk-top .heading')[0], { scale: 0.68, ease: 'power3.out' })
			.to(decorWraps[0], { x: () => getDecorTranslateX(), ease: 'power3.inOut' }, '<')
			.to(decorWraps[1], { x: () => -getDecorTranslateX(), ease: 'power3.inOut' }, '<')
				.to($(this.el).find('.let-talk-decor')[0], { yPercent: -15, ease: 'power3.inOut' }, '<');


			this.tlMove
			.to(itemServices, { yPercent: -100, ease: 'power3.inOut', duration: 0.6 })
			.to(itemPhone, { yPercent: -100, ease: 'power3.inOut', duration: 0.4 })
			.to(itemEmail, { yPercent: -100, ease: 'power3.inOut', duration: 0.4 })
			.to(itemLinks, { yPercent: -100, ease: 'power3.inOut', duration: 0.4 })
			.to(scrollText, { yPercent: -100, ease: 'power3.inOut', duration: 0.4 }, '<');
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
			this.tlIntro?.kill();
			this.tlMove?.kill();
			this.el = null;
		}
	},
};
