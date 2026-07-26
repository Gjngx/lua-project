import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';

const VERTEX_SHADER = /* glsl */ `
	attribute vec3 position;
	attribute vec2 uv;

	uniform mat4 modelViewMatrix;
	uniform mat4 projectionMatrix;

	varying vec2 vUv;

	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const FRAGMENT_SHADER = /* glsl */ `
	precision highp float;

	uniform sampler2D tMap;
	varying vec2 vUv;

	float roundedBox(vec2 point, vec2 halfSize, float radius) {
		vec2 distance = abs(point) - halfSize + radius;
		return length(max(distance, 0.0)) + min(max(distance.x, distance.y), 0.0) - radius;
	}

	void main() {
		float edge = roundedBox(vUv - 0.5, vec2(0.5), 0.055);
		float cardAlpha = 1.0 - smoothstep(-0.006, 0.006, edge);

		if (cardAlpha < 0.01) discard;

		vec4 image = texture2D(tMap, vUv);
		gl_FragColor = vec4(image.rgb, image.a * cardAlpha);
	}
`;

const CARD_LAYOUT = [
	{ x: -0.76, y: 0.76, scale: 0.92, depth: 1 },
	{ x: -0.69, y: 0.56, scale: 1.12, depth: 1 },
	{ x: -0.57, y: 0.35, scale: 0.82, depth: -1 },
	{ x: -0.25, y: 0.7, scale: 0.62, depth: -1 },
	{ x: 0.45, y: 0.76, scale: 0.95, depth: -1 },
	{ x: 0.78, y: 0.42, scale: 0.5, depth: 1 },
	{ x: -0.77, y: 0.02, scale: 0.66, depth: 1 },
	{ x: -0.42, y: 0.12, scale: 0.5, depth: -1 },
	{ x: -0.17, y: 0.34, scale: 0.78, depth: 1 },
	{ x: 0.39, y: 0.27, scale: 0.7, depth: 1 },
	{ x: 0.8, y: -0.43, scale: 1.14, depth: -1 },
	{ x: -0.66, y: -0.53, scale: 0.8, depth: -1 },
	{ x: -0.34, y: -0.12, scale: 0.48, depth: 1 },
	{ x: 0.28, y: -0.62, scale: 0.76, depth: 1 },
];
const CARD_SPHERE_RADIUS = 4.15;
const CAMERA_FIT_RADIUS = 4.35;
const CARD_SCALE_MULTIPLIER = 1.58;
const IDLE_ROTATION_SPEED = 0.00016;

export class SphericalImageCanvas {
	constructor({ canvas, root, imageUrls, layer = 'all' }) {
		this.canvas = canvas;
		this.root = root;
		this.imageUrls = imageUrls;
		this.layer = layer;
		this.renderer = null;
		this.gl = null;
		this.camera = null;
		this.scene = null;
		this.geometry = null;
		this.meshes = [];
		this.programs = [];
		this.textures = [];
		this.images = [];
		this.assets = new Map();
		this.frameId = null;
		this.lastFrameTime = 0;
		this.isVisible = false;
		this.isDestroyed = false;
		this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		this.targetVelocity = { x: 0.00003, y: 0.00014 };
		this.velocity = { x: 0, y: 0 };
		this.rotation = { x: 0, y: 0 };
		this.floatTime = 0;
		this.isDragging = false;
		this.dragPointerId = null;
		this.lastPointer = { x: 0, y: 0 };
		this.horizontalSpread = 1;
		this.revealProgress = this.isReducedMotion ? 1 : 0;
		this.revealDuration = 1150;
		this.revealOrigin = { x: 0, y: 0, z: -0.12 };
		this.resizeObserver = null;
		this.visibilityObserver = null;

		this.onPointerDown = this.onPointerDown.bind(this);
		this.onPointerMove = this.onPointerMove.bind(this);
		this.onPointerUp = this.onPointerUp.bind(this);
		this.onResize = this.onResize.bind(this);
		this.onVisibilityChange = this.onVisibilityChange.bind(this);
		this.onContextLost = this.onContextLost.bind(this);
		this.render = this.render.bind(this);
	}

	init() {
		this.renderer = new Renderer({
			canvas: this.canvas,
			alpha: true,
			antialias: true,
			dpr: Math.min(window.devicePixelRatio || 1, 2),
			powerPreference: 'high-performance',
		});
		this.gl = this.renderer.gl;
		this.gl.clearColor(0, 0, 0, 0);

		this.camera = new Camera(this.gl, {
			fov: 36,
			near: 0.1,
			far: 100,
		});
		this.camera.lookAt([0, 0, 0]);

		this.scene = new Transform();
		this.geometry = new Plane(this.gl);
		this.createCards();
		this.updateCardTransforms();
		this.bindEvents();
		this.onResize();
		this.renderer.render({ scene: this.scene, camera: this.camera });
	}

	createCards() {
		const cardCount = CARD_LAYOUT.length;

		for (let index = 0; index < cardCount; index += 1) {
			const url = this.imageUrls[index % this.imageUrls.length];
			const isLandscape = url.includes('item-');
			const layout = CARD_LAYOUT[index];
			const { program } = this.getCardAsset(url);
			const mesh = new Mesh(this.gl, {
				geometry: this.geometry,
				program,
			});

			const layoutRadius = Math.hypot(layout.x, layout.y);
			const layoutScale = layoutRadius > 0.94 ? 0.94 / layoutRadius : 1;
			const x = layout.x * layoutScale;
			const y = layout.y * layoutScale;
			const z = Math.sqrt(Math.max(0, 1 - x * x - y * y)) * layout.depth;

			mesh.spherePosition = {
				x: x * CARD_SPHERE_RADIUS,
				y: y * CARD_SPHERE_RADIUS,
				z: z * CARD_SPHERE_RADIUS,
			};
			mesh.cardScale = {
				x: (isLandscape ? 1.65 : 1.28) * layout.scale * CARD_SCALE_MULTIPLIER,
				y: (isLandscape ? 1.05 : 1.12) * layout.scale * CARD_SCALE_MULTIPLIER,
			};
			mesh.revealDelay = (((index * 5) % cardCount) / cardCount) * 0.13;
			mesh.burstCurve = ((((index * 4) % 9) - 4) / 4) * 0.5;
			mesh.floatPhase = index * 0.73;
			mesh.floatSpeed = 0.7 + (index % 5) * 0.08;
			mesh.setParent(this.scene);

			this.meshes.push(mesh);
		}
	}

	updateCardTransforms() {
		const cosineX = Math.cos(this.rotation.x);
		const sineX = Math.sin(this.rotation.x);
		const cosineY = Math.cos(this.rotation.y);
		const sineY = Math.sin(this.rotation.y);

		this.meshes.forEach((mesh) => {
			const { x, y, z } = mesh.spherePosition;
			const revealProgress = Math.min(
				1,
				Math.max(0, (this.revealProgress - mesh.revealDelay) / (1 - mesh.revealDelay)),
			);
			const revealEase = this.easeOutBack(revealProgress);
			const scaleEase = 1 - Math.pow(1 - revealProgress, 3);
			const rotatedX = x * cosineY + z * sineY;
			const rotatedZ = -x * sineY + z * cosineY;
			const rotatedY = y * cosineX - rotatedZ * sineX;
			const finalZ = y * sineX + rotatedZ * cosineX;
			const displayX = rotatedX * this.horizontalSpread;
			const clusterX = this.revealOrigin.x + displayX * 0.035;
			const clusterY = this.revealOrigin.y + rotatedY * 0.035;
			const clusterZ = this.revealOrigin.z + finalZ * 0.02;
			const directionX = displayX - clusterX;
			const directionY = rotatedY - clusterY;
			const directionLength = Math.max(0.001, Math.hypot(directionX, directionY));
			const curveProgress = Math.sin(Math.PI * revealProgress);
			const curveX = (-directionY / directionLength) * mesh.burstCurve * curveProgress;
			const curveY = (directionX / directionLength) * mesh.burstCurve * curveProgress;
			const floatWave = this.floatTime * mesh.floatSpeed + mesh.floatPhase;
			const floatX = Math.cos(floatWave * 0.72) * 0.025;
			const floatY = Math.sin(floatWave) * 0.045;
			const floatZ = Math.sin(floatWave * 0.58) * 0.02;

			mesh.position.set(
				clusterX + directionX * revealEase + curveX + floatX,
				clusterY + directionY * revealEase + curveY + floatY,
				clusterZ + (finalZ - clusterZ) * revealEase + floatZ,
			);
			mesh.visible =
				this.layer === 'front'
					? mesh.position.z >= 0
					: this.layer === 'back'
						? mesh.position.z < 0
						: true;
			mesh.scale.set(
				mesh.cardScale.x * (0.08 + scaleEase * 0.92),
				mesh.cardScale.y * (0.08 + scaleEase * 0.92),
				1,
			);
		});
	}

	easeOutBack(progress) {
		const back = 1.18;
		const shifted = progress - 1;
		return 1 + (back + 1) * shifted * shifted * shifted + back * shifted * shifted;
	}

	getCardAsset(url) {
		const cachedAsset = this.assets.get(url);
		if (cachedAsset) return cachedAsset;

		const texture = new Texture(this.gl, {
			generateMipmaps: false,
			minFilter: this.gl.LINEAR,
			magFilter: this.gl.LINEAR,
		});
		const program = new Program(this.gl, {
			vertex: VERTEX_SHADER,
			fragment: FRAGMENT_SHADER,
			uniforms: {
				tMap: { value: texture },
			},
			transparent: true,
			depthTest: true,
			depthWrite: true,
			cullFace: this.gl.BACK,
		});
		const image = new Image();

		image.decoding = 'async';
		image.onload = () => {
			if (this.isDestroyed) return;
			texture.image = image;
			texture.needsUpdate = true;
			if (this.isReducedMotion || !this.isVisible) {
				this.renderer?.render({ scene: this.scene, camera: this.camera });
			}
		};
		image.src = url;

		const asset = { texture, program, image };
		this.assets.set(url, asset);
		this.images.push(image);
		this.textures.push(texture);
		this.programs.push(program);
		return asset;
	}

	bindEvents() {
		if (!this.isReducedMotion) {
			this.root.addEventListener('pointerdown', this.onPointerDown);
			this.root.addEventListener('pointermove', this.onPointerMove);
			window.addEventListener('pointerup', this.onPointerUp);
			window.addEventListener('pointercancel', this.onPointerUp);
		}

		this.canvas.addEventListener('webglcontextlost', this.onContextLost);
		document.addEventListener('visibilitychange', this.onVisibilityChange);

		this.resizeObserver = new ResizeObserver(this.onResize);
		this.resizeObserver.observe(this.root);

		this.visibilityObserver = new IntersectionObserver(
			(entries) => {
				this.isVisible = entries[0]?.isIntersecting ?? false;
				if (this.isVisible) {
					if (this.isReducedMotion) {
						this.renderer?.render({ scene: this.scene, camera: this.camera });
					} else {
						this.start();
					}
				} else {
					this.stop();
				}
			},
			{ threshold: 0.4 },
		);
		this.visibilityObserver.observe(this.root);
	}

	onPointerDown(event) {
		if (event.button !== 0 || event.target.closest('a, button, input, textarea, select')) return;

		event.preventDefault();
		this.isDragging = true;
		this.dragPointerId = event.pointerId;
		this.lastPointer.x = event.clientX;
		this.lastPointer.y = event.clientY;
		this.targetVelocity.x = 0;
		this.targetVelocity.y = 0;
		this.root.setPointerCapture?.(event.pointerId);
		this.root.classList.add('is-dragging');
	}

	onPointerMove(event) {
		if (!this.isDragging || event.pointerId !== this.dragPointerId) return;

		event.preventDefault();
		const deltaX = event.clientX - this.lastPointer.x;
		const deltaY = event.clientY - this.lastPointer.y;
		this.lastPointer.x = event.clientX;
		this.lastPointer.y = event.clientY;

		this.rotation.x -= deltaY * 0.0028;
		this.rotation.y += deltaX * 0.0035;
		this.velocity.x = -deltaY * 0.0007;
		this.velocity.y = deltaX * 0.0009;
		this.targetVelocity.x = 0;
		this.targetVelocity.y = 0;
		this.updateCardTransforms();
	}

	onPointerUp(event) {
		if (!this.isDragging || event.pointerId !== this.dragPointerId) return;

		this.root.releasePointerCapture?.(event.pointerId);
		this.isDragging = false;
		this.dragPointerId = null;
		const releaseSpeed = Math.hypot(this.velocity.x, this.velocity.y);
		if (releaseSpeed > 0.00001) {
			this.targetVelocity.x = (this.velocity.x / releaseSpeed) * IDLE_ROTATION_SPEED;
			this.targetVelocity.y = (this.velocity.y / releaseSpeed) * IDLE_ROTATION_SPEED;
		} else {
			this.targetVelocity.x = 0.00003;
			this.targetVelocity.y = 0.00014;
		}
		this.root.classList.remove('is-dragging');
	}

	onResize() {
		if (!this.renderer || !this.camera) return;

		const width = Math.max(1, this.root.clientWidth);
		const height = Math.max(1, this.root.clientHeight);
		const aspect = width / height;
		const overscan = Math.min(width, height) * 0.18;
		const renderWidth = width + overscan * 2;
		const renderHeight = height + overscan * 2;
		const renderAspect = renderWidth / renderHeight;
		const fitAxis = Math.min(1, aspect);
		this.horizontalSpread = Math.min(1.65, Math.max(1, aspect / 1.1));
		const halfFov = (this.camera.fov * Math.PI) / 360;
		const baseCameraDistance =
			(CAMERA_FIT_RADIUS * 1.2) / (Math.tan(halfFov) * fitAxis) + 1.4;
		const cameraDistance = baseCameraDistance * (renderHeight / height);

		this.renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.renderer.setSize(renderWidth, renderHeight);
		this.canvas.style.left = `${-overscan}px`;
		this.canvas.style.top = `${-overscan}px`;
		this.canvas.style.right = 'auto';
		this.canvas.style.bottom = 'auto';
		this.camera.position.set(0, 0, cameraDistance);
		this.camera.perspective({ aspect: renderAspect });
		this.camera.lookAt([0, 0, 0]);
		this.updateRevealOrigin(
			renderWidth,
			renderHeight,
			cameraDistance,
			halfFov,
			renderAspect,
			overscan,
		);
		this.updateCardTransforms();
		this.renderer.render({ scene: this.scene, camera: this.camera });
	}

	updateRevealOrigin(width, height, cameraDistance, halfFov, aspect, overscan = 0) {
		const content = this.root.querySelector('.home-playground-main-content');
		if (!content) return;

		const rootBounds = this.root.getBoundingClientRect();
		const contentBounds = content.getBoundingClientRect();
		const contentCenterX =
			contentBounds.left + contentBounds.width / 2 - rootBounds.left + overscan;
		const contentCenterY =
			contentBounds.top + contentBounds.height / 2 - rootBounds.top + overscan;
		const visibleHeight = 2 * cameraDistance * Math.tan(halfFov);
		const visibleWidth = visibleHeight * aspect;

		this.revealOrigin.x = (contentCenterX / width - 0.5) * visibleWidth;
		this.revealOrigin.y = (0.5 - contentCenterY / height) * visibleHeight;
	}

	onVisibilityChange() {
		if (document.hidden) {
			this.stop();
		} else if (this.isVisible && !this.isReducedMotion) {
			this.start();
		}
	}

	onContextLost(event) {
		event.preventDefault();
		this.stop();
		this.root.classList.add('is-static');
	}

	start() {
		if (this.frameId !== null || this.isDestroyed || document.hidden) return;
		this.lastFrameTime = performance.now();
		this.frameId = window.requestAnimationFrame(this.render);
	}

	stop() {
		if (this.frameId === null) return;
		window.cancelAnimationFrame(this.frameId);
		this.frameId = null;
	}

	render(time) {
		if (this.isDestroyed || !this.renderer) return;

		const elapsed = Math.min(32, time - this.lastFrameTime);
		const delta = elapsed / (1000 / 60);
		this.lastFrameTime = time;
		const velocityDamping = this.isDragging ? 0.92 : 0.97;
		const smoothing = 1 - Math.pow(velocityDamping, delta);

		if (this.revealProgress < 1) {
			this.revealProgress = Math.min(1, this.revealProgress + elapsed / this.revealDuration);
		}
		this.floatTime += elapsed / 1000;
		this.velocity.x += (this.targetVelocity.x - this.velocity.x) * smoothing;
		this.velocity.y += (this.targetVelocity.y - this.velocity.y) * smoothing;
		this.rotation.x += this.velocity.x * delta;
		this.rotation.y += this.velocity.y * delta;
		this.updateCardTransforms();

		this.renderer.render({ scene: this.scene, camera: this.camera });
		this.frameId = window.requestAnimationFrame(this.render);
	}

	destroy() {
		this.isDestroyed = true;
		this.stop();
		this.resizeObserver?.disconnect();
		this.visibilityObserver?.disconnect();
		this.root.removeEventListener('pointerdown', this.onPointerDown);
		this.root.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('pointerup', this.onPointerUp);
		window.removeEventListener('pointercancel', this.onPointerUp);
		this.root.classList.remove('is-dragging');
		this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
		document.removeEventListener('visibilitychange', this.onVisibilityChange);

		this.images.forEach((image) => {
			image.onload = null;
			image.src = '';
		});
		this.textures.forEach((texture) => this.gl?.deleteTexture(texture.texture));
		this.programs.forEach((program) => program.remove());
		this.geometry?.remove();
		this.meshes.forEach((mesh) => mesh.setParent(null));

		this.meshes = [];
		this.programs = [];
		this.textures = [];
		this.images = [];
		this.assets.clear();
		this.canvas.width = 1;
		this.canvas.height = 1;
		this.canvas.style.left = '';
		this.canvas.style.top = '';
		this.canvas.style.right = '';
		this.canvas.style.bottom = '';
	}
}
