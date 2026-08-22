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
			this.el = data.next.container.querySelector('.let-talk-wrap');
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
			const decorWraps = this.el.querySelectorAll('.let-talk-decor-wrap');
			const getWrapWidth = () => this.el.querySelector('.let-talk-decor-inner').getBoundingClientRect().width;
			const getDecorTranslateX = () => (
				getWrapWidth() / 2 - decorWraps[0].getBoundingClientRect().width
			);

			const itemServices = this.el.querySelectorAll('.let-talk-decor-service-inner');
			const itemPhone = this.el.querySelector('.let-talk-footer-phone-inner');
			const itemEmail = this.el.querySelector('.let-talk-footer-email-inner');
			const itemLinks = this.el.querySelector('.let-talk-footer-link-inner');
			const scrollText = this.el.querySelector('.let-talk-scroll-inner');

			this.tlIntro = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.let-talk-top'),
					start: 'top top',
					endTrigger: this.el.querySelector('.let-talk-top .heading'),
					end: 'bottom top',
					scrub: 1,
				},
			});

			this.tlMove = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.let-talk-top .heading'),
					start: 'bottom top',
					endTrigger: this.el,
					end: 'bottom bottom',
					scrub: 1
				},
			});

			this.tlIntro
			.to(this.el.querySelector('.let-talk-top .heading'), { scale: 0.68, ease: 'power3.out' })
			.to(decorWraps[0], { x: () => getDecorTranslateX(), ease: 'power3.inOut' }, '<')
			.to(decorWraps[1], { x: () => -getDecorTranslateX(), ease: 'power3.inOut' }, '<')
				.to(this.el.querySelector('.let-talk-decor'), { yPercent: -15, ease: 'power3.inOut' }, '<');


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

			this.el.querySelectorAll('.let-talk-footer-link').forEach((link) => {
				let hoverFrame = null;
				const handleHoverPoint = (event) => {
					const bounds = event.currentTarget.getBoundingClientRect();
					const x = ((event.clientX - bounds.left) / bounds.width) * 100;
					const y = ((event.clientY - bounds.top) / bounds.height) * 100;
					event.currentTarget.style.setProperty('--footer-icon-hover-x', `${x}%`);
					event.currentTarget.style.setProperty('--footer-icon-hover-y', `${y}%`);
				};
				const handlePointerEnter = (event) => {
					handleHoverPoint(event);
					if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
					link.classList.remove('is-hovered');
					getComputedStyle(link, '::before').clipPath;
					hoverFrame = requestAnimationFrame(() => {
						link.classList.add('is-hovered');
						hoverFrame = null;
					});
				};
				const handlePointerLeave = (event) => {
					handleHoverPoint(event);
					if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
					getComputedStyle(link, '::before').clipPath;
					hoverFrame = requestAnimationFrame(() => {
						link.classList.remove('is-hovered');
						hoverFrame = null;
					});
				};

				link.addEventListener('pointerenter', handlePointerEnter, { passive: true });
				link.addEventListener('pointerleave', handlePointerLeave, { passive: true });
				this.footerLinkCleanups.push(() => {
					link.removeEventListener('pointerenter', handlePointerEnter);
					link.removeEventListener('pointerleave', handlePointerLeave);
					if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
					link.classList.remove('is-hovered');
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
