import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// One WebGL context serves all thumbnails; only visible models are rendered.
const DEFAULT_MODEL_URL = '/assets/3d/pillow-flower.glb';
const MODEL_SCALE = 1.44; // Tăng kích thước model 44% so với ban đầu trong khung canvas.
const IDLE_ROTATION_SPEED = 0.24; // Radians per second.
const SCROLL_ROTATION_FACTOR = 0.0076; // Radians per pixel scrolled (1.9×).
const MAX_ROTATION_SPEED = 9.5;
const SUPERSAMPLE_FACTOR = 1.5;
const MAX_RENDER_SIZE = 2048;
const MOBILE_FRAME_INTERVAL = 1000 / 30;
const DESKTOP_INTERACTION = '(min-width: 992px) and (hover: hover) and (pointer: fine)';
const DRAG_SENSITIVITY = 0.008; // Radians per pixel dragged.
const DRAG_MOMENTUM_DECAY = 0.88; // Velocity multiplier per frame (~60fps).
const DRAG_MOMENTUM_STOP = 0.0005; // Stop momentum below this velocity.

export class HowModels {
	constructor(root) {
		this.root = root;
		this.items = [];
		this.disposed = false;
		this.raf = null;
		this.angle = 0;
		this.rotationSpeed = IDLE_ROTATION_SPEED;
		this.lastScrollY = null;
		this.lastTime = null;
		this.lastRenderTime = null;
		this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.desktop = window.matchMedia(DESKTOP_INTERACTION);
		this.updateViewport = this.updateViewport.bind(this);
		this.schedule = this.schedule.bind(this);
		this.render = this.render.bind(this);
	}

	async init() {
		try {
			const [T, { RoomEnvironment }] = await Promise.all([
				import('three'),
				import('three/addons/environments/RoomEnvironment.js'),
			]);
			const gltfLoader = new GLTFLoader();
			if (this.disposed) return;
			this.renderer = new T.WebGLRenderer({
				alpha: true,
				antialias: true,
				powerPreference: 'high-performance',
			});
			this.renderer.setClearColor(0x000000, 0);
			this.renderer.toneMapping = T.ACESFilmicToneMapping;
			this.renderer.toneMappingExposure = 1.25;
			this.scene = new T.Scene();
			// Give glossy edges something bright to reflect at grazing angles.
			const environment = new RoomEnvironment();
			const pmrem = new T.PMREMGenerator(this.renderer);
			try {
				this.environmentTarget = pmrem.fromScene(environment, 0.04);
				this.scene.environment = this.environmentTarget.texture;
			} finally {
				environment.dispose();
				pmrem.dispose();
			}
			this.camera = new T.PerspectiveCamera(36, 1, 0.1, 30);
			this.camera.position.z = 7.5;
			this.fillLight = new T.HemisphereLight(0xffffff, 0x53632a, 2.5);
			this.scene.add(this.fillLight);
			const key = new T.DirectionalLight(0xfff7dd, 4);
			key.position.set(-3, 5, 5);
			const rim = new T.DirectionalLight(0xe6ffae, 3);
			rim.position.set(4, 1, -2);
			this.scene.add(key, rim);
			this.keyLight = key;
			this.rimLight = rim;
			// Static fabric lighting does not need to be assigned for every thumbnail/frame.
			this.renderer.toneMappingExposure = 0.95;
			this.scene.environmentIntensity = 0.25;
			this.fillLight.intensity = 0.65;
			this.keyLight.intensity = 3;
			this.rimLight.intensity = 1;

			const canvases = [...this.root.querySelectorAll('.home-how-model')];
			// Cache to avoid loading the same URL multiple times
			const gltfCache = new Map();
			const loadModel = (url) => {
				if (!gltfCache.has(url)) gltfCache.set(url, gltfLoader.loadAsync(url));
				return gltfCache.get(url);
			};
			for (let index = 0; index < canvases.length; index++) {
				const canvas = canvases[index];
				const context = canvas.getContext('2d');
				if (!context) continue;
				const model = new T.Group();

				let modelUrl = canvas.dataset.modelUrl?.trim() || DEFAULT_MODEL_URL;
				let gltf;
				try {
					gltf = await loadModel(modelUrl);
				} catch (error) {
					console.warn('[HowModels] Could not load model:', modelUrl, error);
					if (this.disposed) return;
					if (modelUrl === DEFAULT_MODEL_URL) continue;
					modelUrl = DEFAULT_MODEL_URL;
					try {
						gltf = await loadModel(modelUrl);
					} catch (fallbackError) {
						console.warn('[HowModels] Default model unavailable:', fallbackError);
						continue;
					}
				}
				if (this.disposed) return;
				const content = gltf.scene.clone();
				model.add(content);
				if (modelUrl !== DEFAULT_MODEL_URL) {
					// Center uploaded models and fit different export units into the preview.
					const bounds = new T.Box3().setFromObject(content);
					const size = bounds.getSize(new T.Vector3()).length();
					if (Number.isFinite(size) && size > 0) {
						content.position.sub(bounds.getCenter(new T.Vector3()));
						model.scale.setScalar(3.5 / size);
					}
				}
				model.scale.multiplyScalar(MODEL_SCALE);
				model.visible = false;
				this.scene.add(model);
				const item = {
					canvas,
					context,
					model,
					index,
					visible: false,
					ready: false,
					width: 1,
					height: 1,
					// Per-item drag state
					dragOffsetX: 0,
					dragOffsetY: 0,
					dragVelX: 0,
					dragVelY: 0,
					pointerActive: false,
					lastPointerX: 0,
					lastPointerY: 0,
				};
				this.items.push(item);
			}

			// Compile materials before the first visible scroll frame. The async path
			// uses parallel shader compilation where the GPU supports it.
			this.items.forEach(({ model }) => {
				model.visible = true;
			});
			await this.renderer.compileAsync(this.scene, this.camera);
			if (this.disposed) return;
			this.items.forEach(({ model }) => {
				model.visible = false;
			});
			// A single visible WebGL surface avoids copying GPU frames into 2D canvases.
			this.surface = document.createElement('div');
			this.surface.className = 'home-how-model-surface';
			this.surface.setAttribute('aria-hidden', 'true');
			this.surface.appendChild(this.renderer.domElement);
			this.root.querySelector('.home-how-thumb').prepend(this.surface);
			this.onScroll = () => {
				if (this.direct && this.items.some((item) => item.visible)) this.schedule();
			};
			window.addEventListener('scroll', this.onScroll, { passive: true });
			this.resizeObserver = new ResizeObserver(this.updateViewport);
			this.resizeObserver.observe(this.surface);
			this.observer = new IntersectionObserver((entries) => {
				entries.forEach((entry) => {
					const item = this.items.find((item) => item.canvas === entry.target);
					if (item) item.visible = entry.isIntersecting;
				});
				this.schedule();
			});
			this.items.forEach(({ canvas }) => {
				this.resizeObserver.observe(canvas);
				this.observer.observe(canvas);
			});
			this.motion.addEventListener('change', this.schedule);
			this.desktop.addEventListener('change', this.updateViewport);
			document.addEventListener('visibilitychange', this.schedule);
			this.updateViewport();
		} catch (error) {
			console.warn('[HowModels] 3D preview unavailable:', error);
			this.destroy();
		}
	}

