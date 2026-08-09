import { TriggerSetup } from '../../core/trigger-setup.js';
import { gsap, ScrollTrigger } from '../../core/gsap.js';
import { cvUnit } from '../../core/helpers.js';
import { SvgPathParticles } from '../../core/svg-path-particles.js';
import { Renderer, Camera, Transform, Texture, Program, Mesh, Plane, Sphere, Vec3 } from 'ogl';
import {
	distortionVertex as vertex,
	objectFitFragment as fragment,
	playgroundSphereVertex,
	playgroundSphereFragment,
} from '../../core/shaders.js';

const HERO_VIDEO_FPS = 24;
const HERO_VIDEO_SEEK_THRESHOLD = 1 / (HERO_VIDEO_FPS * 2);
const WORKS_TRANSITION_ROTATION = 125;
const WORKS_TRANSITION_MAX_SCALE = 16;
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
			this.timeEl = null;
			this.timeTimer = null;
			this.tlOnce = null;
			this.tlEnter = null;
			this.tlHeroTop = null;
			this.tlHeroBot = null;
			this.tlHeroBotEnd = null;
			// this.tlHeroEnd = null;

		}

		setup(data, mode) {
			this.el = data.next.container.querySelector('.home-hero-wrap');
			if (!this.el) return;

			this.video = this.el.querySelector('.home-hero-video');
			this.worksEl = data.next.container.querySelector('.home-works-wrap');
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

		setupHeroTime() {
			this.timeEl = this.el.querySelector('[data-time]');
			if (!this.timeEl) return;

			const formatter = new Intl.DateTimeFormat('en-GB', {
				timeZone: 'Asia/Ho_Chi_Minh',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hourCycle: 'h23',
			});
			const updateTime = () => {
				if (this.timeEl) this.timeEl.textContent = formatter.format(new Date());
			};

			updateTime();
			this.timeTimer = window.setInterval(updateTime, 1000);
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
				trigger: this.el.querySelector('.home-hero-top.top-left'),
				start: 'top top',
				end: 'bottom top',
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
					start: 'top top+=20%',
					end: 'bottom top',
					scrub: true,
				}
			});
			this.tlHeroBot.to(this.el.querySelector('.home-hero-decor-inner'), {
				xPercent: 70,
				yPercent: -175,
				ease: 'none'
			});

			this.tlHeroBotEnd = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-hero-bottom-desc'),
					start: 'top top+=15%',
					end: 'bottom top',
					scrub: true,
				}
			});
			this.tlHeroBotEnd.to(this.el.querySelector('.home-hero-logo'), {
				yPercent: -200,
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
			if (this.tlHeroBotEnd) this.tlHeroBotEnd.kill();
			// if (this.tlHeroEnd) this.tlHeroEnd.kill();

			this.video = null;
			this.timeEl = null;
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
		}

		trigger(data) {
			this.el = data.next.container.querySelector('.home-works-wrap');
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
			console.log('Works Setup');
			this.setupWebGL();
		}

		animationReveal() {
		}

		animationScrub() {
			const decorSvg = this.el.querySelector('.home-works-svg .home-works-svg-anim svg');
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

			const worksSection = this.el.querySelector('.home-works--main');
			const worksSvg = this.el.querySelector('.home-works-svg');
			const worksTitle = this.el.querySelector('.home-works-main-title');
			const worksDesc = this.el.querySelector('.home-works-main-desc');
			const worksTitleTop =
				worksTitle.getBoundingClientRect().top -
				worksSection.getBoundingClientRect().top - 
				worksTitle.getBoundingClientRect().height;

			const worksDescHeight = worksDesc.getBoundingClientRect().height;

			console.log(worksTitleTop);
			this.tlWorksTop = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-works-block'),
					start: 'top top',
					end: 'bottom top',
					scrub: true
				}
			});
			this.tlWorksTop
				.to(worksTitle, { y: worksDescHeight, ease: 'power3.inOut' })
				.to(worksDesc, { y: worksDescHeight, ease: 'power3.inOut' },'<=' )
				.to(worksSvg, { width: cvUnit(291, 'rem'), y: worksTitleTop, color: 'var(--cl-content-disable)' , ease: 'power3.inOut' }, '<=' )


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

		setupWebGL() {
			if (this.renderer) return;

			const canvas = this.el.querySelector('#works-gl-canvas');
			if (!canvas) return;

			this.renderer = new Renderer({ canvas, alpha: true, antialias: true, dpr: 2 });
			const gl = this.renderer.gl;
			const camera = new Camera(gl);
			camera.fov = 45;
			camera.position.z = 20;

			const scene = new Transform();
			// OPTIMIZATION 1: Giảm segments nhưng phải giữ cả height và width để không bị cắt nát hình
			this.geometry = new Plane(gl, { heightSegments: 30, widthSegments: 30 });

			this.meshes = [];
			this.programs = [];
			this.tls = [];
			this.textures = [];
			this.imageLoadCleanups = [];

			const items = gsap.utils.toArray(this.el.querySelectorAll('.home-works-item'));

			items.forEach((item, index) => {
				const imgEl = item.querySelector('img');
				if (!imgEl) return;

				const texture = new Texture(gl, { generateMipmaps: false });
				this.textures.push(texture);
				const program = new Program(gl, {
					fragment,
					vertex,
					uniforms: {
						tMap: { value: texture },
						uProgress: { value: 0 },
						uPlaneSize: { value: [0, 0] },
						uDOMSize: { value: [0, 0] },
						uImageSize: { value: [0, 0] },
						uBorderRadius: { value: 0 },
						rotationAxis: { value: [0, 1, 0] },
						distortionAxis: { value: [1, 1, 1] },
						uDistortion: { value: 2.5 }
					},
					cullFace: false,
					transparent: true
				});

				this.programs.push(program);

				const setupTexture = (image) => {
					texture.image = image;
					program.uniforms.uImageSize.value = [image.naturalWidth, image.naturalHeight];
					imgEl.classList.add('gl-hidden');
				};

				if (imgEl.complete && imgEl.naturalWidth > 0) {
					setupTexture(imgEl);
				} else {
					const onImageLoad = () => setupTexture(imgEl);
					imgEl.addEventListener('load', onImageLoad, { once: true });
					this.imageLoadCleanups.push(() => {
						imgEl.removeEventListener('load', onImageLoad);
					});
				}

				const mesh = new Mesh(gl, { geometry: this.geometry, program });
				mesh.setParent(scene);
				this.meshes.push({ mesh, item, program, imgEl });

				const proxy = { progress: 0 };
				const tl = gsap.timeline({
					scrollTrigger: {
						trigger: item,
						start: 'top bottom',
						end: 'bottom top',
						scrub: 1,
					}
				});
				tl.to(proxy, {
					progress: 1,
					ease: "none",
					onUpdate: () => {
						program.uniforms.uProgress.value = proxy.progress;
					}
				});
				this.tls.push(tl);
			});

			this.onResize = () => {
				const w = window.innerWidth;
				const h = window.innerHeight;

				this.renderer.setSize(w, h);
				camera.perspective({ aspect: w / h });

				const fov = camera.fov * (Math.PI / 180);
				const height = 2 * Math.tan(fov / 2) * camera.position.z;
				const width = height * camera.aspect;

				// OPTIMIZATION 2: Tính toán kích thước 1 lần duy nhất khi resize
				this.meshes.forEach(obj => {
					const container = obj.item.querySelector('.home-works-item-img');
					if (container) {
						const style = getComputedStyle(container);
						obj.program.uniforms.uBorderRadius.value = parseFloat(style.borderRadius) || 0;

						const rect = container.getBoundingClientRect();
						obj.bounds = {
							w: rect.width,
							h: rect.height,
							left: rect.left,
							topOffset: rect.top + window.scrollY // Lưu lại vị trí tuyệt đối so với document
						};

						obj.mesh.scale.x = (width * rect.width) / w;
						obj.mesh.scale.y = (height * rect.height) / h;
						obj.program.uniforms.uPlaneSize.value = [obj.mesh.scale.x, obj.mesh.scale.y];
						obj.program.uniforms.uDOMSize.value = [rect.width, rect.height];
					}
				});

				this.viewSize = { w, h, width, height };
				if (this.isVisible) this.startWorksRender?.();
			};

			window.addEventListener('resize', this.onResize);
			this.webGLResizeTimer = window.setTimeout(() => {
				this.webGLResizeTimer = null;
				if (this.renderer && this.onResize) this.onResize();
			}, 100);

			// OPTIMIZATION 3: Intersection Observer để tạm dừng render khi không cuộn tới
			this.isVisible = false;
			this.observer = new IntersectionObserver((entries) => {
				this.isVisible = entries[0].isIntersecting;
				canvas.style.visibility = this.isVisible ? 'visible' : 'hidden';
				if (this.isVisible && !document.hidden) {
					this.startWorksRender?.();
				} else {
					this.stopWorksRender?.();
				}
			}, { rootMargin: '100px 0px' }); // Render trước khi vào màn hình 100px
			this.observer.observe(this.el);

			this.stopWorksRender = () => {
				if (this.rafId === null) return;
				window.cancelAnimationFrame(this.rafId);
				this.rafId = null;
			};

			this.renderWorksFrame = () => {
				this.rafId = null;
				if (!this.isVisible || document.hidden || !this.viewSize || !this.renderer) return;

				const { w, h, width, height } = this.viewSize;
				const scrollY = window.scrollY;

				this.meshes.forEach(obj => {
					if (!obj.bounds) return;

					const currentTop = obj.bounds.topOffset - scrollY;
					const x = obj.bounds.left + obj.bounds.w / 2;
					const y = currentTop + obj.bounds.h / 2;

					obj.mesh.position.x = (x / w) * width - width / 2;
					obj.mesh.position.y = -(y / h) * height + height / 2;
				});

				this.renderer.render({ scene, camera });
				this.rafId = window.requestAnimationFrame(this.renderWorksFrame);
			};

			this.startWorksRender = () => {
				if (
					this.rafId !== null ||
					!this.isVisible ||
					document.hidden ||
					!this.viewSize ||
					!this.renderer
				) {
					return;
				}
				this.rafId = window.requestAnimationFrame(this.renderWorksFrame);
			};

			this.onWorksVisibilityChange = () => {
				if (document.hidden) {
					this.stopWorksRender?.();
				} else if (this.isVisible) {
					this.startWorksRender?.();
				}
			};
			document.addEventListener('visibilitychange', this.onWorksVisibilityChange);
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

			transition.classList.add('is-canvas-active');
			this.onTransitionResize = () => {
				this.updateTransitionMetrics();
				this.drawTransitionCanvas();
				this.transitionSwapProgress = this.calculateTransitionSwapProgress();
				this.updateTransitionContent(true);
			};
			window.addEventListener('resize', this.onTransitionResize);
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
				if (
					targetCanvas.width !== renderWidth ||
					targetCanvas.height !== renderHeight
				) {
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
				pointerEvents: showNextContent ? 'none' : 'auto',
				duration: 0.01,
				overwrite: true,
			});
			gsap.to(this.el.querySelector('.home-works--decor'), {
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

			const {
				width,
				height,
				pixelRatio,
				innerSize,
				innerLeft,
				shapeSize,
				color,
			} = metrics;
			const shapeScale = (shapeSize / 250) * state.scale;
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
				targetContext.translate(innerLeft + innerSize / 2, innerSize / 2);
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
				document.removeEventListener('visibilitychange', this.onWorksVisibilityChange);
			}
			if (this.webGLResizeTimer) window.clearTimeout(this.webGLResizeTimer);
			if (this.imageLoadCleanups) {
				this.imageLoadCleanups.forEach(cleanup => cleanup());
			}
			if (this.tls) {
				this.tls.forEach(tl => {
					if (tl.scrollTrigger) tl.scrollTrigger.kill();
					tl.kill();
				});
			}
			if (this.meshes) this.meshes.forEach(({ imgEl }) => imgEl.classList.remove('gl-hidden'));

			if (this.geometry) this.geometry.remove();
			if (this.programs) this.programs.forEach(p => p.remove());
			if (this.renderer && this.renderer.gl) {
				if (this.textures) {
					this.textures.forEach(texture => {
						if (texture.texture) {
							this.renderer.gl.deleteTexture(texture.texture);
						}
					});
				}
				const extension = this.renderer.gl.getExtension('WEBGL_lose_context');
				if (extension) extension.loseContext();
			}
			if (this.onResize) window.removeEventListener('resize', this.onResize);
			if (this.observer) this.observer.disconnect();

			this.meshes = [];
			this.programs = [];
			this.textures = [];
			this.tls = [];
			this.imageLoadCleanups = [];
			this.geometry = null;
			this.viewSize = null;
			this.observer = null;
			this.onResize = null;
			this.webGLResizeTimer = null;
			this.rafId = null;
			this.isVisible = false;
			this.renderWorksFrame = null;
			this.startWorksRender = null;
			this.stopWorksRender = null;
			this.onWorksVisibilityChange = null;
			this.renderer = null;
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
			if (!this.el) return;
		}

		animationReveal() {
		}

		animationScrub() {
			const decor = this.el.querySelector('.home-how-intro-decor');
			const shapeWraps = decor.querySelectorAll('.home-how-intro-decor-shape-wrap');
			const shapeDecor1 = shapeWraps[0].querySelector('.ic-1');
			const shapeDecor2 = shapeWraps[0].querySelector('.ic-2');
			const shapeDecor3 = shapeWraps[1].querySelector('.ic-3');
			const shapeDecor4 = shapeWraps[1].querySelector('.ic-4');
			const lastItem = this.el.querySelector('.home-how-content-item:last-child');
			const lastItemLeft = lastItem.querySelector('.home-how-content-item-left');
			const lastItemRight = lastItem.querySelector('.home-how-content-item-right');
			const lastItemTitle = lastItem.querySelector('.home-how-content-item-title');
			const lastItemText = lastItem.querySelector('.home-how-content-item-text');
			const getShapeWidth = () => shapeWraps[0].getBoundingClientRect().width;
			const getDecorDistance = () => (
				decor.getBoundingClientRect().width / 2 - getShapeWidth() / 2
			);


			this.tlDecor = gsap.timeline({
				scrollTrigger: {
					trigger: decor,
					start: 'top center',
					endTrigger: this.el.querySelector('.home-how-thumb-inner'),
					end: 'top center-=5%',
					scrub: true,
					invalidateOnRefresh: true,
				}
			});

			this.tlDecor
				.to(shapeWraps[0], {
					x: () => -getDecorDistance(),
					ease: 'power3.inOut',
				})
				.to(shapeWraps[1], {
					x: () => getDecorDistance(),
					ease: 'power3.inOut',
				}, '<');

			this.tlTrans = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-how-trans'),
					start: 'top top+=50%',
					end: 'bottom bottom',
					scrub: true,
					invalidateOnRefresh: true,
				}
			});
			this.tlTrans
			.to(shapeWraps[0], {
				x: () => getShapeWidth(),
				ease: 'power2.inOut',
				duration: 0.7,
			})
			.to(lastItemLeft, {
				x: () => lastItem.getBoundingClientRect().width / 2
					- lastItemTitle.getBoundingClientRect().width
					- cvUnit(100, 'rem'),
				ease: 'power3.inOut',
				duration: 0.7,
			}, '<')
			.to(lastItemRight, {
				x: () => -(lastItem.getBoundingClientRect().width / 2
					- lastItemText.getBoundingClientRect().width
					- cvUnit(100, 'rem')),
				ease: 'power3.inOut',
				duration: 0.7,
			}, '<')
			.to(shapeWraps[1], {
				x: () => getShapeWidth(),
				ease: 'power3.inOut',
				duration: 0.7,
			}, '<')
			.to(shapeDecor1, {
				xPercent: -100,
				yPercent: 100,
				ease: 'power3.out',
				duration: 0.3,
			}, 0.4)
			.to(shapeDecor2, {
				xPercent: -100,
				yPercent: -100,
				ease: 'power3.out',
				duration: 0.3,
			}, '<')
			.to(shapeDecor3, {
				xPercent: -100,
				yPercent: 100,
				ease: 'power3.out',
				duration: 0.3,
			}, '<')
			.to(shapeDecor4, {
				xPercent: -100,
				yPercent: -100,
				ease: 'power3.out',
				duration: 0.3,
			}, '<')
			.to([lastItemLeft, lastItemRight], {
				y: () => lastItem.getBoundingClientRect().height,
				ease: 'power3.inOut',
				duration: 0.3,
			}, '>')
			.to(document.querySelectorAll('.home-playground-trans-decor'), {
				opacity: 1,
				ease: 'power1.inOut',
				duration: 0.01,
			}, '<')
			.to([shapeWraps[0], shapeWraps[1]], {
				opacity: 0,
				ease: 'power1.inOut',
				duration: 0.01,
			}, '<')
			.fromTo([document.querySelectorAll('.home-playground-content-left-title'), document.querySelectorAll('.home-playground-content-right-title')],
			{
				yPercent: 100,
			},
			{
				yPercent: 0,
				ease: 'power3.inOut',
				duration: 0.3,
			}, 1);

			this.tlItemScrolls = [];
			const thumbItems = this.el.querySelectorAll('.home-how-thumb-item');
			const contentItems = this.el.querySelectorAll('.home-how-content-item');
			const contentList = this.el.querySelector('.home-how-content-list');
			const activateContent = (activeIndex, direction) => {
				contentItems.forEach((item, itemIndex) => {
					if (itemIndex === activeIndex) {
						item.classList.remove('is-static-exit');
						item.classList.toggle('is-above', direction === 'backward');
						item.classList.add('active');
						return;
					}

					if (!item.classList.contains('active')) return;
					item.classList.toggle('is-above', direction === 'forward');
					item.classList.remove('active');
				});
			};
			const clearContent = (direction, staticExit = false) => {
				contentItems.forEach((item) => {
					if (!item.classList.contains('active')) return;
					item.classList.toggle('is-static-exit', staticExit);
					item.classList.toggle('is-above', direction === 'forward' && !staticExit);
					item.classList.remove('active');
				});
			};

			thumbItems.forEach((thumb, index) => {
				const frame = thumb.querySelector('.home-how-thumb-item-inner');
				const direction = index % 2 === 0 ? 1 : -1;
				const clipPath = this.el.querySelector(`#home-how-clip-${index + 1} path`);
				const shapeA = 'M .082 .095 L .958 .004 Q 1 0 .995 .042 L .954 .958 Q .95 1 .908 .995 L .042 .886 Q 0 .88 .005 .838 L .036 .142 Q .04 .1 .082 .095 Z';
				const shapeB = 'M .042 .005 L .908 .095 Q .96 .1 .964 .142 L .995 .838 Q 1 .88 .958 .886 L .092 .995 Q .05 1 .046 .958 L .005 .042 Q 0 0 .042 .005 Z';
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
							activateContent(index, 'forward');
						},
						onEnterBack: () => {
							if (index === thumbItems.length - 1) contentList.classList.add('active-ic');
							activateContent(index, 'backward');
						},
						onLeave: () => {
							if (index !== thumbItems.length - 1) return;
							contentList.classList.remove('active-ic');
							clearContent('forward', true);
						},
						onLeaveBack: () => {
							if (index !== 0) return;
							contentList.classList.remove('active-ic');
							clearContent('backward');
						}
				});
				this.tlItemScrolls.push(contentTrigger);
			});
		}

		interact() {
			const cards = this.el.querySelectorAll('.home-how-thumb-item');

			cards.forEach((card) => {
				const frame = card.querySelector('.home-how-thumb-item-inner');

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
						overwrite: 'auto'
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
						overwrite: 'auto'
					});
				};

				card.addEventListener('pointermove', onPointerMove);
				card.addEventListener('pointerleave', onPointerLeave);
				this.hoverCleanups.push(() => {
					card.removeEventListener('pointermove', onPointerMove);
					card.removeEventListener('pointerleave', onPointerLeave);
					gsap.killTweensOf(frame);
				});
			});
		}

		destroy() {
			super.cleanTrigger();
			if (this.tlDecor) this.tlDecor.kill();
			if (this.tlTrans) this.tlTrans.kill();
			if (this.tlItemScrolls) {
				this.tlItemScrolls.forEach(tl => tl.kill());
			}
			this.tlDecor = null;
			this.tlTrans = null;
			this.hoverCleanups.forEach(cleanup => cleanup());
			this.hoverCleanups = [];
			this.el = null;
		}
	},
	Playground: class extends TriggerSetup {
		constructor() {
			super();
			this.el = null;
			this.tlTrans = null;
			this.renderer = null;
			this.sphereCamera = null;
			this.sphereScene = null;
			this.sphereTiltPivot = null;
			this.sphereGeometry = null;
			this.sphereProgram = null;
			this.sphereTexture = null;
			this.sphereMesh = null;
			this.sphereCards = [];
			this.sphereCardClones = [];
			this.sphereCanvas = null;
			this.sphereObserver = null;
			this.sphereRaf = null;
			this.sphereVisible = false;
			this.sphereCleanups = [];
			this.sphereState = null;
		}

		trigger(data) {
			this.el = data.next.container.querySelector('.home-playground-wrap');
			if (!this.el) return;
			super.setTrigger(this.el, this.onTrigger.bind(this));
		}

		onTrigger() {
			this.setup();
			this.animationReveal();
			this.animationScrub();
			this.interact();
		}

		setup(){
			this.setupSphere();
		}

		setupSphere() {
			if (this.renderer || !this.el) return;

			const canvas = this.el.querySelector('.home-playground-sphere-canvas');
			const main = this.el.querySelector('.home-playground-main');
			const hitArea = this.el.querySelector('.home-playground-sphere-hitarea');
			if (!canvas || !main || !hitArea) return;

			this.sphereCanvas = canvas;
			this.renderer = new Renderer({
				canvas,
				alpha: true,
				antialias: true,
				dpr: Math.min(window.devicePixelRatio || 1, 2),
			});

			const gl = this.renderer.gl;
			gl.clearColor(0, 0, 0, 0);

			this.sphereCamera = new Camera(gl, { fov: 45 });
			this.sphereScene = new Transform();
			this.sphereTiltPivot = new Transform();
			this.sphereTiltPivot.rotation.z = -23.5 * (Math.PI / 180);
			this.sphereTiltPivot.setParent(this.sphereScene);
			this.sphereGeometry = new Sphere(gl, {
				radius: 1,
				widthSegments: 96,
				heightSegments: 64,
			});

			const patternCanvas = document.createElement('canvas');
			const patternSize = 2048;
			const leavesPerRing = 60;
			const patternRows = 24;
			const leafLeftTipX = 0.000350508;
			const leafRightTipX = 9.17299;
			const leafTopTipY = 0.145151;
			const leafBottomTipY = 6.3322;
			const mirroredLeafOffsetX = leafRightTipX - leafLeftTipX;
			const mirroredLeafOffsetY = leafTopTipY - (7 - leafBottomTipY);
			const leafPairStepX = (leafRightTipX - leafLeftTipX) * 2;
			const pairsPerRing = leavesPerRing / 2;
			const ringStepY = 6.55;
			const patternScaleX = patternSize / (pairsPerRing * leafPairStepX);
			const patternScaleY = patternSize / (patternRows * ringStepY);
			patternCanvas.width = patternSize;
			patternCanvas.height = patternSize;
			const patternContext = patternCanvas.getContext('2d');
			const leafPath = new Path2D(
				'M9.17299 0.145151C4.93154 -0.679303 0.824805 2.09075 0.000350508 6.3322C4.2418 7.15666 8.34854 4.3866 9.17299 0.145151Z'
			);
			patternContext.clearRect(0, 0, patternSize, patternSize);
			patternContext.fillStyle = '#DEFB37';
			patternContext.strokeStyle = '#DEFB37';
			patternContext.lineWidth = 0.9;
			patternContext.lineJoin = 'round';
			patternContext.lineCap = 'round';

			for (let row = -1; row <= patternRows; row += 1) {
				for (let pair = -1; pair <= pairsPerRing; pair += 1) {
					const pairX = pair * leafPairStepX;

					patternContext.save();
					patternContext.translate(
						pairX * patternScaleX,
						row * ringStepY * patternScaleY,
					);
					patternContext.scale(patternScaleX, patternScaleY);
					patternContext.fill(leafPath);
					patternContext.stroke(leafPath);
					patternContext.restore();

					patternContext.save();
					patternContext.translate(
						(pairX + mirroredLeafOffsetX) * patternScaleX,
						(row * ringStepY + mirroredLeafOffsetY) * patternScaleY,
					);
					patternContext.scale(patternScaleX, patternScaleY);
					patternContext.translate(0, 7);
					patternContext.scale(1, -1);
					patternContext.fill(leafPath);
					patternContext.stroke(leafPath);
					patternContext.restore();

					// Hai path chỉ chạm nhau tại một điểm. Bù một nút rất nhỏ để
					// mipmap/texture filtering không làm đứt chuỗi trên WebGL.
					patternContext.save();
					patternContext.translate(
						pairX * patternScaleX,
						row * ringStepY * patternScaleY,
					);
					patternContext.scale(patternScaleX, patternScaleY);
					patternContext.beginPath();
					patternContext.arc(leafRightTipX, leafTopTipY, 0.13, 0, Math.PI * 2);
					patternContext.arc(
						leafPairStepX + leafLeftTipX,
						leafBottomTipY,
						0.13,
						0,
						Math.PI * 2,
					);
					patternContext.fill();
					patternContext.restore();
				}
			}

			this.sphereTexture = new Texture(gl, {
				generateMipmaps: false,
				minFilter: gl.LINEAR,
				magFilter: gl.LINEAR,
				wrapS: gl.REPEAT,
				wrapT: gl.CLAMP_TO_EDGE,
			});
			this.sphereTexture.image = patternCanvas;
			this.sphereProgram = new Program(gl, {
				vertex: playgroundSphereVertex,
				fragment: playgroundSphereFragment,
				uniforms: {
					tPattern: { value: this.sphereTexture },
				},
				cullFace: gl.BACK,
				transparent: false,
			});
			this.sphereMesh = new Mesh(gl, {
				geometry: this.sphereGeometry,
				program: this.sphereProgram,
			});
			this.sphereMesh.setParent(this.sphereTiltPivot);

			const toRadians = (degrees) => degrees * (Math.PI / 180);
			const cardLayer = main.querySelector('.home-playground-card-layer');
			const baseCards = Array.from(main.querySelectorAll('.home-playground-card'));
			this.sphereCardClones = baseCards.flatMap((card, index) => {
				const offsets = [180];
				if (index % 2 === 0) offsets.push(index % 4 === 0 ? 90 : -90);

				return offsets.map((longitudeOffset) => {
					const clone = card.cloneNode(true);
					clone.classList.add('is-orbit-clone');
					clone.dataset.longitude = String(
						Number(card.dataset.longitude || 0) + longitudeOffset,
					);
					cardLayer?.appendChild(clone);
					return clone;
				});
			});

			this.sphereCards = [...baseCards, ...this.sphereCardClones].map((card) => {
				const latitude = toRadians(Number(card.dataset.latitude || 0));
				const longitude = toRadians(Number(card.dataset.longitude || 0));
				const anchorRadius = Number(card.dataset.radius || 1.06);
				const latitudeRadius = Math.cos(latitude) * anchorRadius;

				return {
					el: card,
					widthRatio: Number(card.dataset.width || 0.16),
					anchorRadius,
					anchor: new Vec3(
						Math.sin(longitude) * latitudeRadius,
						Math.sin(latitude) * anchorRadius,
						Math.cos(longitude) * latitudeRadius,
					),
					world: new Vec3(),
					projected: new Vec3(),
				};
			});

			this.sphereState = {
				isDragging: false,
				pointerId: null,
				lastX: 0,
				targetX: -0.08,
				targetY: -0.35,
				velocityY: 0,
			};
			this.sphereMesh.rotation.x = this.sphereState.targetX;
			this.sphereMesh.rotation.y = this.sphereState.targetY;

			const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			const onPointerDown = (event) => {
				if (event.pointerType === 'mouse' && event.button !== 0) return;
				this.sphereState.isDragging = true;
				this.sphereState.pointerId = event.pointerId;
				this.sphereState.lastX = event.clientX;
				this.sphereState.velocityY = 0;
				hitArea.classList.add('is-dragging');
				canvas.classList.add('is-dragging');
				hitArea.setPointerCapture?.(event.pointerId);
			};

			const onPointerMove = (event) => {
				if (!this.sphereState.isDragging || this.sphereState.pointerId !== event.pointerId) return;
				const deltaX = event.clientX - this.sphereState.lastX;
				this.sphereState.lastX = event.clientX;
				this.sphereState.targetY += deltaX * 0.008;
				this.sphereState.velocityY = deltaX * 0.0018;
			};

			const endPointerDrag = (event) => {
				if (!this.sphereState.isDragging) return;
				if (event.pointerId != null && this.sphereState.pointerId !== event.pointerId) return;
				this.sphereState.isDragging = false;
				this.sphereState.pointerId = null;
				hitArea.classList.remove('is-dragging');
				canvas.classList.remove('is-dragging');
			};

			const onKeyDown = (event) => {
				const keyRotation = 0.16;
				if (event.key === 'ArrowLeft') this.sphereState.targetY -= keyRotation;
				else if (event.key === 'ArrowRight') this.sphereState.targetY += keyRotation;
				else return;
				event.preventDefault();
			};

			const onResize = () => {
				if (!this.renderer || !this.sphereCamera) return;
				// Renderer khởi tạo canvas ở 300x150px bằng inline style, nên phải
				// đo viewport của scene thay vì đo chính canvas.
				const canvasSize = Math.max(1, Math.min(window.innerHeight * 0.65, main.clientWidth));
				const width = canvasSize;
				const height = canvasSize;
				const aspect = width / height;
				this.renderer.setSize(width, height);
				const sphereHitSize = canvasSize * 0.91;
				hitArea.style.width = `${sphereHitSize}px`;
				hitArea.style.height = `${sphereHitSize}px`;
				this.sphereCamera.position.z = aspect < 0.8 ? 3.4 : 2.85;
				this.sphereCamera.perspective({ aspect });
			};

			const stopRender = () => {
				if (this.sphereRaf === null) return;
				window.cancelAnimationFrame(this.sphereRaf);
				this.sphereRaf = null;
			};

			const updateCards = () => {
				if (!this.sphereCards.length || !this.sphereMesh || !this.sphereCamera) return;
				// Dùng kích thước layout chưa transform. getBoundingClientRect() đã
				// chứa scale của playgroundMain và làm tọa độ card bị scale hai lần.
				const canvasWidth = canvas.clientWidth;
				const canvasHeight = canvas.clientHeight;
				const canvasLeft = (main.clientWidth - canvasWidth) * 0.5;
				const canvasTop = (main.clientHeight - canvasHeight) * 0.5;

				this.sphereCards.forEach((card) => {
					card.world.copy(card.anchor).applyMatrix4(this.sphereMesh.worldMatrix);
					card.projected
						.copy(card.world)
						.applyMatrix4(this.sphereCamera.viewMatrix)
						.applyMatrix4(this.sphereCamera.projectionMatrix);

					const x = canvasLeft + (card.projected.x * 0.5 + 0.5) * canvasWidth;
					const y = canvasTop + (0.5 - card.projected.y * 0.5) * canvasHeight;
					const depthProgress = Math.max(0, Math.min(1, card.world.z / card.anchorRadius));
					const scaleProgress = depthProgress * depthProgress * (3 - 2 * depthProgress);
					const fadeProgress = Math.max(0, Math.min(1, depthProgress / 0.22));
					const facing = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
					const edgeScale = 0.55 + scaleProgress * 0.45;

					card.el.style.opacity = String(facing);
					card.el.style.visibility = facing <= 0.01 ? 'hidden' : 'visible';
					card.el.style.zIndex = String(20 + Math.round(card.world.z * 10));
					card.el.style.width = `${canvasWidth * card.widthRatio}px`;
					card.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${edgeScale})`;
				});
			};

			const render = () => {
				this.sphereRaf = null;
				if (!this.renderer || !this.sphereVisible || document.hidden) return;

				const state = this.sphereState;
				if (!state.isDragging) {
					if (!prefersReducedMotion) state.targetY += 0.0012;
					state.targetY += state.velocityY;
					state.velocityY *= 0.92;
				}

				this.sphereMesh.rotation.x = state.targetX;
				this.sphereMesh.rotation.y += (state.targetY - this.sphereMesh.rotation.y) * 0.14;
				this.renderer.render({ scene: this.sphereScene, camera: this.sphereCamera });
				updateCards();
				this.sphereRaf = window.requestAnimationFrame(render);
			};

			const startRender = () => {
				if (this.sphereRaf !== null || !this.sphereVisible || document.hidden) return;
				this.sphereRaf = window.requestAnimationFrame(render);
			};

			const onVisibilityChange = () => {
				if (document.hidden) stopRender();
				else startRender();
			};

			hitArea.addEventListener('pointerdown', onPointerDown);
			hitArea.addEventListener('pointermove', onPointerMove);
			hitArea.addEventListener('pointerup', endPointerDrag);
			hitArea.addEventListener('pointercancel', endPointerDrag);
			hitArea.addEventListener('lostpointercapture', endPointerDrag);
			canvas.addEventListener('keydown', onKeyDown);
			window.addEventListener('resize', onResize);
			document.addEventListener('visibilitychange', onVisibilityChange);
			onResize();

			this.sphereObserver = new IntersectionObserver((entries) => {
				this.sphereVisible = entries[0].isIntersecting;
				if (this.sphereVisible) startRender();
				else stopRender();
			}, { rootMargin: '100px 0px' });
			this.sphereObserver.observe(main);

			this.sphereCleanups.push(
				() => hitArea.removeEventListener('pointerdown', onPointerDown),
				() => hitArea.removeEventListener('pointermove', onPointerMove),
				() => hitArea.removeEventListener('pointerup', endPointerDrag),
				() => hitArea.removeEventListener('pointercancel', endPointerDrag),
				() => hitArea.removeEventListener('lostpointercapture', endPointerDrag),
				() => canvas.removeEventListener('keydown', onKeyDown),
				() => window.removeEventListener('resize', onResize),
				() => document.removeEventListener('visibilitychange', onVisibilityChange),
				stopRender,
			);
		}

		animationReveal() {}

		animationScrub() {
			const itemLeft = this.el.querySelector('.home-playground-content-left');
			const itemRight = this.el.querySelector('.home-playground-content-right');
			const titleLeft = this.el.querySelector('.home-playground-content-left-title');
			const titleRight = this.el.querySelector('.home-playground-content-right-title');
			const transInner = this.el.querySelector('.home-playground-trans-inner');
			const playgroundMain = this.el.querySelector('.home-playground-main');
			const playgroundContent = this.el.querySelector('.home-playground-content');
			const transitionDecor = transInner.querySelectorAll('.home-playground-trans-decor');

			const widthTransLeft = itemLeft.getBoundingClientRect().width - titleLeft.getBoundingClientRect().width;
			const widthTransRight = itemRight.getBoundingClientRect().width - titleRight.getBoundingClientRect().width;

			this.tlTrans = gsap.timeline({
				scrollTrigger: {
					trigger: this.el.querySelector('.home-playground-empty'),
					start: 'top top+=50%',
					end: 'bottom bottom',
					scrub: true,
					invalidateOnRefresh: true,
				}
			});
			this.tlTrans
				.to(titleLeft, {
					x: `-${widthTransLeft}`,
					ease: 'power3.inOut',
					duration: 1,
				})
				.to(titleRight, {
					x: `${widthTransRight}`,
					ease: 'power3.inOut',
					duration: 1,
				}, '<')
				.to(transInner.querySelector('.ic-1'), {
					x: () => -transInner.getBoundingClientRect().width / 2,
					y: () => -transInner.getBoundingClientRect().height / 2,
					ease: 'power3.inOut',
					duration: 1,
				}, '<')
				.to(transInner.querySelector('.ic-2'), {
					x: () => transInner.getBoundingClientRect().width / 2,
					y: () => -transInner.getBoundingClientRect().height / 2,
					ease: 'power3.inOut',
					duration: 1,
				}, '<')
				.to(transInner.querySelector('.ic-3'), {
					x: () => -transInner.getBoundingClientRect().width / 2,
					y: () => transInner.getBoundingClientRect().height / 2,
					ease: 'power3.inOut',
					duration: 1,
				}, '<')
				.to(transInner.querySelector('.ic-4'), {
					x: () => transInner.getBoundingClientRect().width / 2,
					y: () => transInner.getBoundingClientRect().height / 2,
					ease: 'power3.inOut',
					duration: 1,
				}, '<')
				.to(playgroundMain, {
					opacity: 1,
					scale: 1,
					pointerEvents: 'auto',
					ease: 'power2.out',
					duration: 0.36,
				}, 0.46)
				.to(this.el.querySelector('.home-playground-action'), {
					opacity: 1,
					pointerEvents: 'auto',
					ease: 'power2.out',
					duration: 0.3,
				}, 0.52)
		}

		interact() {}

		destroy() {
			super.cleanTrigger();
			if (this.tlTrans) this.tlTrans.kill();
			if (this.sphereObserver) this.sphereObserver.disconnect();
			this.sphereCleanups.forEach(cleanup => cleanup());
			this.sphereGeometry?.remove();
			this.sphereProgram?.remove();
			if (this.sphereTexture?.texture && this.renderer?.gl) {
				this.renderer.gl.deleteTexture(this.sphereTexture.texture);
			}
			this.tlTrans = null;
			this.renderer = null;
			this.sphereCamera = null;
			this.sphereScene = null;
			this.sphereTiltPivot = null;
			this.sphereGeometry = null;
			this.sphereProgram = null;
			this.sphereTexture = null;
			this.sphereMesh = null;
			this.sphereCards = [];
			this.sphereCardClones.forEach((card) => card.remove());
			this.sphereCardClones = [];
			this.sphereCanvas = null;
			this.sphereObserver = null;
			this.sphereRaf = null;
			this.sphereVisible = false;
			this.sphereCleanups = [];
			this.sphereState = null;
			this.el = null;
		}
		}
	};
