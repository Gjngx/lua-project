import { TriggerSetup } from '../../core/trigger-setup.js';
import { gsap, ScrollTrigger } from '../../core/gsap.js';
import { cvUnit, ParallaxImage } from '../../core/helpers.js';

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
				scale: 0.3072,
				transformOrigin: 'left center',
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
			this.tlHeroEnd
				.to(this.el.querySelector('.home-hero-bg-overlay-main'), { opacity: 0.85, ease: 'none' })
				.to(this.el.querySelector('.home-hero-bottom-inner'), { yPercent: -10, scale: 1.1, ease: 'none' }, '<')
				.to(this.el.querySelector('.home-hero-bg-inner'), { scale: 2.5, ease: 'none' }, '<');
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
			this.tlWorksScroll = null;
		}

		trigger(data) {
			this.el = data.next.container.querySelector('.home-works-wrap');
			if (!this.el) return;
			super.setTrigger(this.el, this.onTrigger.bind(this));
			
			// Gọi hiệu ứng parallax cho các hình ảnh trong mục Works
			this.parallaxImages = [];
			this.el.querySelectorAll('.home-works-item-img img').forEach(el => {
				this.parallaxImages.push(new ParallaxImage({ el, scaleOffset: 0.15 }));
			});

			// Tạo trigger cho từng item riêng lẻ
			this.itemTriggers = [];
			this.el.querySelectorAll('.home-works-item').forEach((item) => {
				const tl = gsap.timeline({
					scrollTrigger: {
						trigger: item,
						start: 'top bottom',
						end: 'bottom top',
						scrub: true,
					}
				});
				
				tl.fromTo(item.querySelector('.home-works-item-img'), 
					{ scale: 0.9, yPercent: 0 }, 
					{ scale: 1, yPercent: -20, ease: 'power3.out' }
				);
				
				this.itemTriggers.push(tl);
			});
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
					trigger: this.el.querySelector('.home-works-list'),
					start: 'bottom bottom',
					end: 'bottom top',
					scrub: true,
				}
			});
			this.tlWorksTop
				.to(this.el.querySelector('.home-works-decor'), { opacity: 0, ease: 'none' });
			this.tlWorksScroll = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-works-empty'),
					start: 'top bottom',
					end: 'bottom bottom',
					scrub: true,
				}
			});

			this.tlWorksScroll
			.to(this.el.querySelector('.home-works-trans-inner'), {
				rotate: 360,
				duration: 1,
				ease: 'none'
			})
			.to(this.el.querySelectorAll('.home-works-trans-item-inner'), {
				x: 0,
				y: 0,
				scale: 4.6,
				duration: 1,
				ease: 'none'
			}, '<')
			.to(this.el.querySelectorAll('.home-works-main'), {
				opacity: 0,
				scale: 1.1,
				duration: 0.2,
				ease: 'power3.inOut'
			}, '<=0.48')
			.fromTo(this.el.querySelectorAll('.home-works-bottom-title'),
				{ opacity: 0, scale: 1.05 },
				{
					opacity: 1,
					scale: 1,
					duration: 0.2,
					ease: 'power3.inOut'
				},
				'<'
			)
			.fromTo(this.el,
				{ backgroundColor: 'var(--cl-white)'},
				{
					backgroundColor: 'var(--cl-bg-main)',
					duration: 0.2,
					ease: 'power3.inOut'
				},
				'<'
			)
			.to(this.el.querySelectorAll('.home-works-trans'), {
				opacity: 0,
				duration: 0.25,
				ease: 'none'
			}, 0.75);
		}

		interact() {
		}

		destroy() {
			super.cleanTrigger();
			if (this.tlWorksTop) this.tlWorksTop.kill();
			if (this.tlWorksScroll) this.tlWorksScroll.kill();
			
			if (this.parallaxImages) {
				this.parallaxImages.forEach(img => img.destroy());
			}
			
			if (this.itemTriggers) {
				this.itemTriggers.forEach(tl => tl.kill());
			}
		}
	},
	How: class extends TriggerSetup {
		constructor() {
			super();
			this.el = null;
			this.tlHowScroll = null;
		}

		trigger(data) {
			this.el = data.next.container.querySelector('.home-how-wrap');
			if (!this.el) return;
			super.setTrigger(this.el, this.onTrigger.bind(this));
		}

		onTrigger() {
			this.setup();
			this.animationReveal();
			this.animationScrub();
			this.interact();
		}

		setup() {
			console.log('How Setup');
		}

		animationReveal() {
		}

		animationScrub() {
			// this.tlHowScroll = gsap.timeline({
			// 	scrollTrigger: {
			// 		trigger: this.el.querySelector('.home-how-list-empty'),
			// 		start: 'top bottom',
			// 		end: 'top top',
			// 		scrub: true,
			// 	}
			// });
			// this.tlHowScroll
			// 	.to(this.el.querySelector('.home-how'), { autoAlpha: 0, ease: 'none' });
		}

		interact() {
		}

		destroy() {
			super.cleanTrigger();
			if (this.tlHowScroll) this.tlHowScroll.kill();
		}
	}
};