	updateViewport() {
		if (this.disposed) return;
		const desktop = this.desktop.matches;
		const dpr = Math.min(window.devicePixelRatio || 1, desktop ? 2 : 1.25);
		this.direct = window.innerWidth <= 991;
		this.items.forEach((item) => {
			item.width = Math.max(1, Math.round(item.canvas.clientWidth * dpr));
			item.height = Math.max(1, Math.round(item.canvas.clientHeight * dpr));
			if (desktop && !item._cleanupDrag) this._attachDragListeners(item);
			if (!desktop) item._cleanupDrag?.();
		});
		if (this.surface) {
			this.surface.hidden = !this.direct;
			this.renderer.autoClear = !this.direct;
			this.renderer.setScissorTest(false);
			if (this.direct) {
				this.surfaceDpr = dpr;
				// Models are vertically centered and never scale above 1. Keep the
				// same pixel density, but allocate only the band they can occupy.
				const height = Math.min(this.surface.clientHeight,
					Math.max(1, ...this.items.map((item) => item.canvas.clientHeight)));
				this.renderer.domElement.style.height = `${height}px`;
				const widthPx = Math.max(1, Math.round(this.surface.clientWidth * dpr));
				const heightPx = Math.max(1, Math.round(height * dpr));
				if (this.renderer.domElement.width !== widthPx || this.renderer.domElement.height !== heightPx) {
					this.renderer.setSize(widthPx, heightPx, false);
				}
			}
		}
		this.schedule();
	}

