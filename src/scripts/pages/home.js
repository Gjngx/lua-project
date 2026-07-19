import { TriggerSetup } from '../../core/trigger-setup.js';
import { gsap, ScrollTrigger } from '../../core/gsap.js';
import { cvUnit } from '../../core/helpers.js';
import { Renderer, Camera, Transform, Texture, Program, Mesh, Plane } from 'ogl';
import { distortionVertex as vertex, objectFitFragment as fragment } from '../../core/shaders.js';

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
				scale: 0.3072, // 20rem / 65.1rem = ~0.3072 (Tránh Layout Thrashing thay vì dùng width)
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
			this.tlWorksTop
				.to(this.el.querySelector('.home-works-svg'), { color: 'var(--cl-brand-soft)', ease: 'power4.inOut' });

			this.setupWebGL();
			
			// this.tlWorksScroll = gsap.timeline({
			// 	scrollTrigger: {
			// 		trigger: this.el.querySelector('.home-works-list-empty'),
			// 		start: 'top bottom',
			// 		end: 'top top',
			// 		scrub: true,
			// 	}
			// });
			// this.tlWorksScroll
			// 	.to(this.el.querySelector('.home-works'), { autoAlpha: 0, ease: 'none' });
		}

		setupWebGL() {
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

				imgEl.classList.add('gl-hidden');
				
				const setupTexture = (image) => {
					texture.image = image;
					program.uniforms.uImageSize.value = [image.naturalWidth, image.naturalHeight];
				};

				if (imgEl.complete) {
					setupTexture(imgEl);
				} else {
					imgEl.addEventListener('load', () => setupTexture(imgEl));
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
			setTimeout(() => this.onResize(), 100);

			// OPTIMIZATION 3: Intersection Observer để tạm dừng render khi không cuộn tới
			this.isVisible = false;
			this.observer = new IntersectionObserver((entries) => {
				this.isVisible = entries[0].isIntersecting;
			}, { rootMargin: '100px 0px' }); // Render trước khi vào màn hình 100px
			this.observer.observe(this.el.querySelector('.home-works'));

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

		interact() {
		}

		destroy() {
			super.cleanTrigger();
			if (this.tlWorksTop) this.tlWorksTop.kill();
			if (this.tlWorksScroll) this.tlWorksScroll.kill();
			if (this.tls) this.tls.forEach(tl => tl.kill());
			if (this.rafId) cancelAnimationFrame(this.rafId);
			
			// Dọn dẹp bộ nhớ WebGL để tránh lỗi "Too many active WebGL contexts" khi chuyển trang Barba
			if (this.geometry) this.geometry.remove();
			if (this.programs) this.programs.forEach(p => p.remove());
			if (this.textures) this.textures.forEach(t => t.destroy && t.destroy()); // OGL Texture cleanup
			if (this.renderer && this.renderer.gl) {
				const extension = this.renderer.gl.getExtension('WEBGL_lose_context');
				if (extension) extension.loseContext();
			}
			if (this.onResize) window.removeEventListener('resize', this.onResize);
			if (this.observer) this.observer.disconnect();
		}
	}
};
