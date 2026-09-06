import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// One WebGL context serves all thumbnails; only visible models are rendered.
const IDLE_ROTATION_SPEED = 0.24; // Radians per second.
const SCROLL_ROTATION_FACTOR = 0.0076; // Radians per pixel scrolled (1.9×).
const MAX_ROTATION_SPEED = 9.5;
const SUPERSAMPLE_FACTOR = 1.5;
const MAX_RENDER_SIZE = 2048;

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
			this.material = new T.MeshPhysicalMaterial({
				color: 0xd7ed58,
				metalness: 0.1,
				roughness: 0.26,
				clearcoat: 0.35,
				clearcoatRoughness: 0.2,
			});

			const canvases = [...this.root.querySelectorAll('.home-how-model')];
			for (let index = 0; index < canvases.length; index++) {
				const canvas = canvases[index];
				const context = canvas.getContext('2d');
				if (!context) continue;
				const model = new T.Group();
				const add = (geometry) => {
					const mesh = new T.Mesh(geometry, this.material);
					model.add(mesh);
					return mesh;
				};
				if (canvas.dataset.model === 'digital-design') {
					const gltf = await gltfLoader.loadAsync('/assets/3d/pillow-flower.glb');
					model.add(gltf.scene);
				} else switch (index % 3) {
					case 0:
						add(new T.TorusKnotGeometry(0.95, 0.32, 256, 64));
						break;
					case 1:
						for (let ring = 0; ring < 3; ring++) {
							const mesh = add(new T.TorusGeometry(1.15, 0.16, 48, 160));
							mesh.rotation.set(ring * Math.PI / 3, ring * Math.PI / 3, 0);
						}
						add(new T.IcosahedronGeometry(0.48, 1));
						break;
					default:
						add(new T.IcosahedronGeometry(1.15, 0));
						for (let orb = 0; orb < 6; orb++) {
							const angle = orb * Math.PI / 3;
							const mesh = add(new T.SphereGeometry(0.2, 48, 32));
							mesh.position.set(Math.cos(angle) * 1.55, Math.sin(angle) * 1.55, 0);
						}
				}
				model.visible = false;
				this.scene.add(model);
				this.items.push({ canvas, context, model, index, visible: false, width: 1, height: 1 });
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
		visible.forEach(({ canvas, context, model, index, width, height }) => {
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
			model.rotation.set(0.35, this.angle + index * 0.8, -0.2);
			model.visible = true;
			// Fabric needs softer fill than the glossy lime sculptures; the shared
			// high exposure was washing the yellow petals and cream center to white.
			const isFlower = canvas.dataset.model === 'digital-design';
			this.renderer.toneMappingExposure = isFlower ? 0.95 : 1.25;
			this.scene.environmentIntensity = isFlower ? 0.25 : 1;
			this.fillLight.intensity = isFlower ? 0.65 : 2.5;
			this.keyLight.intensity = isFlower ? 3 : 4;
			this.rimLight.intensity = isFlower ? 1 : 3;
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
		const resources = new Set([this.material]);
		this.items.forEach(({ canvas, model }) => {
			model.traverse((object) => {
				if (object.geometry) resources.add(object.geometry);
				const materials = Array.isArray(object.material) ? object.material : [object.material];
				materials.filter(Boolean).forEach((material) => {
					resources.add(material);
					if (material.map) resources.add(material.map);
				});
			});
			canvas.classList.remove('is-ready');
		});
		resources.forEach((resource) => resource?.dispose());
		this.environmentTarget?.dispose();
		this.renderer?.dispose();
		this.renderer?.forceContextLoss();
		this.items = [];
	}
}
