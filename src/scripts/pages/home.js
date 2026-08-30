import { TriggerSetup } from '../../core/trigger-setup.js';
import { gsap, ScrollTrigger } from '../../core/gsap.js';
import { cvUnit, viewport } from '../../core/helpers.js';
import { smoothScroll } from '../../core/lenis.js';
import { SvgPathParticles } from '../../core/svg-path-particles.js';
import { footer } from '../../core/components/footer.js';

import { MasterTimeline, FadeIn, FadeSplitText } from '../../core/animation.js';

const HERO_VIDEO_FPS = 24;
const HERO_VIDEO_SEEK_THRESHOLD = 1 / (HERO_VIDEO_FPS * 2);
const WORKS_TRANSITION_ROTATION = 125;
const WORKS_TRANSITION_MAX_SCALE = 16;
const WORKS_TRANSITION_FALLBACK_SWAP_PROGRESS = 0.283;
const WORKS_TRANSITION_BACKGROUND_SPAN = 0.12;
const WORKS_TRANSITION_COVER_START = 0.5;
const PLAYGROUND_SPHERE_RADIUS_REM = 500;

export const HomePage = {
	Hero: class {
		constructor() {
			this.el = null;
			this.video = null;
			this.videoDuration = 0;
			this.videoTargetTime = 0;
			this.videoRaf = null;
			this.videoReady = false;
			this.videoPrimeStarted = false;
			this.videoNeedsSeek = false;
			this.videoScrollTrigger = null;
			this.worksEl = null;
			this.onVideoMetadata = null;
			this.onVideoReady = null;
			this.onVideoSeeked = null;
			this.onVideoError = null;
			this.onVisibilityChange = null;
			this.onVideoUnlock = null;
			this.timeEl = null;
			this.timeTimer = null;
			this.updateHeroTime = null;
			this.tlOnce = null;
			this.tlEnter = null;
			this.tlHeroTop = null;
			this.tlHeroBot = null;
			this.tlHeroBotEnd = null;
			this.tlHeroTextColor = null;
			this.heroTextOriginalHTML = null;
			this.masterReveal = null;
			this.bottomDescReveal = null;
			this.revealReady = null;
		}

		setup(data, mode) {
			this.el = $(data.next.container).find('.home-hero-wrap')[0];
			if (!this.el) return;

			this.video = $(this.el).find('.home-hero-video')[0];
			this.worksEl = $(data.next.container).find('.home-works-wrap')[0];
			this.setupHeroTime();
			this.setupHeroVideo();
			this.interact();

			if (mode === 'once') {
				this.setupOnce(data);
			} else if (mode === 'enter') {
				this.setupEnter(data);
			}
		}

		setupOnce(data) {
			this.tlOnce = gsap.timeline({
				paused: true,
				delay: 0.2,
				onStart: () => {
					$(this.el).find('[data-init-hidden]').removeAttr('data-init-hidden');
				},
				onComplete: () => {
					this.animationScrub();
					this.startHeroTime();
				},
			});

			this.revealReady = this.animationReveal(this.tlOnce);
			this.tlOnce.to({}, { duration: 0.001 });
		}

		setupEnter(data) {
			this.tlEnter = gsap.timeline({
				paused: true,
				delay: 0.3,
				onStart: () => {
					$(this.el).find('[data-init-hidden]').removeAttr('data-init-hidden');
				},
				onComplete: () => {
					this.animationScrub();
					this.startHeroTime();
				},
			});

			this.revealReady = this.animationReveal(this.tlEnter, { includeTitle: true });
			this.tlEnter.to({}, { duration: 0.001 });
		}

		async playOnce() {
			await this.revealReady;
			if (!this.el?.isConnected || !this.tlOnce?.duration()) return;
			this.tlOnce.play(0);
		}

		async playEnter() {
			await this.revealReady;
			if (!this.el?.isConnected || !this.tlEnter?.duration()) return;
			this.tlEnter.play(0);
		}

		animationReveal(timeline, { includeTitle = false } = {}) {
			this.masterReveal = new MasterTimeline({
				timeline: timeline,
				tweenArr: [
					...(includeTitle
						? [new FadeSplitText({ el: $(this.el).find('.home-hero-top-title .heading').get(0) })]
						: []),
					...$(this.el)
						.find('.home-hero-top-info .txt')
						.toArray()
						.map((el) => new FadeSplitText({ el })),
					new FadeSplitText({ el: $(this.el).find('.home-hero-top-sub .heading').get(0) }),
					new FadeIn({ el: $(this.el).find('.home-hero-top-ic').get(0) }),
					new FadeSplitText({ el: $(this.el).find('.home-hero-desc .txt').get(0) }),
				],
			});

			return this.masterReveal.ready;
		}

		setupHeroTime() {
			this.timeEl = $(this.el).find('[data-time]')[0];
			if (!this.timeEl) return;

			const formatter = new Intl.DateTimeFormat('en-GB', {
				timeZone: 'Asia/Ho_Chi_Minh',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hourCycle: 'h23',
			});
			this.updateHeroTime = () => {
				if (this.timeEl) $(this.timeEl).text(formatter.format(new Date()));
			};

			this.updateHeroTime();
		}

		startHeroTime() {
			if (!this.updateHeroTime || this.timeTimer !== null) return;
			this.updateHeroTime();
			this.timeTimer = window.setInterval(this.updateHeroTime, 1000);
		}

		setupHeroVideo() {
			if (!this.video) return;
			this.video.muted = true;
			this.video.defaultMuted = true;
			this.video.playsInline = true;

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
				this.primeVideoPlayback();
			};

			this.onVideoReady = () => {
				if (!this.video) return;

				this.videoReady = true;
				$(this.video).addClass(['is-video-ready']);
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
				$(this.video).addClass(['is-video-error']);
				this.videoScrollTrigger?.kill();
				this.videoScrollTrigger = null;
			};

			this.onVisibilityChange = () => {
				if (!document.hidden) {
					this.queueVideoSeek(this.videoTargetTime);
				}
			};

			$(this.video).on('loadedmetadata', this.onVideoMetadata);
			$(this.video).on('loadeddata', this.onVideoReady);
			$(this.video).on('seeked', this.onVideoSeeked);
			$(this.video).on('error', this.onVideoError);
			$(document).on('visibilitychange', this.onVisibilityChange);

			if (this.video.readyState >= 1) {
				this.onVideoMetadata();
			}
			if (this.video.readyState >= 2) {
				this.onVideoReady();
			}
		}

		primeVideoPlayback() {
			if (!this.video || this.videoPrimeStarted) return;
			this.videoPrimeStarted = true;

			const video = this.video;
			const removeUnlockListeners = () => {
				if (!this.onVideoUnlock) return;
				document.removeEventListener('touchstart', this.onVideoUnlock);
				document.removeEventListener('pointerdown', this.onVideoUnlock);
				this.onVideoUnlock = null;
			};
			const syncScrollFrame = () => {
				if (this.video !== video) return;
				video.pause();
				removeUnlockListeners();
				this.queueVideoSeek(this.videoTargetTime);
			};
			const tryPlayback = () => {
				const playPromise = video.play();
				if (!playPromise) {
					syncScrollFrame();
					return;
				}

				playPromise.then(syncScrollFrame).catch(() => {
					if (this.onVideoUnlock || this.video !== video) return;
					this.onVideoUnlock = tryPlayback;
					document.addEventListener('touchstart', this.onVideoUnlock, { passive: true });
					document.addEventListener('pointerdown', this.onVideoUnlock, { passive: true });
				});
			};

			tryPlayback();
		}

		setupVideoScrollTrigger() {
			if (!this.video || !this.videoDuration || this.videoScrollTrigger) return;

			this.videoScrollTrigger = ScrollTrigger.create({
				trigger: $(this.el).find('.home-hero-top.top-left')[0],
				start: 'top top',
				end: 'bottom top',
				invalidateOnRefresh: true,
				onUpdate: (self) => {
					this.queueVideoSeek(self.progress * this.videoDuration);
				},
				onRefresh: (self) => {
					this.queueVideoSeek(self.progress * this.videoDuration);
				},
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
			const headerLogoAnimated = $('.header-logo-ic-amin')[0];
			const headerLogoTarget = $('.header-logo-ic')[0];
			const headerLogoAnimatedWrap = $('.header-logo-amin')[0];
			const getHeaderLogoTransform = () => {
				if (!headerLogoAnimated || !headerLogoTarget || !headerLogoAnimatedWrap) {
					return { x: 0, y: 0, scale: 1 };
				}

				const wrapRect = headerLogoAnimatedWrap.getBoundingClientRect();
				const targetRect = headerLogoTarget.getBoundingClientRect();
				const sourceHeight = headerLogoAnimated.offsetHeight;
				const sourceLeft = wrapRect.left + headerLogoAnimated.offsetLeft;
				const sourceTop = wrapRect.bottom - sourceHeight;

				return {
					x: targetRect.left - sourceLeft,
					y: targetRect.top - sourceTop,
					scale: sourceHeight ? targetRect.height / sourceHeight : 1,
				};
			};

			gsap.set($(this.el).find('.home-hero-decor-inner')[0], {
				xPercent: -96,
				yPercent: 76,
				opacity: 1,
			});
			if (headerLogoAnimated) {
				gsap.set(headerLogoAnimated, {
					x: 0,
					y: 0,
					scale: 1,
					transformOrigin: '0 0',
					force3D: true,
					backfaceVisibility: 'hidden',
				});
			}

			this.tlHeroTop = gsap.timeline({
				scrollTrigger: {
					trigger: $(this.el).find('.home-hero-top.top-right')[0],
					start: 'top top',
					end: `bottom top+=${cvUnit(100, 'rem')}`,
					scrub: true,
					invalidateOnRefresh: true,
				},
			});
			if (headerLogoAnimated && headerLogoTarget) {
				this.tlHeroTop.to(headerLogoAnimated, {
					x: () => getHeaderLogoTransform().x,
					y: () => getHeaderLogoTransform().y,
					scale: () => getHeaderLogoTransform().scale,
					ease: 'none',
					force3D: true,
					onComplete: () => {
						gsap.set(headerLogoAnimated, { pointerEvents: 'auto' });
					},
					onReverseComplete: () => {
						gsap.set(headerLogoAnimated, { pointerEvents: 'none' });
					},
				});
			}

			this.tlHeroBot = gsap.timeline({
				scrollTrigger: {
					trigger: $(this.el).find('.home-hero-bottom')[0],
					start: 'top top+=20%',
					end: 'bottom top',
					scrub: true,
				},
			});
			this.tlHeroBot.to($(this.el).find('.home-hero-decor-inner')[0], {
				xPercent: 70,
				yPercent: -175,
				duration: 1,
				ease: 'none',
			});

			const heroDescription = $(this.el).find('.home-hero-bottom-desc .txt')[0];
			const isSanityPreview = document.documentElement.dataset.sanityPreview === 'true';
			if (heroDescription && !isSanityPreview) {
				this.heroTextOriginalHTML = $(heroDescription).html();
				const textNodes = [];
				const walker = document.createTreeWalker(heroDescription, NodeFilter.SHOW_TEXT);
				while (walker.nextNode()) textNodes.push(walker.currentNode);

				textNodes.forEach((textNode) => {
					const fragment = document.createDocumentFragment();
					textNode.textContent.split(/(\s+)/).forEach((part) => {
						if (!part || /^\s+$/.test(part)) {
							fragment.appendChild(document.createTextNode(part));
							return;
						}

						const word = document.createElement('span');
						word.className = 'home-hero-bottom-word';
						word.textContent = part;
						fragment.appendChild(word);
					});
					textNode.replaceWith(fragment);
				});

				const revealItems = $(heroDescription).find('.home-hero-bottom-word, svg').toArray();
				gsap.set(revealItems, { color: 'rgba(255, 255, 255, 0.28)' });
				this.bottomDescReveal = new MasterTimeline({
					triggerInit: this.el,
					scrollTrigger: { trigger: heroDescription },
					tweenArr: [
						new FadeIn({
							el: revealItems,
							from: { y: 0, yPercent: 100 },
							to: { y: 0, yPercent: 0 },
							duration: 0.8,
							stagger: 0.02,
							ease: 'power2.out',
							isDisableRevert: true,
						}),
						new FadeIn({ el: $(this.el).find('.home-hero-bottom-ic').get(0), delay: 0.2 }),
						new FadeIn({ el: $(this.el).find('.home-hero-bottom-link').get(0), delay: 0.4 }),
					],
				});
				this.tlHeroTextColor = gsap.timeline({
					scrollTrigger: {
						trigger: $(this.el).find('.home-hero-bottom-inner')[0],
						start: 'top top+=80%',
						end: 'top top+=40%',
						scrub: true,
					},
				});
				this.tlHeroTextColor.to(revealItems, {
					color: (index, element) => ($(element).is('svg') ? 'var(--cl-brand)' : '#fff'),
					stagger: 0.06,
					ease: 'none',
				});
			}
		}

		interact() {
			// Thêm các tương tác click, hover
		}

		destroy() {
			if (this.timeTimer !== null) {
				window.clearInterval(this.timeTimer);
				this.timeTimer = null;
			}
			if (this.videoRaf !== null) {
				window.cancelAnimationFrame(this.videoRaf);
				this.videoRaf = null;
			}
			if (this.videoScrollTrigger) this.videoScrollTrigger.kill();
			if (this.video) {
				this.video.pause();
				if (this.onVideoMetadata) $(this.video).off('loadedmetadata', this.onVideoMetadata);
				if (this.onVideoReady) $(this.video).off('loadeddata', this.onVideoReady);
				if (this.onVideoSeeked) $(this.video).off('seeked', this.onVideoSeeked);
				if (this.onVideoError) $(this.video).off('error', this.onVideoError);
			}
			if (this.onVisibilityChange) {
				$(document).off('visibilitychange', this.onVisibilityChange);
			}
			if (this.onVideoUnlock) {
				document.removeEventListener('touchstart', this.onVideoUnlock);
				document.removeEventListener('pointerdown', this.onVideoUnlock);
				this.onVideoUnlock = null;
			}
			if (this.tlOnce) this.tlOnce.kill();
			if (this.tlEnter) this.tlEnter.kill();
			if (this.tlHeroTop) this.tlHeroTop.kill();
			if (this.tlHeroBot) this.tlHeroBot.kill();
			if (this.tlHeroTextColor) this.tlHeroTextColor.kill();
			this.masterReveal?.destroy();
			this.bottomDescReveal?.destroy();
			const heroDescription = $(this.el).find('.home-hero-bottom-desc .txt')[0];
			if (heroDescription && this.heroTextOriginalHTML !== null) {
				$(heroDescription).html(this.heroTextOriginalHTML);
			}

			this.video = null;
			this.videoPrimeStarted = false;
			this.timeEl = null;
			this.updateHeroTime = null;
			this.worksEl = null;
			this.masterReveal = null;
			this.bottomDescReveal = null;
			this.revealReady = null;
		}
	},

	Works: class extends TriggerSetup {
		constructor() {
			super();
			this.el = null;
			this.tlWorksTop = null;
			this.tlWorksScroll = null;
			this.worksDecorAssemblyTrigger = null;
			this.worksPathParticles = null;
			this.transitionCanvas = null;
			this.transitionContext = null;
			this.transitionCutCanvas = null;
			this.transitionCutContext = null;
			this.transitionComponentCanvas = null;
			this.transitionComponentContext = null;
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
			this.transitionMetrics = null;
			this.rafId = null;
			this.isVisible = false;
			this.renderWorksFrame = null;
			this.startWorksRender = null;
			this.stopWorksRender = null;
			this.onWorksVisibilityChange = null;
			this.onWorksScroll = null;
			this.worksContext = null;
			this.worksCanvas = null;
			this.worksCanvasParent = null;
			this.worksCanvasNextSibling = null;
			this.lastWorksFrameTime = null;
			this.lastWorksScrollY = null;
			this.worksCurlStrength = 0;
		}

		trigger(data) {
			this.el = $(data.next.container).find('.home-works-wrap')[0];
			if (!this.el) return;
			super.setTrigger(this.el, this.onTrigger.bind(this));
		}

		onTrigger() {
			if (!this.el) return;
			this.setup();
			this.animationReveal();
			this.animationScrub();
			this.interact();
		}

		setup() {
			console.log('Works Setup');
		}

		animationReveal() {
			new MasterTimeline({
				triggerInit: this.el,
				scrollTrigger: { trigger: $(this.el).find('.home-works-main-title') },
				tweenArr: [
					new FadeSplitText({ el: $(this.el).find('.home-works-main-title .heading').get(0) }),
					new FadeIn({ el: $(this.el).find('.home-works-main-desc').get(0), delay: 0.2 }),
				],
			});
		}

		animationScrub() {
			const decorSvg = $(this.el).find('.home-works-svg .home-works-svg-anim svg')[0];
			const decorCanvas = $(this.el).find('.home-works-path-canvas')[0];
			const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			if (decorSvg && decorCanvas && !prefersReducedMotion) {
				this.worksPathParticles = new SvgPathParticles(decorSvg, decorCanvas);
				const renderDecorAssembly = (scrollTrigger) => {
					this.worksPathParticles?.render(scrollTrigger.progress);
				};

				this.worksDecorAssemblyTrigger = ScrollTrigger.create({
					trigger: $(this.el).find('.home-works--decor')[0],
					start: 'top bottom',
					end: 'top top',
					invalidateOnRefresh: true,
					onUpdate: renderDecorAssembly,
					onRefresh: renderDecorAssembly,
				});
			}

			const worksSection = $(this.el).find('.home-works--main')[0];
			const worksSvg = $(this.el).find('.home-works-svg')[0];
			const worksTitle = $(this.el).find('.home-works-main-title')[0];
			const worksDesc = $(this.el).find('.home-works-main-desc')[0];
			const worksSvgPadding = viewport.w > 767 ? cvUnit(68, 'rem') : cvUnit(-20, 'rem');

			const worksTitleTop =
				worksTitle.getBoundingClientRect().top -
				worksSection.getBoundingClientRect().top -
				worksTitle.getBoundingClientRect().height +
				worksSvgPadding;

			const worksSvgWidth = viewport.w >= 767 ? cvUnit(291, 'rem') : cvUnit(188, 'rem');

			const worksDescHeight = worksDesc.getBoundingClientRect().height;

			console.log(worksTitleTop);
			this.tlWorksTop = gsap.timeline({
				scrollTrigger: {
					trigger: $(this.el).find('.home-works-block')[0],
					start: 'top top',
					end: 'bottom top',
					scrub: true,
				},
			});
			this.tlWorksTop
				.to(worksTitle, { y: worksDescHeight, ease: 'power3.inOut' })
				.to(worksDesc, { y: worksDescHeight, ease: 'power3.inOut' }, '<=')
				.to(
					worksSvg,
					{
						width: worksSvgWidth,
						y: worksTitleTop,
						color: 'var(--cl-content-strong)',
						ease: 'power3.inOut',
					},
					'<=',
				);

			this.tlWorksScroll = gsap.timeline({
				scrollTrigger: {
					trigger: $(this.el).find('.home-works-empty')[0],
					start: 'top bottom',
					end: 'bottom bottom',
					scrub: true,
				},
			});

			const transition = $(this.el).find('.home-works-trans')[0];
			const transitionInner = $(this.el).find('.home-works-trans-inner')[0];
			const transitionItems = $(this.el).find('.home-works-trans-item-inner').toArray();
			const currentContent = $(this.el).find('.home-works-main')[0];
			const nextContent = $(this.el).find('.home-works-bottom-title')[0];
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

			this.tlWorksScroll.to(
				this.transitionState,
				{
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
				},
				0,
			);

			this.setupWebGL(prefersReducedMotion);
		}

		setupWebGL(prefersReducedMotion) {
			if (this.worksContext || prefersReducedMotion || window.innerWidth <= 991) return;

			const canvas = $(this.el).find('#works-gl-canvas')[0];
			if (!canvas) return;

			// Keep the full-screen render surface outside every section/container
			// so ancestor overflow, transforms and paint containment cannot clip it.
			this.worksCanvas = canvas;
			this.worksCanvasParent = canvas.parentNode;
			this.worksCanvasNextSibling = canvas.nextSibling;
			$(document.body).append(canvas);

			this.worksContext = canvas.getContext('2d', { alpha: true });
			if (!this.worksContext) {
				$(this.worksCanvasParent).append(canvas);
				this.worksCanvas = null;
				this.worksCanvasParent = null;
				this.worksCanvasNextSibling = null;
				return;
			}
			this.meshes = [];
			this.imageLoadCleanups = [];

			const items = gsap.utils.toArray($(this.el).find('.home-works-item').toArray());

			items.forEach((item) => {
				const imgEl = $(item).find('img')[0];
				const container = $(item).find('.home-works-item-img')[0];
				if (!imgEl || !container) return;

				const layer = {
					item,
					container,
					imgEl,
					textureReady: false,
					canvasRendered: false,
					borderRadius: 0,
				};

				const setupTexture = () => {
					layer.textureReady = true;
				};

				if (imgEl.complete && imgEl.naturalWidth > 0) {
					setupTexture();
				} else {
					const onImageLoad = setupTexture;
					$(imgEl).one('load', onImageLoad);
					this.imageLoadCleanups.push(() => {
						$(imgEl).off('load', onImageLoad);
					});
				}
				this.meshes.push(layer);
			});

			this.onResize = () => {
				const w = window.innerWidth;
				const h = window.innerHeight;
				const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
				canvas.width = Math.round(w * dpr);
				canvas.height = Math.round(h * dpr);
				this.worksContext.setTransform(dpr, 0, 0, dpr, 0, 0);
				this.worksContext.imageSmoothingEnabled = true;
				this.worksContext.imageSmoothingQuality = 'high';
				this.meshes.forEach((layer) => {
					layer.borderRadius = parseFloat(getComputedStyle(layer.container).borderRadius) || 0;
				});
				this.viewSize = { w, h, dpr };
				if (this.isVisible) this.startWorksRender?.();
			};

			$(window).on('resize', this.onResize);
			ScrollTrigger.addEventListener('refresh', this.onResize);
			this.onResize();

			// OPTIMIZATION 3: Intersection Observer để tạm dừng render khi không cuộn tới
			this.isVisible = false;
			this.observer = new IntersectionObserver(
				(entries) => {
					this.isVisible = entries[0].isIntersecting;
					canvas.style.visibility = this.isVisible ? 'visible' : 'hidden';
					if (this.isVisible && !document.hidden) {
						this.startWorksRender?.();
					} else {
						this.stopWorksRender?.();
					}
				},
				{ rootMargin: '100px 0px' },
			); // Render trước khi vào màn hình 100px
			this.observer.observe(this.el);

			this.stopWorksRender = () => {
				if (this.rafId === null) return;
				window.cancelAnimationFrame(this.rafId);
				this.rafId = null;
			};

			this.renderWorksFrame = () => {
				this.rafId = null;
				if (!this.isVisible || document.hidden || !this.viewSize || !this.worksContext) return;

				const { w, h, dpr } = this.viewSize;
				const context = this.worksContext;
				const scrollY = window.scrollY;
				const now = performance.now();
				const deltaTime =
					this.lastWorksFrameTime === null
						? 1 / 60
						: Math.max(1 / 240, Math.min((now - this.lastWorksFrameTime) / 1000, 0.1));
				const scrollVelocity =
					this.lastWorksScrollY === null
						? 0
						: Math.abs(scrollY - this.lastWorksScrollY) / deltaTime;
				const targetCurl = Math.min(1, scrollVelocity / 800) * 0.06;
				const damping = targetCurl > this.worksCurlStrength ? 0.025 : 0.175;
				const blend = 1 - Math.exp(-deltaTime / damping);
				this.worksCurlStrength += (targetCurl - this.worksCurlStrength) * blend;
				if (targetCurl === 0 && this.worksCurlStrength < 0.0001) {
					this.worksCurlStrength = 0;
				}
				this.lastWorksFrameTime = now;
				this.lastWorksScrollY = scrollY;

				context.clearRect(0, 0, w, h);

				this.meshes.forEach((obj) => {
					if (!obj.textureReady) return;
					const rect = obj.container.getBoundingClientRect();
					if (rect.bottom <= 0 || rect.top >= h || rect.width <= 0 || rect.height <= 0) return;

					const image = obj.imgEl;
					const imageAspect = image.naturalWidth / image.naturalHeight;
					const rectAspect = rect.width / rect.height;
					let sourceX = 0;
					let sourceY = 0;
					let sourceWidth = image.naturalWidth;
					let sourceHeight = image.naturalHeight;
					if (imageAspect > rectAspect) {
						sourceWidth = image.naturalHeight * rectAspect;
						sourceX = (image.naturalWidth - sourceWidth) * 0.5;
					} else {
						sourceHeight = image.naturalWidth / rectAspect;
						sourceY = (image.naturalHeight - sourceHeight) * 0.5;
					}

					const radius = Math.min(obj.borderRadius, rect.width * 0.5, rect.height * 0.5);
					const getWarpedEdges = (screenY) => {
						const localY = screenY - rect.top;
						const cornerDistance = Math.max(0, Math.min(localY, rect.height - localY));
						const cornerInset =
							cornerDistance < radius
								? radius - Math.sqrt(Math.max(0, radius * radius - (radius - cornerDistance) ** 2))
								: 0;
						const sourceLeft = rect.left + cornerInset;
						const sourceRight = rect.right - cornerInset;
						const screenUvY = 1 - screenY / h;
						const centered = 2 * screenUvY - 1;
						const profile = 1 - Math.sqrt(Math.max(0, 1 - centered * centered));
						const scale = 1 - profile * this.worksCurlStrength;
						return {
							left: ((sourceLeft / w - 0.5) / scale + 0.5) * w,
							right: ((sourceRight / w - 0.5) / scale + 0.5) * w,
						};
					};

					const bandHeight = 2;
					const firstY = Math.max(0, Math.floor(rect.top));
					const lastY = Math.min(h, Math.ceil(rect.bottom));
					const edgeStep = 3;
					context.save();
					context.beginPath();
					let edge = getWarpedEdges(firstY);
					context.moveTo(edge.left, firstY);
					for (let screenY = firstY + edgeStep; screenY < lastY; screenY += edgeStep) {
						edge = getWarpedEdges(screenY);
						context.lineTo(edge.left, screenY);
					}
					edge = getWarpedEdges(lastY);
					context.lineTo(edge.left, lastY);
					context.lineTo(edge.right, lastY);
					for (let screenY = lastY - edgeStep; screenY > firstY; screenY -= edgeStep) {
						edge = getWarpedEdges(screenY);
						context.lineTo(edge.right, screenY);
					}
					edge = getWarpedEdges(firstY);
					context.lineTo(edge.right, firstY);
					context.closePath();
					context.clip();

					for (let screenY = firstY; screenY < lastY; screenY += bandHeight) {
						const drawHeight = Math.min(bandHeight + 0.5, lastY - screenY);
						const localY = (screenY - rect.top) / rect.height;
						const sourceBandY = sourceY + localY * sourceHeight;
						const availableSourceHeight = sourceY + sourceHeight - sourceBandY;
						const sourceBandHeight = Math.min(
							Math.max(0.5, (drawHeight / rect.height) * sourceHeight),
							availableSourceHeight,
						);
						if (sourceBandHeight <= 0) continue;
						const drawEdges = getWarpedEdges(screenY + drawHeight * 0.5);

						context.drawImage(
							image,
							sourceX,
							sourceBandY,
							sourceWidth,
							sourceBandHeight,
							drawEdges.left,
							screenY,
							drawEdges.right - drawEdges.left,
							drawHeight,
						);
					}
					context.restore();

					if (!obj.canvasRendered) {
						$(obj.imgEl).addClass(['is-canvas-rendered']);
						obj.canvasRendered = true;
					}
				});

				if (this.worksCurlStrength > 0.0001) {
					this.rafId = window.requestAnimationFrame(this.renderWorksFrame);
				}
			};

			this.startWorksRender = () => {
				if (
					this.rafId !== null ||
					!this.isVisible ||
					document.hidden ||
					!this.viewSize ||
					!this.worksContext
				) {
					return;
				}
				this.lastWorksFrameTime = null;
				if (this.lastWorksScrollY === null) {
					this.lastWorksScrollY = window.scrollY;
				}
				this.rafId = window.requestAnimationFrame(this.renderWorksFrame);
			};

			this.onWorksScroll = () => {
				if (this.isVisible && !document.hidden) this.startWorksRender?.();
			};
			$(window).on('scroll', this.onWorksScroll);

			this.onWorksVisibilityChange = () => {
				if (document.hidden) {
					this.stopWorksRender?.();
				} else if (this.isVisible) {
					this.startWorksRender?.();
				}
			};
			$(document).on('visibilitychange', this.onWorksVisibilityChange);
		}

		setupTransitionCanvas(transition, transitionItems) {
			const canvas = $(transition).find('.home-works-trans-canvas')[0];
			const paths = Array.from(transitionItems)
				.map((item) => $(item).find('path').attr('d'))
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
			this.transitionCutCanvas = document.createElement('canvas');
			this.transitionCutContext = this.transitionCutCanvas.getContext('2d');
			this.transitionComponentCanvas = document.createElement('canvas');
			this.transitionComponentContext = this.transitionComponentCanvas.getContext('2d');
			this.transitionItems = transitionItems;

			if (
				!this.transitionContext ||
				!this.transitionCutContext ||
				!this.transitionComponentContext
			) {
				this.transitionCutCanvas = null;
				this.transitionCutContext = null;
				this.transitionComponentCanvas = null;
				this.transitionComponentContext = null;
				return false;
			}

			$(transition).addClass(['is-canvas-active']);
			this.onTransitionResize = () => {
				this.updateTransitionMetrics();
				this.drawTransitionCanvas();
				this.transitionSwapProgress = this.calculateTransitionSwapProgress();
				this.updateTransitionContent(true);
			};
			$(window).on('resize', this.onTransitionResize);
			this.onTransitionResize();
			return true;
		}

		updateTransitionMetrics() {
			const canvas = this.transitionCanvas;
			const cutCanvas = this.transitionCutCanvas;
			const componentCanvas = this.transitionComponentCanvas;
			const firstItem = this.transitionItems?.[0];
			if (!canvas || !cutCanvas || !componentCanvas || !firstItem) {
				this.transitionMetrics = null;
				return;
			}

			const width = canvas.clientWidth;
			const height = canvas.clientHeight;
			const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
			const renderWidth = Math.round(width * pixelRatio);
			const renderHeight = Math.round(height * pixelRatio);

			[canvas, cutCanvas, componentCanvas].forEach((targetCanvas) => {
				if (targetCanvas.width !== renderWidth || targetCanvas.height !== renderHeight) {
					targetCanvas.width = renderWidth;
					targetCanvas.height = renderHeight;
				}
			});

			const innerSize = Math.min(width, height);
			this.transitionMetrics = {
				width,
				height,
				pixelRatio,
				innerSize,
				innerLeft: (width - innerSize) / 2,
				innerTop: (height - innerSize) / 2,
				shapeSize: firstItem.offsetWidth,
				color: getComputedStyle(canvas).color,
			};
		}

		calculateTransitionSwapProgress() {
			const canvas = this.transitionCanvas;
			const context = this.transitionContext;
			const metrics = this.transitionMetrics;

			if (!canvas || !context || !metrics || this.transitionPaths.length !== 4) {
				return WORKS_TRANSITION_FALLBACK_SWAP_PROGRESS;
			}

			const { innerSize, shapeSize } = metrics;

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
			if (!this.transitionState || !this.transitionCurrentContent || !this.transitionNextContent) {
				return;
			}

			const showNextContent = this.transitionState.progress >= this.transitionSwapProgress;
			const backgroundProgress = gsap.utils.clamp(
				0,
				1,
				(this.transitionState.progress - this.transitionSwapProgress) /
					WORKS_TRANSITION_BACKGROUND_SPAN,
			);

			this.transitionBackgroundTween?.progress(backgroundProgress);

			if (!force && showNextContent === this.isNextContentVisible) {
				return;
			}

			this.isNextContentVisible = showNextContent;
			gsap.to(this.transitionCurrentContent, {
				opacity: showNextContent ? 0 : 1,
				pointerEvents: showNextContent ? 'none' : 'auto',
				duration: 0.01,
				overwrite: true,
			});
			gsap.to($(this.el).find('.home-works--decor')[0], {
				opacity: showNextContent ? 0 : 1,
				pointerEvents: showNextContent ? 'none' : 'auto',
				duration: 0.01,
				overwrite: true,
			});
			gsap.to(this.transitionNextContent, {
				opacity: showNextContent ? 1 : 0,
				pointerEvents: showNextContent ? 'auto' : 'none',
				duration: 0.01,
				overwrite: true,
			});
		}

		drawTransitionCanvas() {
			const canvas = this.transitionCanvas;
			const context = this.transitionContext;
			const cutCanvas = this.transitionCutCanvas;
			const cutContext = this.transitionCutContext;
			const componentCanvas = this.transitionComponentCanvas;
			const componentContext = this.transitionComponentContext;
			const state = this.transitionState;
			const metrics = this.transitionMetrics;

			if (
				!canvas ||
				!context ||
				!cutCanvas ||
				!cutContext ||
				!componentCanvas ||
				!componentContext ||
				!state ||
				!metrics ||
				this.transitionPaths.length !== 4
			) {
				return;
			}

			const { width, height, pixelRatio, innerSize, innerLeft, innerTop, shapeSize, color } =
				metrics;
			const viewportScale = Math.max(1, Math.max(width, height) / innerSize);
			const coverProgress = gsap.utils.clamp(
				0,
				1,
				(state.progress - WORKS_TRANSITION_COVER_START) / (1 - WORKS_TRANSITION_COVER_START),
			);
			const resolvedScale = state.scale * gsap.utils.interpolate(1, viewportScale, coverProgress);
			const shapeScale = (shapeSize / 250) * resolvedScale;
			const halfShape = shapeSize / 2;
			const shapeCenters = [
				[-halfShape, -halfShape],
				[innerSize + halfShape, -halfShape],
				[-halfShape, innerSize + halfShape],
				[innerSize + halfShape, innerSize + halfShape],
			];

			const resetContext = (targetContext) => {
				targetContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
				targetContext.clearRect(0, 0, width, height);
			};
			const drawShape = (targetContext, index, compositeOperation) => {
				const [centerX, centerY] = shapeCenters[index];

				targetContext.save();
				targetContext.translate(innerLeft + innerSize / 2, innerTop + innerSize / 2);
				targetContext.rotate((state.rotate * Math.PI) / 180);
				targetContext.translate(-innerSize / 2, -innerSize / 2);
				targetContext.globalCompositeOperation = compositeOperation;
				targetContext.fillStyle = color;
				targetContext.translate(centerX, centerY);
				targetContext.scale(shapeScale, shapeScale);
				targetContext.translate(-125, -125);
				targetContext.fill(this.transitionPaths[index]);
				targetContext.restore();
			};

			// Hợp cả bốn lá: các phần giao của lá kề nhau vẫn giữ màu xanh.
			resetContext(context);
			this.transitionPaths.forEach((_, index) => {
				drawShape(context, index, 'source-over');
			});

			const mergeComponentIntoCut = () => {
				cutContext.save();
				cutContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
				cutContext.globalCompositeOperation = 'source-over';
				cutContext.drawImage(componentCanvas, 0, 0, width, height);
				cutContext.restore();
			};

			// Phần giao đồng thời của đủ bốn lá.
			resetContext(cutContext);
			drawShape(cutContext, 0, 'source-over');
			drawShape(cutContext, 1, 'destination-in');
			drawShape(cutContext, 2, 'destination-in');
			drawShape(cutContext, 3, 'destination-in');

			// Chỉ đúng hai lá đối xứng 0–3 chồng nhau; loại vùng có lá thứ ba.
			resetContext(componentContext);
			drawShape(componentContext, 0, 'source-over');
			drawShape(componentContext, 3, 'destination-in');
			drawShape(componentContext, 1, 'destination-out');
			drawShape(componentContext, 2, 'destination-out');
			mergeComponentIntoCut();

			// Chỉ đúng hai lá đối xứng 1–2 chồng nhau; loại vùng có lá thứ ba.
			resetContext(componentContext);
			drawShape(componentContext, 1, 'source-over');
			drawShape(componentContext, 2, 'destination-in');
			drawShape(componentContext, 0, 'destination-out');
			drawShape(componentContext, 3, 'destination-out');
			mergeComponentIntoCut();

			context.save();
			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
			context.globalCompositeOperation = 'destination-out';
			context.drawImage(cutCanvas, 0, 0, width, height);
			context.restore();
		}

		interact() {}

		destroy() {
			super.cleanTrigger();
			if (this.worksPathParticles) this.worksPathParticles.destroy();
			if (this.tlWorksTop) {
				if (this.tlWorksTop.scrollTrigger) this.tlWorksTop.scrollTrigger.kill();
				this.tlWorksTop.kill();
			}
			if (this.tlWorksScroll) {
				if (this.tlWorksScroll.scrollTrigger) this.tlWorksScroll.scrollTrigger.kill();
				this.tlWorksScroll.kill();
			}
			this.worksDecorAssemblyTrigger?.kill();
			if (this.transitionBackgroundTween) this.transitionBackgroundTween.kill();
			if (this.onTransitionResize) {
				$(window).off('resize', this.onTransitionResize);
			}

			if (this.itemTriggers) {
				this.itemTriggers.forEach((tl) => tl.kill());
			}

			this.transitionCanvas = null;
			this.transitionContext = null;
			if (this.transitionCutCanvas) {
				this.transitionCutCanvas.width = 1;
				this.transitionCutCanvas.height = 1;
			}
			if (this.transitionComponentCanvas) {
				this.transitionComponentCanvas.width = 1;
				this.transitionComponentCanvas.height = 1;
			}
			this.transitionCutCanvas = null;
			this.transitionCutContext = null;
			this.transitionComponentCanvas = null;
			this.transitionComponentContext = null;
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
			this.transitionMetrics = null;

			this.stopWorksRender?.();
			if (this.onWorksVisibilityChange) {
				$(document).off('visibilitychange', this.onWorksVisibilityChange);
			}
			if (this.onWorksScroll) {
				$(window).off('scroll', this.onWorksScroll);
			}
			if (this.imageLoadCleanups) {
				this.imageLoadCleanups.forEach((cleanup) => cleanup());
			}
			if (this.meshes) {
				this.meshes.forEach(({ imgEl }) => $(imgEl).removeClass(['is-canvas-rendered']));
			}
			if (this.worksContext && this.viewSize) {
				this.worksContext.clearRect(0, 0, this.viewSize.w, this.viewSize.h);
			}
			if (this.onResize) {
				$(window).off('resize', this.onResize);
				ScrollTrigger.removeEventListener('refresh', this.onResize);
			}
			if (this.observer) this.observer.disconnect();
			if (this.worksCanvas) {
				this.worksCanvas.style.visibility = 'hidden';
				if (this.worksCanvasParent) {
					if (
						this.worksCanvasNextSibling &&
						this.worksCanvasNextSibling.parentNode === this.worksCanvasParent
					) {
						this.worksCanvasParent.insertBefore(this.worksCanvas, this.worksCanvasNextSibling);
					} else {
						$(this.worksCanvasParent).append(this.worksCanvas);
					}
				}
			}

			this.meshes = [];
			this.imageLoadCleanups = [];
			this.viewSize = null;
			this.observer = null;
			this.onResize = null;
			this.rafId = null;
			this.isVisible = false;
			this.renderWorksFrame = null;
			this.startWorksRender = null;
			this.stopWorksRender = null;
			this.onWorksVisibilityChange = null;
			this.onWorksScroll = null;
			this.worksContext = null;
			this.worksCanvas = null;
			this.worksCanvasParent = null;
			this.worksCanvasNextSibling = null;
			this.lastWorksFrameTime = null;
			this.lastWorksScrollY = null;
			this.worksCurlStrength = 0;
		}
	},
	How: class extends TriggerSetup {
		constructor() {
			super();
			this.el = null;
			this.tlDecor = null;
			this.tlTrans = null;
			this.tlItemScroll = null;
			this.hoverCleanups = [];
			this.imageLoadCleanups = [];
			this.imageRefreshRaf = null;
		}

		trigger(data) {
			this.el = $(data.next.container).find('.home-how-wrap')[0];
			if (!this.el) return;
			super.setTrigger(this.el, this.onTrigger.bind(this));
		}

		onTrigger() {
			if (!this.el) return;
			this.setup();
			this.animationReveal();
			this.animationScrub();
			this.interact();
			this.refreshAfterImagesLoad();
		}

		setup() {
			if (!this.el) return;
		}

		refreshAfterImagesLoad() {
			const images = $(this.el).find('.home-how-thumb-item-img img').toArray();
			const scheduleRefresh = () => {
				if (this.imageRefreshRaf) cancelAnimationFrame(this.imageRefreshRaf);
				this.imageRefreshRaf = requestAnimationFrame(() => {
					this.imageRefreshRaf = null;
					if (this.el?.isConnected) ScrollTrigger.refresh();
				});
			};

			images.forEach((image) => {
				if (image.complete) return;

				image.addEventListener('load', scheduleRefresh);
				image.addEventListener('error', scheduleRefresh);
				this.imageLoadCleanups.push(() => {
					image.removeEventListener('load', scheduleRefresh);
					image.removeEventListener('error', scheduleRefresh);
				});
			});
		}

		animationReveal() {
			new MasterTimeline({
				triggerInit: this.el,
				scrollTrigger: {
					trigger: $(this.el).find('.home-how-intro-desc').get(0),
					start: 'top top+=95%',
				},
				tweenArr: [
					new FadeSplitText({ el: $(this.el).find('.home-how-intro-desc .txt').get(0) }),
					new FadeIn({ el: $(this.el).find('.home-how-intro-decor').get(0) }),
				],
			});
		}

		animationScrub() {
			const decor = $(this.el).find('.home-how-intro-decor')[0];
			const shapeWraps = $(decor).find('.home-how-intro-decor-shape-wrap').toArray();
			const shapeDecor1 = $(shapeWraps[0]).find('.ic-1')[0];
			const shapeDecor2 = $(shapeWraps[0]).find('.ic-2')[0];
			const shapeDecor3 = $(shapeWraps[1]).find('.ic-3')[0];
			const shapeDecor4 = $(shapeWraps[1]).find('.ic-4')[0];
			const lastItem = $(this.el).find('.home-how-content-item:last-child')[0];
			const lastItemLeft = $(lastItem).find('.home-how-content-item-left')[0];
			const lastItemRight = $(lastItem).find('.home-how-content-item-right')[0];
			const lastItemTitle = $(lastItem).find('.home-how-content-item-title')[0];
			const lastItemText = $(lastItem).find('.home-how-content-item-text')[0];
			const getShapeWidth = () => shapeWraps[0].getBoundingClientRect().width;
			const getDecorDistance = () => decor.getBoundingClientRect().width / 2 - getShapeWidth() / 2;

			this.tlDecor = gsap.timeline({
				scrollTrigger: {
					trigger: decor,
					start: 'top center',
					endTrigger: $(this.el).find('.home-how-thumb-inner')[0],
					end: 'top center-=5%',
					scrub: true,
					invalidateOnRefresh: true,
				},
			});

			this.tlDecor
				.to(shapeWraps[0], {
					x: () => -getDecorDistance(),
					ease: 'power3.inOut',
				})
				.to(
					shapeWraps[1],
					{
						x: () => getDecorDistance(),
						ease: 'power3.inOut',
					},
					'<',
				);

			this.tlTrans = gsap.timeline({
				scrollTrigger: {
					trigger: $(this.el).find('.home-how-trans')[0],
					start: 'top top+=50%',
					end: 'bottom bottom',
					scrub: true,
					invalidateOnRefresh: true,
				},
			});
			this.tlTrans
				.to(shapeWraps[0], {
					x: () => getShapeWidth(),
					ease: 'power2.inOut',
					duration: 0.7,
				})
				.to(
					lastItemLeft,
					{
						x: () =>
							lastItem.getBoundingClientRect().width / 2 -
							lastItemTitle.getBoundingClientRect().width -
							cvUnit(100, 'rem'),
						ease: 'power3.inOut',
						duration: 0.7,
					},
					'<',
				)
				.to(
					lastItemRight,
					{
						x: () =>
							-(
								lastItem.getBoundingClientRect().width / 2 -
								lastItemText.getBoundingClientRect().width -
								cvUnit(100, 'rem')
							),
						ease: 'power3.inOut',
						duration: 0.7,
					},
					'<',
				)
				.to(
					shapeWraps[1],
					{
						x: () => getShapeWidth(),
						ease: 'power3.inOut',
						duration: 0.7,
					},
					'<',
				)
				.to(
					shapeDecor1,
					{
						xPercent: -100,
						yPercent: 100,
						ease: 'power3.out',
						duration: 0.3,
					},
					0.4,
				)
				.to(
					shapeDecor2,
					{
						xPercent: -100,
						yPercent: -100,
						ease: 'power3.out',
						duration: 0.3,
					},
					'<',
				)
				.to(
					shapeDecor3,
					{
						xPercent: -100,
						yPercent: 100,
						ease: 'power3.out',
						duration: 0.3,
					},
					'<',
				)
				.to(
					shapeDecor4,
					{
						xPercent: -100,
						yPercent: -100,
						ease: 'power3.out',
						duration: 0.3,
					},
					'<',
				)
				.to(
					[lastItemLeft, lastItemRight],
					{
						y: () => lastItem.getBoundingClientRect().height,
						ease: 'power3.inOut',
						duration: 0.3,
					},
					'>',
				)
				.to(
					$('.home-playground-trans-decor').toArray(),
					{
						opacity: 1,
						ease: 'power1.inOut',
						duration: 0.01,
					},
					'<',
				)
				.to(
					[shapeWraps[0], shapeWraps[1]],
					{
						opacity: 0,
						ease: 'power1.inOut',
						duration: 0.01,
					},
					'<',
				)
				.fromTo(
					[
						$('.home-playground-content-left-title').toArray(),
						$('.home-playground-content-right-title').toArray(),
					],
					{
						yPercent: 100,
					},
					{
						yPercent: 0,
						ease: 'power3.inOut',
						duration: 0.3,
					},
					1,
				);

			this.tlItemScrolls = [];
			const thumbItems = $(this.el).find('.home-how-thumb-item').toArray();
			const contentItems = $(this.el).find('.home-how-content-item').toArray();
			const contentList = $(this.el).find('.home-how-content-list')[0];
			const activateContent = (activeIndex, direction) => {
				contentItems.forEach((item, itemIndex) => {
					if (itemIndex === activeIndex) {
						$(item).removeClass(['is-static-exit']);
						$(item).toggleClass('is-above', direction === 'backward');
						$(item).addClass(['active']);
						return;
					}

					if (!$(item).hasClass('active')) return;
					$(item).toggleClass('is-above', direction === 'forward');
					$(item).removeClass(['active']);
				});
			};
			const clearContent = (direction, staticExit = false) => {
				contentItems.forEach((item) => {
					if (!$(item).hasClass('active')) return;
					$(item).toggleClass('is-static-exit', staticExit);
					$(item).toggleClass('is-above', direction === 'forward' && !staticExit);
					$(item).removeClass(['active']);
				});
			};

			thumbItems.forEach((thumb, index) => {
				const frame = $(thumb).find('.home-how-thumb-item-inner')[0];
				const direction = index % 2 === 0 ? 1 : -1;
				const clipPath = $(this.el).find(`#home-how-clip-${index + 1} path`)[0];
				const shapeA =
					'M .082 .095 L .958 .004 Q 1 0 .995 .042 L .954 .958 Q .95 1 .908 .995 L .042 .886 Q 0 .88 .005 .838 L .036 .142 Q .04 .1 .082 .095 Z';
				const shapeB =
					'M .042 .005 L .908 .095 Q .96 .1 .964 .142 L .995 .838 Q 1 .88 .958 .886 L .092 .995 Q .05 1 .046 .958 L .005 .042 Q 0 0 .042 .005 Z';
				const fromShape = direction === 1 ? shapeA : shapeB;
				const toShape = direction === 1 ? shapeB : shapeA;
				gsap.set(frame, { clipPath: `url(#home-how-clip-${index + 1})` });
				const tl = gsap.timeline({
					scrollTrigger: {
						trigger: thumb,
						start: 'top bottom',
						end: 'bottom top',
						scrub: true,
					},
				});

				tl.fromTo(
					frame,
					{ scale: 0.5 },
					{
						scale: 0.75,
						duration: 0.25,
						ease: 'none',
					},
				)
					.fromTo(
						clipPath,
						{ attr: { d: fromShape } },
						{
							attr: { d: toShape },
							duration: 0.25,
							ease: 'none',
						},
						0,
					)
					.to(frame, {
						scale: 1,
						duration: 0.25,
						ease: 'none',
					})
					.to(clipPath, { attr: { d: fromShape }, duration: 0.25, ease: 'none' }, '<')
					.to(frame, {
						scale: 0.75,
						duration: 0.25,
						ease: 'none',
					})
					.to(clipPath, { attr: { d: toShape }, duration: 0.25, ease: 'none' }, '<')
					.to(frame, {
						scale: 0.5,
						duration: 0.25,
						ease: 'none',
					})
					.to(clipPath, { attr: { d: fromShape }, duration: 0.25, ease: 'none' }, '<');

				this.tlItemScrolls.push(tl);

				const contentTrigger = ScrollTrigger.create({
					trigger: thumb,
					start: `top center`,
					end: `bottom center`,
					onEnter: () => {
						if (index === 0) $(contentList).addClass(['active-ic']);
						activateContent(index, 'forward');
					},
					onEnterBack: () => {
						if (index === thumbItems.length - 1) $(contentList).addClass(['active-ic']);
						activateContent(index, 'backward');
					},
					onLeave: () => {
						if (index !== thumbItems.length - 1) return;
						$(contentList).removeClass(['active-ic']);
						clearContent('forward', true);
					},
					onLeaveBack: () => {
						if (index !== 0) return;
						$(contentList).removeClass(['active-ic']);
						clearContent('backward');
					},
				});
				this.tlItemScrolls.push(contentTrigger);
			});
		}

		interact() {
			const cards = $(this.el).find('.home-how-thumb-item').toArray();

			cards.forEach((card) => {
				const frame = $(card).find('.home-how-thumb-item-inner')[0];

				const onPointerMove = (event) => {
					const rect = card.getBoundingClientRect();
					const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
					const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

					gsap.to(frame, {
						rotationX: -y * 10,
						rotationY: x * 12,
						x: x * 8,
						y: y * 8,
						duration: 0.35,
						ease: 'power2.out',
						overwrite: 'auto',
					});
				};

				const onPointerLeave = () => {
					gsap.to(frame, {
						rotationX: 0,
						rotationY: 0,
						x: 0,
						y: 0,
						duration: 0.7,
						ease: 'elastic.out(1, 0.4)',
						overwrite: 'auto',
					});
				};

				$(card).on('pointermove', onPointerMove);
				$(card).on('pointerleave', onPointerLeave);
				this.hoverCleanups.push(() => {
					$(card).off('pointermove', onPointerMove);
					$(card).off('pointerleave', onPointerLeave);
					gsap.killTweensOf(frame);
				});
			});
		}

		destroy() {
			super.cleanTrigger();
			if (this.imageRefreshRaf) cancelAnimationFrame(this.imageRefreshRaf);
			this.imageRefreshRaf = null;
			this.imageLoadCleanups.forEach((cleanup) => cleanup());
			this.imageLoadCleanups = [];
			if (this.tlDecor) {
				if (this.tlDecor.scrollTrigger) this.tlDecor.scrollTrigger.kill();
				this.tlDecor.kill();
			}
			if (this.tlTrans) {
				if (this.tlTrans.scrollTrigger) this.tlTrans.scrollTrigger.kill();
				this.tlTrans.kill();
			}
			if (this.tlItemScrolls) {
				this.tlItemScrolls.forEach((tl) => {
					if (tl.scrollTrigger) tl.scrollTrigger.kill();
					if (tl.kill) tl.kill();
				});
			}
			this.tlDecor = null;
			this.tlTrans = null;
			this.hoverCleanups.forEach((cleanup) => cleanup());
			this.hoverCleanups = [];
			this.el = null;
		}
	},
	Playground: class extends TriggerSetup {
		constructor() {
			super();
			this.el = null;
			this.tlTrans = null;
			this.sphereReveal = null;
			this.sphereFocus = null;
			this.sphere = null;
			this.sphereScale = null;
			this.cardLayer = null;
			this.sphereCards = [];
			this.sphereClones = [];
			this.sphereRotation = { x: 0, y: 0, scale: 1 };
			this.sphereVisible = false;
			this.sphereDragging = false;
			this.sphereFocused = false;
			this.pendingSphereCard = null;
			this.sphereTransitionScrolling = false;
			this.sphereScrollResetting = false;
			this.sphereShouldResumeScroll = false;
			this.sphereDragMoved = false;
			this.spherePointer = null;
			this.sphereRaf = null;
			this.sphereLastTime = 0;
			this.sphereObserver = null;
			this.sphereResizeObserver = null;
			this.sphereCleanups = [];
		}

		trigger(data) {
			this.el = $(data.next.container).find('.home-playground-wrap')[0];
			if (!this.el) return;
			super.setTrigger(this.el, this.onTrigger.bind(this));
		}

		onTrigger() {
			if (!this.el) return;
			this.animationReveal();
			this.animationScrub();
			this.interact();
		}

		animationReveal() {
			const stage = $(this.el).find('.home-playground-sphere-stage')[0];
			if (!stage) return;

			this.sphereReveal = gsap.fromTo(
				stage,
				{ opacity: 0, scale: 0.3 },
				{
					opacity: 1,
					scale: 1,
					duration: 3.5,
					ease: 'power4.out',
				},
			);
		}

		animationScrub() {
			const itemLeft = $(this.el).find('.home-playground-content-left')[0];
			const itemRight = $(this.el).find('.home-playground-content-right')[0];
			const titleLeft = $(this.el).find('.home-playground-content-left-title')[0];
			const titleRight = $(this.el).find('.home-playground-content-right-title')[0];
			const transInner = $(this.el).find('.home-playground-trans-inner')[0];
			const playgroundMain = $(this.el).find('.home-playground-main')[0];
			const playgroundContent = $(this.el).find('.home-playground-content')[0];
			const transitionDecor = $(transInner).find('.home-playground-trans-decor').toArray();

			const widthTransLeft =
				itemLeft.getBoundingClientRect().width - titleLeft.getBoundingClientRect().width;
			const widthTransRight =
				itemRight.getBoundingClientRect().width - titleRight.getBoundingClientRect().width;

			this.tlTrans = gsap.timeline({
				scrollTrigger: {
					trigger: $(this.el).find('.home-playground-empty')[0],
					start: 'top top+=50%',
					end: 'bottom bottom+=2%',
					scrub: true,
				},
			});
			this.tlTrans
				.to(titleLeft, {
					x: `-${widthTransLeft}`,
					ease: 'power3.inOut',
					duration: 1,
				})
				.to(
					titleRight,
					{
						x: `${widthTransRight}`,
						ease: 'power3.inOut',
						duration: 1,
					},
					'<',
				)
				.to(
					$(transInner).find('.ic-1')[0],
					{
						x: () => -transInner.getBoundingClientRect().width / 2,
						y: () => -transInner.getBoundingClientRect().height / 2,
						ease: 'power3.inOut',
						duration: 1,
					},
					'<',
				)
				.to(
					$(transInner).find('.ic-2')[0],
					{
						x: () => transInner.getBoundingClientRect().width / 2,
						y: () => -transInner.getBoundingClientRect().height / 2,
						ease: 'power3.inOut',
						duration: 1,
					},
					'<',
				)
				.to(
					$(transInner).find('.ic-3')[0],
					{
						x: () => -transInner.getBoundingClientRect().width / 2,
						y: () => transInner.getBoundingClientRect().height / 2,
						ease: 'power3.inOut',
						duration: 1,
					},
					'<',
				)
				.to(
					$(transInner).find('.ic-4')[0],
					{
						x: () => transInner.getBoundingClientRect().width / 2,
						y: () => transInner.getBoundingClientRect().height / 2,
						ease: 'power3.inOut',
						duration: 1,
					},
					'<',
				)
				.to(
					playgroundMain,
					{
						opacity: 1,
						scale: 1,
						pointerEvents: 'auto',
						ease: 'power2.out',
						duration: 0.36,
					},
					0.46,
				);
		}

		interact() {
			this.cardLayer = $(this.el).find('.home-playground-card-layer')[0];
			this.sphereScale = $(this.el).find('.home-playground-sphere-scale')[0];
			this.sphere = $(this.el).find('.home-playground-sphere')[0];
			if (!this.cardLayer || !this.sphereScale || !this.sphere) return;

			const sourceCards = Array.from(this.sphere.querySelectorAll('.home-playground-card'));
			if (!sourceCards.length) return;

			const targetCount = Math.max(56, sourceCards.length);
			for (let index = sourceCards.length; index < targetCount; index++) {
				const clone = sourceCards[index % sourceCards.length].cloneNode(true);
				clone.classList.add('is-sphere-clone');
				clone.setAttribute('aria-hidden', 'true');
				clone.setAttribute('tabindex', '-1');
				this.sphere.appendChild(clone);
				this.sphereClones.push(clone);
			}

			this.sphereCards = Array.from(this.sphere.querySelectorAll('.home-playground-card'));
			this.layoutSphereCards();
			this.updateSphereScale();
			this.applySphereTransform();

			const onPointerDown = (event) => {
				if (event.button !== 0) return;
				this.pendingSphereCard = null;
				this.resetSphereFocus();
				this.sphereDragging = true;
				this.sphereDragMoved = false;
				this.spherePointer = {
					id: event.pointerId,
					x: event.clientX,
					y: event.clientY,
					startX: event.clientX,
					startY: event.clientY,
					card: event.target.closest?.('.home-playground-card') || null,
				};
				this.cardLayer.classList.add('is-dragging');
				this.cardLayer.setPointerCapture?.(event.pointerId);
			};

			const onPointerMove = (event) => {
				if (!this.sphereDragging || this.spherePointer?.id !== event.pointerId) return;
				const deltaX = event.clientX - this.spherePointer.x;
				const deltaY = event.clientY - this.spherePointer.y;
				const movedX = event.clientX - this.spherePointer.startX;
				const movedY = event.clientY - this.spherePointer.startY;
				if (Math.hypot(movedX, movedY) > 4) this.sphereDragMoved = true;
				this.sphereRotation.y += (deltaX * 0.2) / this.sphereRotation.scale;
				this.sphereRotation.x -= (deltaY * 0.2) / this.sphereRotation.scale;
				this.spherePointer.x = event.clientX;
				this.spherePointer.y = event.clientY;
				this.applySphereTransform();
			};

			const onPointerEnd = (event) => {
				if (this.spherePointer?.id !== event.pointerId) return;
				const selectedCard =
					event.type === 'pointerup' && !this.sphereDragMoved
						? this.spherePointer.card
						: null;
				this.sphereDragging = false;
				this.spherePointer = null;
				this.cardLayer.classList.remove('is-dragging');
				this.cardLayer.releasePointerCapture?.(event.pointerId);
				if (selectedCard) this.requestSphereCardFocus(selectedCard);
			};

			this.cardLayer.addEventListener('pointerdown', onPointerDown);
			this.cardLayer.addEventListener('pointermove', onPointerMove);
			this.cardLayer.addEventListener('pointerup', onPointerEnd);
			this.cardLayer.addEventListener('pointercancel', onPointerEnd);
			this.sphereCleanups.push(() => {
				this.cardLayer?.removeEventListener('pointerdown', onPointerDown);
				this.cardLayer?.removeEventListener('pointermove', onPointerMove);
				this.cardLayer?.removeEventListener('pointerup', onPointerEnd);
				this.cardLayer?.removeEventListener('pointercancel', onPointerEnd);
			});

			sourceCards.forEach((card) => {
				const onKeyDown = (event) => {
					if (event.key !== 'Enter' && event.key !== ' ') return;
					event.preventDefault();
					this.requestSphereCardFocus(card);
				};
				card.addEventListener('keydown', onKeyDown);
				this.sphereCleanups.push(() => card.removeEventListener('keydown', onKeyDown));
			});

			const onScrollIntent = (event) => {
				if (!this.sphereFocused && !this.sphereScrollResetting) return;
				event.preventDefault();
				if (this.sphereScrollResetting) return;

				this.sphereScrollResetting = true;
				this.sphereShouldResumeScroll = smoothScroll.isRunning();
				smoothScroll.stop();
				this.resetSphereFocus(() => this.finishSphereScrollReset());
			};
			window.addEventListener('wheel', onScrollIntent, { passive: false, capture: true });
			window.addEventListener('touchmove', onScrollIntent, { passive: false, capture: true });
			this.sphereCleanups.push(() => {
				window.removeEventListener('wheel', onScrollIntent, true);
				window.removeEventListener('touchmove', onScrollIntent, true);
			});

			this.sphereObserver = new IntersectionObserver(([entry]) => {
				this.sphereVisible = entry.isIntersecting;
			});
			this.sphereObserver.observe(this.cardLayer);

			this.sphereResizeObserver = new ResizeObserver(() => this.updateSphereScale());
			this.sphereResizeObserver.observe(this.cardLayer);

			const tick = (time) => {
				const delta = this.sphereLastTime ? Math.min(50, time - this.sphereLastTime) : 16.667;
				this.sphereLastTime = time;
				if (
					this.sphereVisible &&
					!this.sphereDragging &&
					!this.sphereFocused &&
					!window.matchMedia('(prefers-reduced-motion: reduce)').matches
				) {
					this.sphereRotation.y += (delta / 16.667) * 0.08;
					this.applySphereTransform();
				}
				this.sphereRaf = requestAnimationFrame(tick);
			};
			this.sphereRaf = requestAnimationFrame(tick);
		}

		layoutSphereCards() {
			const count = this.sphereCards.length;
			const radius = cvUnit(PLAYGROUND_SPHERE_RADIUS_REM, 'rem');
			const rows = Math.max(2, Math.round(Math.sqrt(count)));
			const rowCounts = [];
			let placedCount = 0;

			for (let row = 0; row < rows; row++) {
				const latitude = (1 - 2 * ((row + 0.5) / rows)) * 90;
				const circumference = Math.cos((latitude * Math.PI) / 180);
				const rowCount = Math.max(1, Math.round((circumference * count * (Math.PI / 2)) / rows));
				rowCounts.push(rowCount);
				placedCount += rowCount;
			}

			let remainder = count - placedCount;
			while (remainder !== 0) {
				let widestRow = 0;
				for (let row = 1; row < rows; row++) {
					if (rowCounts[row] > rowCounts[widestRow]) widestRow = row;
				}
				if (remainder > 0) {
					rowCounts[widestRow] += 1;
					remainder -= 1;
				} else if (rowCounts[widestRow] > 1) {
					rowCounts[widestRow] -= 1;
					remainder += 1;
				} else {
					break;
				}
			}

			let cardIndex = 0;
			for (let row = 0; row < rows; row++) {
				const latitude = (1 - 2 * ((row + 0.5) / rows)) * 90;
				const rowCount = rowCounts[row];
				const offset = row % 2 === 0 ? 0 : 180 / rowCount;

				for (let column = 0; column < rowCount && cardIndex < count; column++) {
					const card = this.sphereCards[cardIndex];
					const rotationX = -latitude;
					const rotationY = (column / rowCount) * 360 + offset;
					card.dataset.sphereRotationX = rotationX;
					card.dataset.sphereRotationY = rotationY;
					card.style.transform = `rotateY(${rotationY}deg) rotateX(${rotationX}deg) translateZ(${radius}px)`;
					cardIndex += 1;
				}
			}
		}

		updateSphereScale() {
			if (!this.cardLayer || !this.sphereScale) return;
			const radius = cvUnit(PLAYGROUND_SPHERE_RADIUS_REM, 'rem');
			const diameterWithSpace = radius * 2.5;
			const scale =
				Math.min(
					1,
					this.sphereScale.offsetWidth / diameterWithSpace,
					this.sphereScale.offsetHeight / diameterWithSpace,
				) * 1.1;
			gsap.set(this.sphereScale, { scale });
		}

		applySphereTransform() {
			if (!this.sphere) return;
			this.sphere.style.transform = `scale(${this.sphereRotation.scale}) rotateX(${this.sphereRotation.x}deg) rotateY(${this.sphereRotation.y}deg)`;
		}

		closestSphereAngle(current, target) {
			let delta = (target - current) % 360;
			if (delta > 180) delta -= 360;
			if (delta < -180) delta += 360;
			return current + delta;
		}

		isSphereFocusAvailable() {
			const transitionEnd = this.tlTrans?.scrollTrigger?.end;
			if (!Number.isFinite(transitionEnd)) return true;

			return window.scrollY <= transitionEnd + 2;
		}

		requestSphereCardFocus(card) {
			if (!card?.isConnected) return;

			const transition = this.tlTrans?.scrollTrigger;
			if (
				!transition ||
				(transition.progress >= 0.999 && this.isSphereFocusAvailable())
			) {
				this.pendingSphereCard = null;
				this.focusSphereCard(card);
				return;
			}

			this.pendingSphereCard = card;
			if (this.sphereTransitionScrolling) return;

			this.sphereTransitionScrolling = true;
			const finishFocus = () => {
				if (!this.sphereTransitionScrolling) return;
				ScrollTrigger.update();

				const pendingCard = this.pendingSphereCard;
				if (!this.el?.isConnected || !pendingCard?.isConnected) {
					this.sphereTransitionScrolling = false;
					this.pendingSphereCard = null;
					this.tlTrans?.eventCallback('onComplete', null);
					return;
				}
				if (!this.isSphereFocusAvailable()) return;

				this.sphereTransitionScrolling = false;
				this.pendingSphereCard = null;
				this.tlTrans?.eventCallback('onComplete', null);
				this.focusSphereCard(pendingCard);
			};
			this.tlTrans?.eventCallback('onComplete', finishFocus);

			if (!smoothScroll.lenis) {
				window.scrollTo({ top: transition.end, behavior: 'smooth' });
				gsap.delayedCall(0.8, finishFocus);
				return;
			}

			const scrollDistance = Math.abs(smoothScroll.getScroll() - transition.end);
			const scrollDuration = Math.min(
				2.8,
				Math.max(1.2, (scrollDistance / window.innerHeight) * 0.8),
			);
			smoothScroll.scrollTo(transition.end, {
				duration: scrollDuration,
				easing: (progress) => progress * progress * (3 - 2 * progress),
				lock: true,
				force: true,
				onComplete: finishFocus,
			});
		}

		focusSphereCard(card) {
			this.finishSphereScrollReset();
			const cardRotationX = Number(card.dataset.sphereRotationX || 0);
			const cardRotationY = Number(card.dataset.sphereRotationY || 0);
			this.sphereCards.forEach((item) => {
				const selected = item === card;
				item.classList.toggle('is-focused', selected);
				item.setAttribute('aria-pressed', String(selected));
			});
			this.sphereFocused = true;
			this.el?.classList.add('is-sphere-focused');
			this.sphereFocus?.kill();
			this.sphereFocus = gsap.to(this.sphereRotation, {
				x: this.closestSphereAngle(this.sphereRotation.x, -cardRotationX),
				y: this.closestSphereAngle(this.sphereRotation.y, -cardRotationY),
				scale: 3,
				duration: 2.2,
				ease: 'power3.inOut',
				overwrite: true,
				onUpdate: () => this.applySphereTransform(),
			});
		}

		finishSphereScrollReset() {
			if (!this.sphereScrollResetting) return;
			this.sphereScrollResetting = false;
			const shouldResumeScroll = this.sphereShouldResumeScroll;
			this.sphereShouldResumeScroll = false;
			if (shouldResumeScroll) smoothScroll.start();
		}

		resetSphereFocus(onComplete) {
			if (!this.sphereFocused) return;
			this.sphereFocused = false;
			this.el?.classList.remove('is-sphere-focused');
			this.sphereCards.forEach((card) => {
				card.classList.remove('is-focused');
				card.setAttribute('aria-pressed', 'false');
			});
			this.sphereFocus?.kill();
			this.sphereFocus = gsap.to(this.sphereRotation, {
				scale: 1,
				duration: 2.2,
				ease: 'power3.inOut',
				overwrite: true,
				onUpdate: () => this.applySphereTransform(),
				onComplete,
			});
		}

		destroy() {
			super.cleanTrigger();
			this.el?.classList.remove('is-sphere-focused');
			this.pendingSphereCard = null;
			this.sphereTransitionScrolling = false;
			this.finishSphereScrollReset();
			if (this.sphereRaf) cancelAnimationFrame(this.sphereRaf);
			this.sphereRaf = null;
			this.sphereObserver?.disconnect();
			this.sphereResizeObserver?.disconnect();
			this.sphereObserver = null;
			this.sphereResizeObserver = null;
			this.sphereCleanups.forEach((cleanup) => cleanup());
			this.sphereCleanups = [];
			this.sphereClones.forEach((card) => card.remove());
			this.sphereClones = [];
			this.sphereCards = [];
			this.sphereReveal?.kill();
			this.sphereFocus?.kill();
			if (this.tlTrans) {
				if (this.tlTrans.scrollTrigger) this.tlTrans.scrollTrigger.kill();
				this.tlTrans.kill();
			}
			this.sphereReveal = null;
			this.sphereFocus = null;
			this.tlTrans = null;
			this.sphere = null;
			this.sphereScale = null;
			this.cardLayer = null;
			this.el = null;
		}
	},
	Footer: class {
		setup(data) {
			footer.trigger(data);
		}

		destroy() {
			footer.destroy();
		}
	},
};
