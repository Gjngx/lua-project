import { gsap } from './gsap.js';

// The existing GSAP controller owns motion. This class only draws/picks cards.
export class PlaygroundSphere {
	constructor(stage, cards, onReady) {
		this.stage = stage;
		this.scaleContainer = stage.parentElement;
		this.host = stage.closest('.home-playground-card-layer');
		this.cards = cards;
		this.onReady = onReady;
		this.meshes = [];
		this.textures = [];
		this.hover = new Float32Array(cards.length);
		this.hoverTransitions = new Map();
		this.keyboardCard = { value: -1 };
		this.hovered = -1;
		this.ready = false;
		this.disposed = false;
	}

	async init() {
		try {
			const T = await import('three');
			if (this.disposed) return;
			this.T = T;
			this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
			this.renderer.debug.onShaderError = () => { throw new Error('Globe shader compilation failed'); };
			this.renderer.setClearColor(0x000000, 0);
			this.renderer.outputColorSpace = T.SRGBColorSpace;
			this.canvas = this.renderer.domElement;
			this.canvas.className = 'home-playground-webgl';
			this.canvas.setAttribute('aria-hidden', 'true');
			this.onContextLost = (event) => {
				event.preventDefault();
				this.destroy();
				console.warn('[Playground] WebGL context lost. Reload to restart the globe.');
			};
			this.canvas.addEventListener('webglcontextlost', this.onContextLost);
			this.scene = new T.Scene();
			this.group = new T.Group();
			this.scene.add(this.group);
			this.camera = new T.PerspectiveCamera();
			this.raycaster = new T.Raycaster();
			this.pointer = new T.Vector2();
			this.object = new T.Object3D();
			const urls = this.cards.map((card) => card.src);
			if (urls.some((url) => !url)) throw new Error('Missing gallery image');
			const unique = [...new Set(urls)];
			// Load once per unique image, including all repeated cards.
			const images = await Promise.all(unique.map((url) => new Promise((resolve, reject) => {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = () => resolve(img);
				img.onerror = () => reject(new Error('Gallery texture unavailable'));
				img.src = url;
			})));
			if (this.disposed) return;
			const limit = Math.min(4096, this.renderer.capabilities.maxTextureSize);
			const cellWidth = Math.min(1024, limit);
			const cellHeight = Math.round(cellWidth * 0.625);
			const columns = Math.floor(limit / cellWidth);
			const perPage = columns * Math.floor(limit / cellHeight);
			for (let start = 0; start < unique.length; start += perPage) {
				const page = images.slice(start, start + perPage);
				const atlas = document.createElement('canvas');
				atlas.width = Math.min(columns, page.length) * cellWidth;
				atlas.height = Math.ceil(page.length / columns) * cellHeight;
				const ctx = atlas.getContext('2d');
				page.forEach((img, index) => {
					const x = (index % columns) * cellWidth;
					const y = Math.floor(index / columns) * cellHeight;
					const ratio = Math.max(cellWidth / img.naturalWidth, cellHeight / img.naturalHeight);
					const sw = cellWidth / ratio;
					const sh = cellHeight / ratio;
					ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2,
						sw, sh, x, y, cellWidth, cellHeight);
				});
				// Reject cross-origin images that cannot be uploaded to WebGL.
				ctx.getImageData(0, 0, 1, 1);
				const texture = new T.CanvasTexture(atlas);
				texture.colorSpace = T.SRGBColorSpace;
				texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
				this.textures.push(texture);
				const ids = urls.flatMap((url, id) => {
					const index = unique.indexOf(url);
					return index >= start && index < start + page.length ? [id] : [];
				});
				const geometry = new T.PlaneGeometry(1, 1);
				const rects = new Float32Array(ids.length * 4);
				ids.forEach((id, index) => {
					const tile = unique.indexOf(urls[id]) - start;
					rects.set([
						((tile % columns) * cellWidth + 2) / atlas.width,
						1 - (Math.floor(tile / columns) * cellHeight + cellHeight - 2) / atlas.height,
						(cellWidth - 4) / atlas.width, (cellHeight - 4) / atlas.height,
					], index * 4);
				});
				geometry.setAttribute('atlasRect', new T.InstancedBufferAttribute(rects, 4));
				geometry.setAttribute('cardId', new T.InstancedBufferAttribute(new Float32Array(ids), 1));
				const material = new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide });
				material.onBeforeCompile = (shader) => {
					shader.uniforms.keyboardCard = this.keyboardCard;
					shader.uniforms.focusColor = { value: new T.Color(getComputedStyle(this.stage).getPropertyValue('--cln-brand').trim() || '#E4F372') };
					shader.vertexShader = 'attribute float cardId; varying float vCardId; attribute vec4 atlasRect; varying vec4 vAtlasRect; varying vec2 vCardUv;\n' + shader.vertexShader;
					shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>',
						'#include <uv_vertex>\nvAtlasRect = atlasRect; vCardUv = uv; vCardId = cardId;');
					shader.fragmentShader = 'uniform float keyboardCard; uniform vec3 focusColor; varying float vCardId; varying vec4 vAtlasRect; varying vec2 vCardUv;\n' + shader.fragmentShader;
					shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
						vec2 corner = abs((vCardUv - 0.5) * vec2(1.6, 1.0)) - vec2(0.72, 0.42);
						if (length(max(corner, 0.0)) > 0.08) discard;
						diffuseColor *= texture2D(map, vAtlasRect.xy + vCardUv * vAtlasRect.zw);
						if (abs(vCardId - keyboardCard) < 0.1 &&
							(length(max(corner, 0.0)) > 0.06 || max(corner.x, corner.y) > 0.06)) {
							diffuseColor.rgb = focusColor;
						}
					`);
				};
				const mesh = new T.InstancedMesh(geometry, material, ids.length);
				mesh.userData.cardIds = ids;
				mesh.frustumCulled = false;
				this.meshes.push(mesh);
				this.group.add(mesh);
			}
			// A canvas clips at its own edges, unlike the overflowing CSS 3D cards.
			// Mount at section size and reproduce the wrapper scale in the camera.
			this.host.appendChild(this.canvas);
			this.ready = true;
			this.resize();
			this.renderer.compile(this.scene, this.camera);
			this.onReady();
		} catch (error) {
			console.warn('[Playground] WebGL globe unavailable:', error);
			this.destroy();
		}
	}

	resize() {
		if (!this.ready) return;
		this.dirty = true;
		const width = this.host.clientWidth;
		const height = this.host.clientHeight;
		if (!width || !height) return;
		const perspective = parseFloat(getComputedStyle(this.stage).perspective);
		this.camera.fov = 2 * Math.atan(height / (2 * perspective)) * 180 / Math.PI;
		this.camera.aspect = width / height;
		this.camera.near = 0.1;
		this.camera.far = perspective * 20;
		this.camera.position.z = perspective;
		this.camera.updateProjectionMatrix();
		// The drawing surface covers the section even when a focused card overflows.
		this.renderer.setPixelRatio(window.devicePixelRatio || 1);
		this.renderer.setSize(width, height, false);
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
		this.cardWidth = 16 * rem;
		this.cardHeight = 10 * rem;
		this.radius = 50 * rem;
		this.updateCards();
	}

	updateCards() {
		const { T, object } = this;
		for (const mesh of this.meshes) {
			mesh.userData.cardIds.forEach((id, index) => {
				const card = this.cards[id];
				object.rotation.set(-card.rotationX * Math.PI / 180,
					card.rotationY * Math.PI / 180, 0, 'YXZ');
				object.position.set(0, 0, this.radius).applyEuler(object.rotation);
				const scale = 1 + this.hover[id] * 0.05;
				object.scale.set(this.cardWidth * scale, this.cardHeight * scale, 1);
				object.updateMatrix();
				mesh.setMatrixAt(index, object.matrix);
			});
			mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
			mesh.instanceMatrix.needsUpdate = true;
		}
	}

	setHover(card, keyboard = false) {
		this.dirty = true;
		const next = this.cards.indexOf(card);
		this.keyboardCard.value = keyboard ? next : -1;
		if (next === this.hovered) return;
		for (const id of [this.hovered, next]) {
			if (id >= 0) this.hoverTransitions.set(id, {
				from: this.hover[id], to: id === next ? 1 : 0, start: performance.now(),
			});
		}
		this.hovered = next;
	}

	render(rotation, hover, delta = 0) {
		if (!this.ready || document.hidden) return;
		const zoom = Math.max(0.0001, Number(gsap.getProperty(this.scaleContainer, 'scaleX')) *
			Number(gsap.getProperty(this.stage, 'scaleX')));
		const opacity = Number(gsap.getProperty(this.stage, 'opacity'));
		const state = [rotation.x + hover.x, rotation.y + hover.y, rotation.scale, zoom, opacity];
		if (!this.dirty && !this.hoverTransitions.size &&
			this.lastState?.every((value, index) => value === state[index])) return;
		this.lastState = state;
		this.dirty = false;
		if (this.camera.zoom !== zoom) {
			this.camera.zoom = zoom;
			this.camera.updateProjectionMatrix();
		}
		this.canvas.style.opacity = String(opacity);
		this.group.rotation.set(-(rotation.x + hover.x) * Math.PI / 180,
			(rotation.y + hover.y) * Math.PI / 180, 0, 'XYZ');
		this.group.scale.setScalar(rotation.scale);
		let changed = false;
		this.hoverTransitions.forEach(({ from, to, start }, id) => {
			const progress = Math.min(1, (performance.now() - start) / 400);
			// Match CSS cubic-bezier(0.16, 1, 0.3, 1), including the 400ms duration.
			let low = 0, high = 1;
			for (let i = 0; i < 12; i++) {
				const t = (low + high) / 2;
				const x = 3 * (1 - t) ** 2 * t * 0.16 + 3 * (1 - t) * t * t * 0.3 + t ** 3;
				if (x < progress) low = t; else high = t;
			}
			const eased = 1 - (1 - (low + high) / 2) ** 3;
			this.hover[id] = progress === 1 ? to : from + (to - from) * eased;
			if (progress === 1) this.hoverTransitions.delete(id);
			changed = true;
		});
		if (changed) this.updateCards();
		this.renderer.render(this.scene, this.camera);
	}

	pick(event) {
		if (!this.ready) return null;
		const bounds = this.canvas.getBoundingClientRect();
		this.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1,
			1 - ((event.clientY - bounds.top) / bounds.height) * 2);
		this.scene.updateMatrixWorld(true);
		this.raycaster.setFromCamera(this.pointer, this.camera);
		const hits = this.raycaster.intersectObjects(this.meshes);
		const hit = hits.find(({ uv }) => Math.hypot(
			Math.max(Math.abs((uv.x - 0.5) * 1.6) - 0.72, 0),
			Math.max(Math.abs(uv.y - 0.5) - 0.42, 0)) <= 0.08);
		return hit ? this.cards[hit.object.userData.cardIds[hit.instanceId]] : null;
	}

	destroy() {
		this.disposed = true;
		this.ready = false;
		this.canvas?.removeEventListener('webglcontextlost', this.onContextLost);
		this.canvas?.remove();
		this.meshes.forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); });
		this.textures.forEach((texture) => texture.dispose());
		this.renderer?.dispose();
		this.meshes = [];
		this.textures = [];
	}
}
