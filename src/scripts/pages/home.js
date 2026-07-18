import { TriggerSetup } from '../../core/trigger-setup.js';
import { gsap, ScrollTrigger } from '../../core/gsap.js';
import { cvUnit } from '../../core/helpers.js';

export const HomePage = {
	Hero: class {
		constructor() {
			this.el = null;
			this.tlOnce = null;
			this.tlEnter = null;
			this.tlHeroScroll = null;
			this.tlHeroTop = null;
			this.tlHeroBot = null;
			this.tlHeroEnd = null;

		}

		setup(data, mode) {
			this.el = data.next.container.querySelector('.home-hero-wrap');
			if (!this.el) return;

			this.interact();

			if (mode === 'once') {
				this.setupOnce(data);
			} else if (mode === 'enter') {
				this.setupEnter(data);
			}
		}

		setupOnce(data) {
			this.animationScrub(); // Đưa ra ngoài để chạy ngay
			
			this.tlOnce = gsap.timeline({
				paused: true,
			});

			this.animationReveal(this.tlOnce);
		}

		setupEnter(data) {
			this.animationScrub(); // Đưa ra ngoài để chạy ngay

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
			// Thêm animation khi trang xuất hiện (Reveal Animation)
		}

		animationScrub() {
			gsap.set(this.el.querySelector('.home-hero-decor-inner'), {
				xPercent: -96,
				yPercent: 76,
				opacity: 1
			});
			this.tlHeroScroll = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-hero'),
					start: 'top top',
					end: `bottom-=${cvUnit(100, 'vh')} bottom`,
					scrub: true,
				}
			});
			this.tlHeroScroll.to(this.el.querySelector('.home-hero-bg-inner'), {
				scale: 2,
				transformOrigin: 'top center',
				ease: 'none'
			});

			this.tlHeroTop = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-hero-top.top-left'),
					start: 'top top',
					end: 'bottom top',
					scrub: true,
				}
			});
			this.tlHeroTop.to(this.el.querySelector('.home-hero-logo-ic'), {
				width: cvUnit(20, 'rem'),
				ease: 'none'
			});

			this.tlHeroBot = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-hero-bottom'),
					start: 'top center',
					end: 'bottom center',
					scrub: true,
				}
			});
			this.tlHeroBot.to(this.el.querySelector('.home-hero-decor-inner'), {
				xPercent: 70,
				yPercent: -175,
				ease: 'none'
			});

			this.tlHeroEnd = gsap.timeline({
				scrollTrigger: {
					trigger: '.home-works',
					start: 'top bottom',
					end: 'top top',
					scrub: true,
				}
			});
			this.tlHeroEnd.to(this.el.querySelector('.home-hero-bg-overlay-main'), {
				opacity: 0.85,
				ease: 'none'
			});
		}

		interact() {
			// Thêm các tương tác click, hover
		}

		destroy() {
			if (this.tlOnce) this.tlOnce.kill();
			if (this.tlEnter) this.tlEnter.kill();
			if (this.tlHeroScroll) this.tlHeroScroll.kill();
			if (this.tlHeroTop) this.tlHeroTop.kill();
			if (this.tlHeroBot) this.tlHeroBot.kill();
			if (this.tlHeroEnd) this.tlHeroEnd.kill();
		}
	},

	Works: class extends TriggerSetup {
		constructor() {
			super();
			this.el = null;
			this.tlWorksTop = null;
		}

		trigger(data) {
			this.el = data.next.container.querySelector('.home-works-wrap');
			if (!this.el) return;

			// Gọi onTrigger khi cuộn đến section này
			super.setTrigger(this.el, this.onTrigger.bind(this));
		}

		onTrigger() {
			this.setup();
			this.animationReveal();
			this.animationScrub();
			this.interact();
		}

		setup() {
			console.log('Works Setup');
		}

		animationReveal() {
		}

		animationScrub() {
			this.tlWorksTop = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-works'),
					start: 'top bottom',
					end: 'top top',
					scrub: true,
				}
			});
			this.tlWorksTop.to(this.el.querySelector('.home-works-svg'), {
				color: 'var(--cl-brand-soft)',
				ease: 'power4.inOut'
			});
		}

		interact() {
		}

		destroy() {
			super.cleanTrigger();
			if (this.tlWorksTop) this.tlWorksTop.kill();
		}
	}
};
