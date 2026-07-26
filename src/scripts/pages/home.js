import { TriggerSetup } from '../../core/trigger-setup.js';
import { gsap, ScrollTrigger } from '../../core/gsap.js';
import { cvUnit, ParallaxImage } from '../../core/helpers.js';
import { SvgPathParticles } from '../../core/svg-path-particles.js';
import { SphericalImageCanvas } from '../../core/spherical-image-canvas.js';
import { Renderer, Camera, Transform, Texture, Program, Mesh, Plane } from 'ogl';
import { distortionVertex as vertex, objectFitFragment as fragment } from '../../core/shaders.js';

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
			}, { rootMargin: '100px 0px' }); // Render trước khi vào màn hình 100px
			this.observer.observe(this.el);

			const render = () => {
				if (this.isVisible && this.viewSize) {
					const { w, h, width, height } = this.viewSize;
					const scrollY = window.scrollY;

					this.meshes.forEach(obj => {
						if (!obj.bounds) return;

						// Tính vị trí Y hiện tại = Vị trí tuyệt đối ban đầu - Lượng cuộn chuột
						const currentTop = obj.bounds.topOffset - scrollY;

						const x = obj.bounds.left + obj.bounds.w / 2;
						const y = currentTop + obj.bounds.h / 2;

						obj.mesh.position.x = (x / w) * width - width / 2;
						obj.mesh.position.y = -(y / h) * height + height / 2;
					});

					this.renderer.render({ scene, camera });
				}
				this.rafId = requestAnimationFrame(render);
			};
			this.rafId = requestAnimationFrame(render);
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

			if (this.rafId) cancelAnimationFrame(this.rafId);
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
			this.renderer = null;
		}
	},
	How: class extends TriggerSetup {
		constructor() {
			super();
			this.el = null;
			this.tlIntroScroll = null;
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
			if (this.tlIntroScroll) this.tlIntroScroll.kill();
			if (this.tlItemScrolls) {
				this.tlItemScrolls.forEach(tl => tl.kill());
			}
			this.hoverCleanups.forEach(cleanup => cleanup());
			this.hoverCleanups = [];
		}
	},
	Playground: class extends TriggerSetup {
		constructor() {
			super();
			this.el = null;
			this.canvasScenes = [];
			this.tlTransition = null;
		}

		trigger(data) {
			this.el = data.next.container.querySelector('.home-playground-wrap');
			if (!this.el) return;
			super.setTrigger(this.el, this.onTrigger.bind(this));
		}

		onTrigger() {
			this.setupCanvas();
			this.animationReveal();
			this.animationScrub();
			this.interact();
		}

		setupCanvas() {
			if (!this.el || this.canvasScenes.length) return;

			const playground = this.el.querySelector('.home-playground');
			const backCanvas = this.el?.querySelector('.home-playground-canvas--back');
			const frontCanvas = this.el?.querySelector('.home-playground-canvas--front');
			if (!playground || !backCanvas || !frontCanvas) return;

			try {
				const imageUrls = JSON.parse(backCanvas.dataset.images || '[]');
				if (!imageUrls.length) return;

				this.canvasScenes = [
					new SphericalImageCanvas({
						canvas: backCanvas,
						root: playground,
						imageUrls,
						layer: 'back',
					}),
					new SphericalImageCanvas({
						canvas: frontCanvas,
						root: playground,
						imageUrls,
						layer: 'front',
					}),
				];
				this.canvasScenes.forEach((scene) => scene.init());
			} catch (error) {
				console.warn('[Home Playground] Không thể khởi tạo WebGL:', error);
				this.canvasScenes.forEach((scene) => scene.destroy());
				this.canvasScenes = [];
				this.el.classList.add('is-static');
			}
		}

		animationReveal() {
		}

		animationScrub() {
			const transition = this.el?.querySelector('.home-playground-trans');
			const transitionInner = transition?.querySelector('.home-playground-trans-inner');
			if (!transition || !transitionInner) return;

			this.tlTransition = gsap.timeline({
				scrollTrigger: {
					trigger: transition,
					start: 'center bottom',
					end: 'bottom top',
					scrub: true
				}
			});
			this.tlTransition.to(transitionInner, {
				scaleX: 1.2,
				scaleY: 0,
				transformOrigin: 'top center',
				ease: 'none'
			});
		}

		interact() {
		}

		destroy() {
			super.cleanTrigger();
			this.canvasScenes.forEach((scene) => scene.destroy());
			this.canvasScenes = [];
			if (this.tlTransition) this.tlTransition.kill();
			this.tlTransition = null;
			this.el = null;
		}
	}
};
