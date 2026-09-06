import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// One WebGL context serves all thumbnails; only visible models are rendered.
const IDLE_ROTATION_SPEED = 0.24; // Radians per second.
const SCROLL_ROTATION_FACTOR = 0.0076; // Radians per pixel scrolled (1.9×).
const MAX_ROTATION_SPEED = 9.5;
const SUPERSAMPLE_FACTOR = 1.5;
const MAX_RENDER_SIZE = 2048;
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
		this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
			this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
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

			const canvases = [...this.root.querySelectorAll('.home-how-model')];
			// Cache to avoid loading the same URL multiple times
			const gltfCache = {};
			for (let index = 0; index < canvases.length; index++) {
				const canvas = canvases[index];
				const context = canvas.getContext('2d');
				if (!context) continue;
				const model = new T.Group();
				
				// Map each section to its respective 3D model file.
				// Change the URLs for 'development' and 'branding' when you have new models!
				let modelUrl = null;
				switch (canvas.dataset.model) {
					case 'digital-design':
						modelUrl = '/assets/3d/pillow-flower.glb';
						break;
					case 'development':
						modelUrl = '/assets/3d/pillow-flower.glb'; // TODO: replace later
						break;
					case 'branding':
						modelUrl = '/assets/3d/pillow-flower.glb'; // TODO: replace later
						break;
				}

				if (modelUrl) {
					if (!gltfCache[modelUrl]) {
						gltfCache[modelUrl] = await gltfLoader.loadAsync(modelUrl);
					}
					model.add(gltfCache[modelUrl].scene.clone());
				}
				model.visible = false;
				this.scene.add(model);
				const item = { canvas, context, model, index, visible: false, width: 1, height: 1,
					// Per-item drag state
					dragOffsetX: 0, dragOffsetY: 0,
					dragVelX: 0, dragVelY: 0,
					pointerActive: false, lastPointerX: 0, lastPointerY: 0,
				};
				this.items.push(item);
				this._attachDragListeners(item);
			}

			this.resizeObserver = new ResizeObserver(() => {
				const dpr = Math.min(window.devicePixelRatio || 1, 2);
				this.items.forEach((item) => {
					item.width = Math.max(1, Math.round(item.canvas.clientWidth * dpr));
					item.height = Math.max(1, Math.round(item.canvas.clientHeight * dpr));
				});
				this.schedule();
			});
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
			document.addEventListener('visibilitychange', this.schedule);
		} catch (error) {
			console.warn('[HowModels] 3D preview unavailable:', error);
			this.destroy();
		}
	}

	_attachDragListeners(item) {
		const { canvas } = item;
		canvas.dataset.cursor = 'drag';
		const onPointerDown = (e) => {
			e.preventDefault();
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
			canvas.classList.remove('is-dragging');
		};
		canvas.addEventListener('pointerdown', onPointerDown);
		canvas.addEventListener('pointermove', onPointerMove);
		canvas.addEventListener('pointerup', onPointerUp);
		canvas.addEventListener('pointercancel', onPointerUp);
		// Store cleanup refs
		item._cleanupDrag = () => {
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerUp);
		};
	}

	schedule() {
		if (this.disposed || this.raf !== null || document.hidden) return;
		this.raf = requestAnimationFrame(this.render);
	}

	render(now) {
		this.raf = null;
		if (this.disposed || document.hidden) {
			this.lastTime = null;
			this.lastScrollY = null;
			return;
		}
		const visible = this.items.filter((item) => item.visible);
		if (!visible.length) {
			this.lastTime = null;
			this.lastScrollY = null;
			return;
		}
		if (!this.motion.matches && this.lastTime !== null) {
			const elapsed = Math.max((now - this.lastTime) / 1000, 0.001);
			const deltaTime = Math.min(elapsed, 0.05);
			// Measure actual scrolling so wheel, touch and keyboard behave alike.
			const scrollDelta = window.scrollY - (this.lastScrollY ?? window.scrollY);
			const scrollSpeed = scrollDelta / elapsed;
			const targetSpeed = scrollDelta !== 0
				? Math.sign(scrollDelta) * Math.min(
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
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}
			// Render above the output resolution, then filter down to soften silhouettes.
			const sampleScale = Math.min(SUPERSAMPLE_FACTOR, MAX_RENDER_SIZE / Math.max(width, height));
			const renderWidth = Math.max(1, Math.round(width * sampleScale));
			const renderHeight = Math.max(1, Math.round(height * sampleScale));
			if (this.renderer.domElement.width !== renderWidth || this.renderer.domElement.height !== renderHeight) {
				this.renderer.setSize(renderWidth, renderHeight, false);
			}
			this.camera.aspect = width / height;
			// Keep the entire model in frame even in short, wide viewports.
			this.camera.position.z = 7.5 / Math.min(1, this.camera.aspect);
			this.camera.updateProjectionMatrix();
			// Apply momentum decay when not dragging
			if (!item.pointerActive) {
				item.dragVelX *= DRAG_MOMENTUM_DECAY;
				item.dragVelY *= DRAG_MOMENTUM_DECAY;
				if (Math.abs(item.dragVelX) > DRAG_MOMENTUM_STOP || Math.abs(item.dragVelY) > DRAG_MOMENTUM_STOP) {
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
			// Fabric lighting setup
			this.renderer.toneMappingExposure = 0.95;
			this.scene.environmentIntensity = 0.25;
			this.fillLight.intensity = 0.65;
			this.keyLight.intensity = 3;
			this.rimLight.intensity = 1;
			this.renderer.render(this.scene, this.camera);
			context.clearRect(0, 0, width, height);
			context.imageSmoothingEnabled = true;
			context.imageSmoothingQuality = 'high';
			context.drawImage(this.renderer.domElement, 0, 0, width, height);
			model.visible = false;
			canvas.classList.add('is-ready');
		});
		if (!this.motion.matches) this.schedule();
	}

	destroy() {
		this.disposed = true;
		if (this.raf !== null) cancelAnimationFrame(this.raf);
		this.raf = null;
		this.observer?.disconnect();
		this.resizeObserver?.disconnect();
		this.motion.removeEventListener('change', this.schedule);
		document.removeEventListener('visibilitychange', this.schedule);
		const resources = new Set();
		this.items.forEach((item) => {
			item._cleanupDrag?.();
			item.model.traverse((object) => {
				if (object.geometry) resources.add(object.geometry);
				const materials = Array.isArray(object.material) ? object.material : [object.material];
				materials.filter(Boolean).forEach((material) => {
					resources.add(material);
					if (material.map) resources.add(material.map);
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