	_attachDragListeners(item) {
		const { canvas } = item;
		canvas.dataset.cursor = 'drag';
		const onPointerDown = (e) => {
			if (!this.desktop.matches || e.pointerType !== 'mouse' || e.button !== 0) return;
			e.preventDefault();
			item.pointerId = e.pointerId;
			item.pointerActive = true;
			item.lastPointerX = e.clientX;
			item.lastPointerY = e.clientY;
			item.dragVelX = 0;
			item.dragVelY = 0;
			canvas.classList.add('is-dragging');
			canvas.setPointerCapture(e.pointerId);
		};
		const onPointerMove = (e) => {
			if (!item.pointerActive) return;
			const dx = e.clientX - item.lastPointerX;
			const dy = e.clientY - item.lastPointerY;
			item.dragOffsetX += dx * DRAG_SENSITIVITY;
			item.dragOffsetY += dy * DRAG_SENSITIVITY;
			item.dragVelX = dx * DRAG_SENSITIVITY;
			item.dragVelY = dy * DRAG_SENSITIVITY;
			item.lastPointerX = e.clientX;
			item.lastPointerY = e.clientY;
			this.schedule();
		};
		const onPointerUp = () => {
			item.pointerActive = false;
			if (item.pointerId != null && canvas.hasPointerCapture(item.pointerId))
				canvas.releasePointerCapture(item.pointerId);
			item.pointerId = null;
			canvas.classList.remove('is-dragging');
		};
		canvas.addEventListener('pointerdown', onPointerDown);
		canvas.addEventListener('pointermove', onPointerMove);
		canvas.addEventListener('pointerup', onPointerUp);
		canvas.addEventListener('pointercancel', onPointerUp);
		canvas.addEventListener('lostpointercapture', onPointerUp);
		// Store cleanup refs
		item._cleanupDrag = () => {
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerUp);
			canvas.removeEventListener('lostpointercapture', onPointerUp);
			onPointerUp();
			item.dragVelX = 0;
			item.dragVelY = 0;
			delete canvas.dataset.cursor;
			item._cleanupDrag = null;
		};
	}

	schedule() {
		if (this.disposed || document.hidden || !this.items.some((item) => item.visible)) {
			if (this.direct && this.surfaceHasContent && !this.disposed && !document.hidden) {
				this.renderer.setScissorTest(false);
				this.renderer.clear();
				this.surfaceHasContent = false;
			}
			if (this.raf !== null) cancelAnimationFrame(this.raf);
			this.raf = null;
			this.lastTime = null;
			this.lastScrollY = null;
			this.lastRenderTime = null;
			return;
		}
		if (this.raf !== null) return;
		this.raf = requestAnimationFrame(this.render);
	}

	render(now) {
		this.raf = null;
		if (this.disposed || document.hidden) {
			this.lastTime = null;
			this.lastScrollY = null;
			this.lastRenderTime = null;
			return;
		}
		if (
			!this.direct && !this.desktop.matches &&
			this.lastRenderTime !== null &&
			now - this.lastRenderTime < MOBILE_FRAME_INTERVAL
		) {
			this.schedule();
			return;
		}
		// Preserve the fractional interval instead of drifting with RAF jitter.
		this.lastRenderTime = !this.desktop.matches && this.lastRenderTime !== null
			? now - ((now - this.lastRenderTime) % MOBILE_FRAME_INTERVAL)
			: now;
		// Adjacent models must keep moving throughout the horizontal transition.
		let visible = this.items.filter((item) => item.visible);
		let surfaceRect;
		if (this.direct) {
			surfaceRect = this.renderer.domElement.getBoundingClientRect();
			// Read candidate rectangles before rendering/writing; includes incoming models.
			visible = visible.filter((item) => {
				item.rect = item.canvas.getBoundingClientRect();
				return item.rect.width > 0 && item.rect.height > 0 &&
					item.rect.right > surfaceRect.left && item.rect.left < surfaceRect.right &&
					item.rect.bottom > Math.max(0, surfaceRect.top) &&
					item.rect.top < Math.min(window.innerHeight, surfaceRect.bottom);
			});
			this.renderer.setScissorTest(false);
			this.renderer.clear();
			this.surfaceHasContent = visible.length > 0;
			this.renderer.setScissorTest(true);
		}
		if (!visible.length) {
			this.lastTime = null;
			this.lastScrollY = null;
			this.lastRenderTime = null;
			return;
		}
		if (!this.motion.matches && this.lastTime !== null) {
			const elapsed = Math.max((now - this.lastTime) / 1000, 0.001);
			const deltaTime = Math.min(elapsed, 0.05);
			// Measure actual scrolling so wheel, touch and keyboard behave alike.
			const scrollDelta = window.scrollY - (this.lastScrollY ?? window.scrollY);
			const scrollSpeed = scrollDelta / elapsed;
			const targetSpeed =
				scrollDelta !== 0
					? Math.sign(scrollDelta) *
						Math.min(
							MAX_ROTATION_SPEED,
							IDLE_ROTATION_SPEED + Math.abs(scrollSpeed) * SCROLL_ROTATION_FACTOR,
						)
					: IDLE_ROTATION_SPEED;
			// Follow direction changes immediately, then ease back to idle on release.
			if (scrollDelta !== 0 && this.rotationSpeed * targetSpeed < 0) this.rotationSpeed = 0;
			this.rotationSpeed += (targetSpeed - this.rotationSpeed) * (1 - Math.exp(-10 * deltaTime));
			this.angle += this.rotationSpeed * deltaTime;
		} else {
			this.rotationSpeed = IDLE_ROTATION_SPEED;
		}
		this.lastTime = now;
		this.lastScrollY = window.scrollY;
		visible.forEach((item) => {
			const { canvas, context, model, index, width, height } = item;
			if (!this.direct && (canvas.width !== width || canvas.height !== height)) {
				canvas.width = width;
				canvas.height = height;
			}
			// Render above the output resolution, then filter down to soften silhouettes.
			const sampleScale = Math.min(
				this.desktop.matches ? SUPERSAMPLE_FACTOR : 1,
				(this.desktop.matches ? MAX_RENDER_SIZE : 1536) / Math.max(width, height),
			);
			const renderWidth = Math.max(1, Math.round(width * sampleScale));
			const renderHeight = Math.max(1, Math.round(height * sampleScale));
			if (!this.direct && (
				this.renderer.domElement.width !== renderWidth ||
				this.renderer.domElement.height !== renderHeight
			)) {
				this.renderer.setSize(renderWidth, renderHeight, false);
			}
			if (this.camera.aspect !== width / height) {
				this.camera.aspect = width / height;
				// Keep the entire model in frame even in short, wide viewports.
				this.camera.position.z = 7.5 / Math.min(1, this.camera.aspect);
				this.camera.updateProjectionMatrix();
			}
			// Apply momentum decay when not dragging
			if (!item.pointerActive) {
				item.dragVelX *= DRAG_MOMENTUM_DECAY;
				item.dragVelY *= DRAG_MOMENTUM_DECAY;
				if (
					Math.abs(item.dragVelX) > DRAG_MOMENTUM_STOP ||
					Math.abs(item.dragVelY) > DRAG_MOMENTUM_STOP
				) {
					item.dragOffsetX += item.dragVelX;
					item.dragOffsetY += item.dragVelY;
				} else {
					item.dragVelX = 0;
					item.dragVelY = 0;
				}
			}
			// Clamp vertical drag to avoid flipping upside down
			item.dragOffsetY = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, item.dragOffsetY));
			model.rotation.set(
				0.35 + item.dragOffsetY,
				this.angle + index * 0.8 + item.dragOffsetX,
				-0.2,
			);
			model.visible = true;
			if (this.direct) {
				const { rect } = item;
				const dpr = this.surfaceDpr;
				const x = (rect.left - surfaceRect.left) * dpr;
				const y = (surfaceRect.bottom - rect.bottom) * dpr;
				this.renderer.setViewport(x, y, rect.width * dpr, rect.height * dpr);
				this.renderer.setScissor(x, y, rect.width * dpr, rect.height * dpr);
				this.renderer.clearDepth();
			}
			this.renderer.render(this.scene, this.camera);
			if (!this.direct) {
				context.clearRect(0, 0, width, height);
				context.imageSmoothingEnabled = true;
				context.imageSmoothingQuality = 'high';
				context.drawImage(this.renderer.domElement, 0, 0, width, height);
			}
			model.visible = false;
			if (!item.ready) {
				item.ready = true;
				canvas.classList.add('is-ready');
			}
		});
		if (!this.motion.matches) this.schedule();
	}

	destroy() {
		this.disposed = true;
		if (this.raf !== null) cancelAnimationFrame(this.raf);
		this.raf = null;
		this.observer?.disconnect();
		this.resizeObserver?.disconnect();
		window.removeEventListener('scroll', this.onScroll);
		this.surface?.remove();
		this.motion.removeEventListener('change', this.schedule);
		this.desktop.removeEventListener('change', this.updateViewport);
		document.removeEventListener('visibilitychange', this.schedule);
		const resources = new Set();
		this.items.forEach((item) => {
			item._cleanupDrag?.();
			item.model.traverse((object) => {
				if (object.geometry) resources.add(object.geometry);
				const materials = Array.isArray(object.material) ? object.material : [object.material];
				materials.filter(Boolean).forEach((material) => {
					resources.add(material);
					Object.values(material).forEach((value) => {
						if (value?.isTexture) resources.add(value);
					});
				});
			});
			item.canvas.classList.remove('is-ready');
		});
		resources.forEach((resource) => resource?.dispose());
		this.environmentTarget?.dispose();
		this.renderer?.dispose();
		this.renderer?.forceContextLoss();
		this.items = [];
	}
}
