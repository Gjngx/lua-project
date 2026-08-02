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
	uniform float uImageAspect;
	varying vec2 vUv;

	float roundedBox(vec2 point, vec2 halfSize, float radius) {
		vec2 distance = abs(point) - halfSize + radius;
		return length(max(distance, 0.0)) + min(max(distance.x, distance.y), 0.0) - radius;
	}

	void main() {
		float edge = roundedBox(vUv - 0.5, vec2(0.5), 0.055);
		float cardAlpha = 1.0 - smoothstep(-0.006, 0.006, edge);

		if (cardAlpha < 0.01) discard;

		const float cardAspect = 1.5;
		vec2 coverUv = vUv;
		if (uImageAspect > cardAspect) {
			coverUv.x = (coverUv.x - 0.5) * (cardAspect / uImageAspect) + 0.5;
		} else {
			coverUv.y = (coverUv.y - 0.5) * (uImageAspect / cardAspect) + 0.5;
		}

		vec4 image = texture2D(tMap, coverUv);
		gl_FragColor = vec4(image.rgb, image.a * cardAlpha);
	}
`;

const CARD_LAYOUT = [
	{ x: -0.76, y: 0.76, scale: 0.92, depth: 1 },
	{ x: -0.57, y: 0.35, scale: 0.82, depth: -1 },
	{ x: -0.25, y: 0.7, scale: 0.62, depth: -1 },
	{ x: 0.45, y: 0.76, scale: 0.95, depth: -1 },
	{ x: 0.78, y: 0.42, scale: 0.5, depth: 1 },
	{ x: -0.77, y: 0.02, scale: 0.66, depth: 1 },
	{ x: 0.8, y: -0.43, scale: 1.14, depth: -1 },
	{ x: -0.66, y: -0.53, scale: 0.8, depth: -1 },
];
const CARD_SPHERE_RADIUS = 4.15;
const CAMERA_FIT_RADIUS = 4.35;
const CARD_SCALE_MULTIPLIER = 1.58;
const IDLE_ROTATION_VELOCITY = { x: 0.00006, y: 0.00028 };
const IDLE_ROTATION_SPEED = Math.hypot(
	IDLE_ROTATION_VELOCITY.x,
	IDLE_ROTATION_VELOCITY.y,
);
const MAX_SCROLL_ROTATION_BOOST = 4;
const SCROLL_SPEED_FOR_MAX_BOOST = 2.5;
const MAX_RENDER_DPR = 1.5;
const SHARED_IMAGE_CACHE = new Map();

function loadSharedImage(url) {
	const cachedImage = SHARED_IMAGE_CACHE.get(url);
	if (cachedImage) return cachedImage;

	const image = new Image();
	image.decoding = 'async';

	const promise = new Promise((resolve, reject) => {
		image.addEventListener('load', () => resolve(image), { once: true });
		image.addEventListener(
			'error',
			() => {
				SHARED_IMAGE_CACHE.delete(url);
				reject(new Error(`Không thể tải ảnh playground: ${url}`));
			},
			{ once: true },
		);
		image.src = url;
	}).then(async (loadedImage) => {
		try {
			await loadedImage.decode();
		} catch {
			// `load` đã hoàn tất nên ảnh vẫn dùng được nếu decode() không được hỗ trợ.
		}
		return loadedImage;
	});

	const asset = { image, promise };
	SHARED_IMAGE_CACHE.set(url, asset);
	return asset;
}

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
		this.pendingRenderId = null;
		this.lastFrameTime = 0;
		this.isVisible = false;
		this.isDestroyed = false;
		this.assetsReady = false;
		this.hasWarmedAssets = false;
		this.lastRenderSize = { width: 0, height: 0, dpr: 0 };
		this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		this.targetVelocity = { ...IDLE_ROTATION_VELOCITY };
		this.velocity = { x: 0, y: 0 };
		this.rotation = { x: 0, y: 0 };
		this.scrollRotationBoost = 0;
		this.scrollRotationBoostTarget = 0;
		this.lastScrollPosition = 0;
		this.lastScrollTime = 0;
		this.floatTime = 0;
		this.floatStrength = 1;
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
		this.onScroll = this.onScroll.bind(this);
		this.onResize = this.onResize.bind(this);
		this.onVisibilityChange = this.onVisibilityChange.bind(this);
		this.onContextLost = this.onContextLost.bind(this);
		this.render = this.render.bind(this);
	}

	init() {
		this.renderer = new Renderer({
			canvas: this.canvas,
			alpha: true,
			antialias: false,
			dpr: this.getRenderDpr(),
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
		this.prepareAssets();
		this.updateCardTransforms();
		this.bindEvents();
		this.onResize();
		this.renderer.render({ scene: this.scene, camera: this.camera });
	}

	getRenderDpr() {
		return Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR);
	}

	createCards() {
		const cardCount = Math.min(this.imageUrls.length, CARD_LAYOUT.length);

		for (let index = 0; index < cardCount; index += 1) {
			const url = this.imageUrls[index];
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
				x: 1.5 * layout.scale * CARD_SCALE_MULTIPLIER,
				y: layout.scale * CARD_SCALE_MULTIPLIER,
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
			const floatX = Math.cos(floatWave * 0.72) * 0.06 * this.floatStrength;
			const floatY = Math.sin(floatWave) * 0.11 * this.floatStrength;
			const floatZ = Math.sin(floatWave * 0.58) * 0.05 * this.floatStrength;

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
				uImageAspect: { value: 1 },
			},
			transparent: true,
			depthTest: true,
			depthWrite: true,
			cullFace: this.gl.BACK,
		});
		const sharedImage = loadSharedImage(url);
		const readyPromise = sharedImage.promise.then((image) => {
			if (this.isDestroyed) return;
			texture.image = image;
			texture.needsUpdate = true;
			program.uniforms.uImageAspect.value = image.naturalWidth / image.naturalHeight;
		});

		const asset = { texture, program, image: sharedImage.image, readyPromise };
		this.assets.set(url, asset);
		this.textures.push(texture);
		this.programs.push(program);
		return asset;
	}

	prepareAssets() {
		Promise.all([...this.assets.values()].map((asset) => asset.readyPromise))
			.then(() => {
				if (this.isDestroyed) return;
				this.assetsReady = true;
				this.requestRender();
			})
			.catch((error) => {
				if (this.isDestroyed) return;
				console.warn('[Home Playground] Không thể chuẩn bị texture:', error);
				this.root.classList.add('is-static');
			});
	}

	requestRender() {
		if (
			this.pendingRenderId !== null ||
			this.frameId !== null ||
			this.isDestroyed ||
			!this.renderer
		) {
			return;
		}

		this.pendingRenderId = window.requestAnimationFrame(() => {
			this.pendingRenderId = null;
			if (this.isDestroyed || !this.renderer) return;

			this.renderer.render({ scene: this.scene, camera: this.camera });
			this.hasWarmedAssets = this.assetsReady;

			if (this.isVisible && !this.isReducedMotion) {
				this.start();
			}
		});
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
		document.addEventListener('scroll', this.onScroll, { passive: true, capture: true });
		this.lastScrollPosition = this.getScrollPosition();
		this.lastScrollTime = performance.now();

		this.resizeObserver = new ResizeObserver(this.onResize);
		this.resizeObserver.observe(this.root);

		this.visibilityObserver = new IntersectionObserver(
			(entries) => {
				this.isVisible = entries[0]?.isIntersecting ?? false;
				if (this.isVisible) {
					this.lastScrollPosition = this.getScrollPosition();
					this.lastScrollTime = performance.now();
					if (this.isReducedMotion) {
						this.requestRender();
					} else {
						this.start();
					}
				} else {
					this.stop();
				}
			},
			{ threshold: 0 },
		);
		this.visibilityObserver.observe(this.root);
	}

	getScrollPosition() {
		const bodyInner = document.querySelector('.body-inner');
		return Math.max(
			window.scrollY || document.documentElement.scrollTop || 0,
			bodyInner?.scrollTop || 0,
		);
	}

	onScroll() {
		const now = performance.now();
		const position = this.getScrollPosition();
		const elapsed = Math.max(16, now - this.lastScrollTime);
		const distance = Math.abs(position - this.lastScrollPosition);

		this.lastScrollPosition = position;
		this.lastScrollTime = now;
		if (!this.isVisible || distance === 0) return;

		const scrollSpeed = distance / elapsed;
		const boost = Math.min(
			MAX_SCROLL_ROTATION_BOOST,
			(scrollSpeed / SCROLL_SPEED_FOR_MAX_BOOST) * MAX_SCROLL_ROTATION_BOOST,
		);
		this.scrollRotationBoostTarget = Math.max(this.scrollRotationBoostTarget, boost);
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
			this.targetVelocity.x = IDLE_ROTATION_VELOCITY.x;
			this.targetVelocity.y = IDLE_ROTATION_VELOCITY.y;
		}
		this.root.classList.remove('is-dragging');
	}

	onResize() {
		if (!this.renderer || !this.camera) return;

		const width = Math.max(1, this.root.clientWidth);
		const height = Math.max(1, this.root.clientHeight);
		const dpr = this.getRenderDpr();
		if (
			width === this.lastRenderSize.width &&
			height === this.lastRenderSize.height &&
			dpr === this.lastRenderSize.dpr
		) {
			return;
		}
		this.lastRenderSize = { width, height, dpr };

		const aspect = width / height;
		const overscan = Math.min(width, height) * 0.18;
		const renderWidth = width + overscan * 2;
		const renderHeight = height + overscan * 2;
		const renderAspect = renderWidth / renderHeight;
		const fitAxis = Math.min(1, aspect);
		this.horizontalSpread = Math.min(2, Math.max(1, aspect / 0.92));
		const halfFov = (this.camera.fov * Math.PI) / 360;
		const baseCameraDistance =
			(CAMERA_FIT_RADIUS * 1.2) / (Math.tan(halfFov) * fitAxis) + 1.4;
		const cameraDistance = baseCameraDistance * (renderHeight / height);

		this.renderer.dpr = dpr;
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
		if (
			this.frameId !== null ||
			this.isDestroyed ||
			document.hidden ||
			!this.assetsReady
		) {
			return;
		}
		if (!this.hasWarmedAssets) {
			this.requestRender();
			return;
		}

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
		const targetFloatStrength = this.isDragging ? 0.2 : 1;
		const floatSmoothing = 1 - Math.pow(0.86, delta);
		this.floatStrength += (targetFloatStrength - this.floatStrength) * floatSmoothing;
		this.velocity.x += (this.targetVelocity.x - this.velocity.x) * smoothing;
		this.velocity.y += (this.targetVelocity.y - this.velocity.y) * smoothing;
		const scrollBoostSmoothing = 1 - Math.pow(0.72, delta);
		this.scrollRotationBoost +=
			(this.scrollRotationBoostTarget - this.scrollRotationBoost) * scrollBoostSmoothing;
		this.scrollRotationBoostTarget *= Math.pow(0.9, delta);
		const rotationMultiplier = 1 + this.scrollRotationBoost;
		this.rotation.x += this.velocity.x * delta * rotationMultiplier;
		this.rotation.y += this.velocity.y * delta * rotationMultiplier;
		this.updateCardTransforms();

		this.renderer.render({ scene: this.scene, camera: this.camera });
		this.frameId = window.requestAnimationFrame(this.render);
	}

	destroy() {
		this.isDestroyed = true;
		this.stop();
		if (this.pendingRenderId !== null) {
			window.cancelAnimationFrame(this.pendingRenderId);
			this.pendingRenderId = null;
		}
		this.resizeObserver?.disconnect();
		this.visibilityObserver?.disconnect();
		this.root.removeEventListener('pointerdown', this.onPointerDown);
		this.root.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('pointerup', this.onPointerUp);
		window.removeEventListener('pointercancel', this.onPointerUp);
		this.root.classList.remove('is-dragging');
		this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
		document.removeEventListener('visibilitychange', this.onVisibilityChange);
		document.removeEventListener('scroll', this.onScroll, { capture: true });

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
