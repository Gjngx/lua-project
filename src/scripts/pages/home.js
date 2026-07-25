import { TriggerSetup } from '../../core/trigger-setup.js';
import { gsap, ScrollTrigger } from '../../core/gsap.js';
import { cvUnit, ParallaxImage } from '../../core/helpers.js';
import { SvgPathParticles } from '../../core/svg-path-particles.js';

const HERO_VIDEO_FPS = 24;
const HERO_VIDEO_SEEK_THRESHOLD = 1 / (HERO_VIDEO_FPS * 2);
const WORKS_TRANSITION_ROTATION = 125;
const WORKS_TRANSITION_MAX_SCALE = 14;
const WORKS_TRANSITION_FALLBACK_SWAP_PROGRESS = 0.283;
const WORKS_TRANSITION_BACKGROUND_SPAN = 0.12;

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
			// this.tlHeroEnd = null;

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
			const homeLogoHeight = this.el.querySelector('.home-hero-logo').offsetHeight;
			gsap.set(this.el.querySelector('.home-hero-decor-inner'), {
				xPercent: -96,
				yPercent: 76,
				opacity: 1
			});

			this.tlHeroTop = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-hero-top.top-right'),
					start: 'top top',
					end: `bottom top+=${cvUnit(100, 'rem')}`,
					scrub: true
				}
			});
			this.tlHeroTop.
				to(this.el.querySelector('.home-hero-logo-ic'), {
					height: cvUnit(40, 'rem'),
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

			// this.tlHeroEnd = gsap.timeline({
			// 	scrollTrigger: {
			// 		trigger: '.home-works',
			// 		start: 'top bottom',
			// 		end: 'top top',
			// 		scrub: true,
			// 	}
			// });
			// this.tlHeroEnd
			// 	.to(this.el.querySelector('.home-hero-bg-overlay-main'), { opacity: 0.85, ease: 'none' })
			// 	.to(this.el.querySelector('.home-hero-bottom-inner'), { yPercent: -10, scale: 1.1, ease: 'none' }, '<')
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
			// if (this.tlHeroEnd) this.tlHeroEnd.kill();

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
			this.tlWorksDecorAssembly = null;
			this.worksPathParticles = null;
			this.transitionCanvas = null;
			this.transitionContext = null;
			this.transitionItems = null;
			this.transitionPaths = [];
			this.transitionState = null;
			this.transitionInner = null;
			this.transitionCurrentContent = null;
			this.transitionNextContent = null;
			this.transitionSwapProgress = WORKS_TRANSITION_FALLBACK_SWAP_PROGRESS;
			this.isNextContentVisible = null;
			this.transitionBackgroundTween = null;
			this.onTransitionResize = null;
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
			const decorSvg = this.el.querySelector('.home-works-svg svg');
			const decorCanvas = this.el.querySelector('.home-works-path-canvas');
			const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			if (decorSvg && decorCanvas && !prefersReducedMotion) {
				this.worksPathParticles = new SvgPathParticles(decorSvg, decorCanvas);
				const assemblyState = { progress: 0 };

				this.tlWorksDecorAssembly = gsap.timeline({
					scrollTrigger: {
						trigger: this.el.querySelector('.home-works--decor'),
						start: 'top bottom',
						end: 'top top',
						scrub: true,
						invalidateOnRefresh: true,
					}
				});

				this.tlWorksDecorAssembly.to(assemblyState, {
					progress: 1,
					duration: 1,
					ease: 'none',
					onUpdate: () => {
						this.worksPathParticles?.render(assemblyState.progress);
					},
				});
			}

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

			const transition = this.el.querySelector('.home-works-trans');
			const transitionInner = this.el.querySelector('.home-works-trans-inner');
			const transitionItems = this.el.querySelectorAll('.home-works-trans-item-inner');
			const currentContent = this.el.querySelector('.home-works-main');
			const nextContent = this.el.querySelector('.home-works-bottom-title');
			this.transitionInner = transitionInner;
			this.transitionItems = transitionItems;
			this.transitionCurrentContent = currentContent;
			this.transitionNextContent = nextContent;
			this.transitionState = {
				progress: 0,
				rotate: 0,
				scale: 1,
			};
			this.transitionBackgroundTween = gsap.to(this.el, {
				backgroundColor: 'var(--cl-bg-main)',
				duration: 1,
				ease: 'none',
				paused: true,
			});
			const usesCanvasMask = this.setupTransitionCanvas(transition, transitionItems);
			this.transitionSwapProgress = this.calculateTransitionSwapProgress();
			this.updateTransitionContent(true);

			this.tlWorksScroll.to(this.transitionState, {
				progress: 1,
				rotate: WORKS_TRANSITION_ROTATION,
				scale: WORKS_TRANSITION_MAX_SCALE,
				duration: 1,
				ease: 'none',
				onUpdate: () => {
					if (usesCanvasMask) {
						this.drawTransitionCanvas();
					} else {
						gsap.set(transitionInner, { rotate: this.transitionState.rotate });
						gsap.set(transitionItems, {
							scale: this.transitionState.scale,
							force3D: false,
						});
					}

					this.updateTransitionContent();
				},
			}, 0);
		}

		setupTransitionCanvas(transition, transitionItems) {
			const canvas = transition?.querySelector('.home-works-trans-canvas');
			const paths = Array.from(transitionItems)
				.map((item) => item.querySelector('path')?.getAttribute('d'))
				.filter(Boolean);

			if (!canvas || paths.length !== 4 || typeof window.Path2D !== 'function') {
				return false;
			}

			try {
				this.transitionPaths = paths.map((path) => new Path2D(path));
			} catch (error) {
				console.warn('[Home Works] Không thể tạo canvas mask:', error);
				this.transitionPaths = [];
				return false;
			}

			this.transitionCanvas = canvas;
			this.transitionContext = canvas.getContext('2d');
			this.transitionItems = transitionItems;

			if (!this.transitionContext) {
				return false;
			}

			transition.classList.add('is-canvas-active');
			this.onTransitionResize = () => {
				this.drawTransitionCanvas();
				this.transitionSwapProgress = this.calculateTransitionSwapProgress();
				this.updateTransitionContent(true);
			};
			window.addEventListener('resize', this.onTransitionResize);
			this.drawTransitionCanvas();
			return true;
		}

		calculateTransitionSwapProgress() {
			const canvas = this.transitionCanvas;
			const context = this.transitionContext;
			const firstItem = this.transitionItems?.[0];

			if (!canvas || !context || !firstItem || this.transitionPaths.length !== 4) {
				return WORKS_TRANSITION_FALLBACK_SWAP_PROGRESS;
			}

			const innerSize = Math.min(canvas.clientWidth, canvas.clientHeight);
			const shapeSize = firstItem.offsetWidth;

			if (!innerSize || !shapeSize) {
				return WORKS_TRANSITION_FALLBACK_SWAP_PROGRESS;
			}

			const halfShape = shapeSize / 2;
			const focalPoint = innerSize / 2;
			const shapeCenters = [
				[-halfShape, -halfShape],
				[innerSize + halfShape, -halfShape],
				[-halfShape, innerSize + halfShape],
				[innerSize + halfShape, innerSize + halfShape],
			];

			const overlapCountAt = (progress) => {
				const scale = 1 + (WORKS_TRANSITION_MAX_SCALE - 1) * progress;
				const pathScale = (shapeSize / 250) * scale;

				context.save();
				context.setTransform(1, 0, 0, 1, 0, 0);
				const overlapCount = this.transitionPaths.reduce((count, path, index) => {
					const [centerX, centerY] = shapeCenters[index];
					const pathX = (focalPoint - centerX) / pathScale + 125;
					const pathY = (focalPoint - centerY) / pathScale + 125;

					return count + Number(context.isPointInPath(path, pathX, pathY));
				}, 0);
				context.restore();

				return overlapCount;
			};

			if (overlapCountAt(1) < 2) {
				return WORKS_TRANSITION_FALLBACK_SWAP_PROGRESS;
			}

			let start = 0;
			let end = 1;

			for (let index = 0; index < 24; index += 1) {
				const middle = (start + end) / 2;

				if (overlapCountAt(middle) >= 2) {
					end = middle;
				} else {
					start = middle;
				}
			}

			return Math.min(1, end + 0.002);
		}

		updateTransitionContent(force = false) {
			if (
				!this.transitionState ||
				!this.transitionCurrentContent ||
				!this.transitionNextContent
			) {
				return;
			}

			const showNextContent = this.transitionState.progress >= this.transitionSwapProgress;
			const backgroundProgress = gsap.utils.clamp(
				0,
				1,
				(this.transitionState.progress - this.transitionSwapProgress) /
					WORKS_TRANSITION_BACKGROUND_SPAN
			);

			this.transitionBackgroundTween?.progress(backgroundProgress);

			if (!force && showNextContent === this.isNextContentVisible) {
				return;
			}

			this.isNextContentVisible = showNextContent;
			gsap.to(this.transitionCurrentContent, {
				opacity: showNextContent ? 0 : 1,
				duration: 0.01,
				overwrite: true,
			});
			gsap.to(this.transitionNextContent, {
				opacity: showNextContent ? 1 : 0,
				duration: 0.01,
				overwrite: true,
			});
		}

		drawTransitionCanvas() {
			const canvas = this.transitionCanvas;
			const context = this.transitionContext;
			const state = this.transitionState;
			const firstItem = this.transitionItems?.[0];

			if (!canvas || !context || !state || !firstItem || this.transitionPaths.length !== 4) {
				return;
			}

			const width = canvas.clientWidth;
			const height = canvas.clientHeight;
			const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
			const renderWidth = Math.round(width * pixelRatio);
			const renderHeight = Math.round(height * pixelRatio);

			if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
				canvas.width = renderWidth;
				canvas.height = renderHeight;
			}

			const innerSize = Math.min(width, height);
			const innerLeft = (width - innerSize) / 2;
			const shapeSize = firstItem.offsetWidth;
			const shapeScale = (shapeSize / 250) * state.scale;
			const halfShape = shapeSize / 2;
			const shapeCenters = [
				[-halfShape, -halfShape],
				[innerSize + halfShape, -halfShape],
				[-halfShape, innerSize + halfShape],
				[innerSize + halfShape, innerSize + halfShape],
			];

			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
			context.clearRect(0, 0, width, height);
			context.save();
			context.translate(innerLeft + innerSize / 2, innerSize / 2);
			context.rotate((state.rotate * Math.PI) / 180);
			context.translate(-innerSize / 2, -innerSize / 2);
			context.globalCompositeOperation = 'xor';
			context.fillStyle = getComputedStyle(canvas).color;

			this.transitionPaths.forEach((path, index) => {
				const [centerX, centerY] = shapeCenters[index];

				context.save();
				context.translate(centerX, centerY);
				context.scale(shapeScale, shapeScale);
				context.translate(-125, -125);
				context.fill(path);
				context.restore();
			});

			context.restore();
		}

		interact() {
		}

		destroy() {
			super.cleanTrigger();
			if (this.tlWorksDecorAssembly?.scrollTrigger) {
				this.tlWorksDecorAssembly.scrollTrigger.kill();
			}
			if (this.tlWorksDecorAssembly) this.tlWorksDecorAssembly.kill();
			if (this.worksPathParticles) this.worksPathParticles.destroy();
			if (this.tlWorksTop) this.tlWorksTop.kill();
			if (this.tlWorksScroll) this.tlWorksScroll.kill();
			if (this.transitionBackgroundTween) this.transitionBackgroundTween.kill();
			if (this.onTransitionResize) {
				window.removeEventListener('resize', this.onTransitionResize);
			}
			
			if (this.parallaxImages) {
				this.parallaxImages.forEach(img => img.destroy());
			}
			
			if (this.itemTriggers) {
				this.itemTriggers.forEach(tl => tl.kill());
			}

			this.transitionCanvas = null;
			this.transitionContext = null;
			this.transitionItems = null;
			this.transitionPaths = [];
			this.transitionState = null;
			this.transitionInner = null;
			this.transitionCurrentContent = null;
			this.transitionNextContent = null;
			this.transitionSwapProgress = WORKS_TRANSITION_FALLBACK_SWAP_PROGRESS;
			this.isNextContentVisible = null;
			this.transitionBackgroundTween = null;
			this.onTransitionResize = null;
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
				.to(document.querySelector('.home-works-bottom'), { y: '30vh', ease: 'none' })


			this.tlItemScrolls = [];
			const thumbItems = this.el.querySelectorAll('.home-how-thumb-item');
			const contentItems = this.el.querySelectorAll('.home-how-content-item');
			const contentList = this.el.querySelector('.home-how-content-list');

			thumbItems.forEach((thumb, index) => {
				const frame = thumb.querySelector('.home-how-thumb-item-inner');
				const direction = index % 2 === 0 ? 1 : -1;
				const clipPath = this.el.querySelector(`#home-how-clip-${index + 1} path`);
				const shapeA = 'M .055 .098 L .985 .002 Q 1 0 .998 .015 L .953 .985 Q .95 1 .935 .998 L .015 .882 Q 0 .88 .002 .865 L .038 .115 Q .04 .1 .055 .098 Z';
				const shapeB = 'M .015 .002 L .945 .098 Q .96 .1 .962 .115 L .998 .865 Q 1 .88 .985 .882 L .065 .998 Q .05 1 .047 .985 L .002 .015 Q 0 0 .015 .002 Z';
				const fromShape = direction === 1 ? shapeA : shapeB;
				const toShape = direction === 1 ? shapeB : shapeA;
				gsap.set(frame, { clipPath: `url(#home-how-clip-${index + 1})` });
				const tl = gsap.timeline({
					scrollTrigger: {
						trigger: thumb,
						start: 'top bottom',
						end: 'bottom top',
						scrub: true,
					}
				});

				tl
					.fromTo(
						frame,
						{ scale: 0.5 },
						{
							scale: 0.75,
							duration: 0.25,
							ease: 'none'
						}
					)
					.fromTo(clipPath, { attr: { d: fromShape } }, {
						attr: { d: toShape },
						duration: 0.25,
						ease: 'none'
					}, 0)
					.to(frame, {
						scale: 1,
						duration: 0.25,
						ease: 'none'
					})
					.to(clipPath, { attr: { d: fromShape }, duration: 0.25, ease: 'none' }, '<')
					.to(frame, {
						scale: 0.75,
						duration: 0.25,
						ease: 'none'
					})
					.to(clipPath, { attr: { d: toShape }, duration: 0.25, ease: 'none' }, '<')
					.to(frame, {
						scale: 0.5,
						duration: 0.25,
						ease: 'none'
					})
					.to(clipPath, { attr: { d: fromShape }, duration: 0.25, ease: 'none' }, '<');

				this.tlItemScrolls.push(tl);

				const contentTrigger = ScrollTrigger.create({
					trigger: thumb,
					start: `top center`,
					end: `bottom center`,
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
				});
				this.tlItemScrolls.push(contentTrigger);
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
