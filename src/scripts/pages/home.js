import { TriggerSetup } from '../../core/trigger-setup.js';
import { gsap, ScrollTrigger } from '../../core/gsap.js';
import { cvUnit, ParallaxImage } from '../../core/helpers.js';

const HERO_VIDEO_FPS = 24;
const HERO_VIDEO_SEEK_THRESHOLD = 1 / (HERO_VIDEO_FPS * 2);

export const HomePage = {
	Hero: class {
		constructor() {
			this.el = null;
			this.video = null;
			this.videoDuration = 0;
			this.videoTargetTime = 0;
			this.videoRaf = null;
			this.videoReady = false;
			this.videoNeedsSeek = false;
			this.videoScrollTrigger = null;
			this.worksEl = null;
			this.onVideoMetadata = null;
			this.onVideoReady = null;
			this.onVideoSeeked = null;
			this.onVideoError = null;
			this.onVisibilityChange = null;
			this.tlOnce = null;
			this.tlEnter = null;
			this.tlHeroTop = null;
			this.tlHeroBot = null;
			this.tlHeroEnd = null;

		}

		setup(data, mode) {
			this.el = data.next.container.querySelector('.home-hero-wrap');
			if (!this.el) return;

			this.video = this.el.querySelector('.home-hero-video');
			this.worksEl = data.next.container.querySelector('.home-works-wrap');
			this.setupHeroVideo();
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

		setupHeroVideo() {
			if (!this.video) return;

			const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			const prefersReducedData = Boolean(navigator.connection?.saveData);

			if (prefersReducedMotion || prefersReducedData) {
				this.video.preload = 'none';
				this.video.dataset.scrollVideoDisabled = '';
				return;
			}

			this.onVideoMetadata = () => {
				if (!this.video || !Number.isFinite(this.video.duration)) return;

				this.videoDuration = Math.max(0, this.video.duration - 1 / HERO_VIDEO_FPS);
				this.video.pause();
				this.setupVideoScrollTrigger();
			};

			this.onVideoReady = () => {
				if (!this.video) return;

				this.videoReady = true;
				this.video.classList.add('is-video-ready');
				this.queueVideoSeek(this.videoTargetTime);
			};

			this.onVideoSeeked = () => {
				this.videoNeedsSeek = false;

				if (
					this.video &&
					Math.abs(this.video.currentTime - this.videoTargetTime) >= HERO_VIDEO_SEEK_THRESHOLD
				) {
					this.queueVideoSeek(this.videoTargetTime);
				}
			};

			this.onVideoError = () => {
				this.videoReady = false;
				this.video?.classList.add('is-video-error');
				this.videoScrollTrigger?.kill();
				this.videoScrollTrigger = null;
			};

			this.onVisibilityChange = () => {
				if (!document.hidden) {
					this.queueVideoSeek(this.videoTargetTime);
				}
			};

			this.video.addEventListener('loadedmetadata', this.onVideoMetadata);
			this.video.addEventListener('loadeddata', this.onVideoReady);
			this.video.addEventListener('seeked', this.onVideoSeeked);
			this.video.addEventListener('error', this.onVideoError);
			document.addEventListener('visibilitychange', this.onVisibilityChange);

			if (this.video.readyState >= 1) {
				this.onVideoMetadata();
			}
			if (this.video.readyState >= 2) {
				this.onVideoReady();
			}
		}

		setupVideoScrollTrigger() {
			if (!this.video || !this.videoDuration || this.videoScrollTrigger) return;

			this.videoScrollTrigger = ScrollTrigger.create({
				trigger: this.el,
				start: 'top top',
				endTrigger: this.worksEl || this.el,
				end: this.worksEl ? 'top top' : 'bottom bottom',
				invalidateOnRefresh: true,
				onUpdate: (self) => {
					this.queueVideoSeek(self.progress * this.videoDuration);
				},
				onRefresh: (self) => {
					this.queueVideoSeek(self.progress * this.videoDuration);
				}
			});

			this.queueVideoSeek(this.videoScrollTrigger.progress * this.videoDuration);
		}

		queueVideoSeek(time) {
			if (!this.video || !this.videoDuration) return;

			this.videoTargetTime = Math.min(this.videoDuration, Math.max(0, time));

			if (!this.videoReady || document.hidden || this.videoRaf !== null) return;

			this.videoRaf = window.requestAnimationFrame(() => {
				this.videoRaf = null;
				this.flushVideoSeek();
			});
		}

		flushVideoSeek() {
			if (!this.video || !this.videoReady || document.hidden) return;

			if (Math.abs(this.video.currentTime - this.videoTargetTime) < HERO_VIDEO_SEEK_THRESHOLD) {
				return;
			}

			if (this.video.seeking) {
				this.videoNeedsSeek = true;
				return;
			}

			this.videoNeedsSeek = false;

			try {
				this.video.currentTime = this.videoTargetTime;
			} catch (error) {
				console.warn('[Home Hero] Không thể seek video:', error);
			}
		}

		animationScrub() {
			gsap.set(this.el.querySelector('.home-hero-decor-inner'), {
				xPercent: -96,
				yPercent: 76,
				opacity: 1
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
		}

		interact() {
			// Thêm các tương tác click, hover
		}

		destroy() {
			if (this.videoRaf !== null) {
				window.cancelAnimationFrame(this.videoRaf);
				this.videoRaf = null;
			}
			if (this.videoScrollTrigger) this.videoScrollTrigger.kill();
			if (this.video) {
				this.video.pause();
				if (this.onVideoMetadata) this.video.removeEventListener('loadedmetadata', this.onVideoMetadata);
				if (this.onVideoReady) this.video.removeEventListener('loadeddata', this.onVideoReady);
				if (this.onVideoSeeked) this.video.removeEventListener('seeked', this.onVideoSeeked);
				if (this.onVideoError) this.video.removeEventListener('error', this.onVideoError);
			}
			if (this.onVisibilityChange) {
				document.removeEventListener('visibilitychange', this.onVisibilityChange);
			}
			if (this.tlOnce) this.tlOnce.kill();
			if (this.tlEnter) this.tlEnter.kill();
			if (this.tlHeroTop) this.tlHeroTop.kill();
			if (this.tlHeroBot) this.tlHeroBot.kill();
			if (this.tlHeroEnd) this.tlHeroEnd.kill();

			this.video = null;
			this.worksEl = null;
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
				rotate: 125,
				duration: 1,
				ease: 'none'
			})
			.to(this.el.querySelectorAll('.home-works-trans-item-inner'), {
				x: 0,
				y: 0,
				scale: 12,
				duration: 1,
				ease: 'none',
				force3D: false,
			}, '<')
			.to(this.el.querySelectorAll('.home-works-main'), {
				opacity: 0,
				scale: 1.1,
				duration: 0.2,
				ease: 'power3.inOut'
			}, '<=0.15')
			.fromTo(this.el.querySelectorAll('.home-works-bottom-title'),
				{ opacity: 0, scale: 1.2 },
				{
					opacity: 1,
					scale: 1,
					duration: 0.2,
					ease: 'power3.inOut'
				},
				'<=' // <= 0.15
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
			this.tlIntroScroll = null;
			this.tlItemScroll = null;

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

			this.tlIntroScroll = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-how-intro'),
					start: 'top bottom',
					end: 'top top+=40%',
					scrub: true,
				}
			});
			this.tlIntroScroll
				.to(document.querySelector('.home-works-bottom'), { y: '38vh', ease: 'none' });

			this.tlItemScrolls = [];
			const thumbItems = this.el.querySelectorAll('.home-how-thumb-item');
			const contentItems = this.el.querySelectorAll('.home-how-content-item');
			const contentList = this.el.querySelector('.home-how-content-list');

      const thumbHieght = thumbItems[0].offsetHeight;
      if (thumbItems.length > 0) {
      	thumbItems[thumbItems.length - 1].style.paddingBottom = `calc(${thumbHieght / 2}px - 3.2rem)`;
      }

			thumbItems.forEach((thumb, index) => {
				const tl = gsap.timeline({
					scrollTrigger: {
						trigger: thumb,
						start: `top center+=${thumbHieght / 2}px`,
						end: `top center-=${thumbHieght / 2}px`,
						scrub: true,
						onEnter: () => {
							if (index === 0) contentList.classList.add('active-ic');
							contentItems.forEach(el => el.classList.remove('active'));
							if (contentItems[index]) contentItems[index].classList.add('active');
						},
						onEnterBack: () => {
							if (index === thumbItems.length - 1) contentList.classList.add('active-ic');
							contentItems.forEach(el => el.classList.remove('active'));
							if (contentItems[index]) contentItems[index].classList.add('active');
						},
						onLeave: () => {
							if (index === thumbItems.length - 1) contentList.classList.remove('active-ic');
							contentItems.forEach(el => el.classList.remove('active'));
						},
						onLeaveBack: () => {
							if (index === 0) contentList.classList.remove('active-ic');
							contentItems.forEach(el => el.classList.remove('active'));
						}
					}
				});
				this.tlItemScrolls.push(tl);
			});
		}

		interact() {
		}

		destroy() {
			super.cleanTrigger();
			if (this.tlIntroScroll) this.tlIntroScroll.kill();
			if (this.tlItemScrolls) {
				this.tlItemScrolls.forEach(tl => tl.kill());
			}
		}
	}
};
