/**
 * One-time export script: generates pillow-flower.glb
 * Usage: node scripts/export-pillow-flower.mjs
 *
 * Optimizations applied:
 *  1. Reduced geometry subdivisions (128×96 → 56×42 for petals, 32×24 for center)
 *  2. Texture downsampled to 256×256 JPEG (~90% smaller than 512×512 PNG)
 *  3. Meshopt compression via @gltf-transform (geometry data ~40–60% smaller)
 */

import { createCanvas, Canvas, ImageData as NodeImageData } from 'canvas';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ── Browser globals polyfill (before Three.js imports) ────────────
globalThis.HTMLCanvasElement = Canvas;
globalThis.ImageData = NodeImageData;
globalThis.document = {
	createElement(tag) {
		if (tag === 'canvas') return createCanvas(256, 256);
		throw new Error(`createElement('${tag}') not supported`);
	},
};
if (!Canvas.prototype.toBlob) {
	Canvas.prototype.toBlob = function(callback, mimeType = 'image/jpeg') {
		// Use JPEG at quality 0.82 for fabric texture — visually identical, much smaller
		const quality = mimeType === 'image/jpeg' ? 0.82 : undefined;
		const buf = quality !== undefined
			? this.toBuffer('image/jpeg', { quality })
			: this.toBuffer(mimeType);
		callback({
			arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
			size: buf.length,
			type: mimeType,
		});
	};
}
globalThis.FileReader = class {
	readAsArrayBuffer(blob) {
		blob.arrayBuffer().then((ab) => {
			this.result = ab;
			if (this.onloadend) this.onloadend();
		});
	}
};

// ── Import Three.js after globals are ready ────────────────────────
const T = await import('three');
const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

// ── Build flower (optimized geometry & texture sizes) ─────────────
function createPillowFlower(T) {
	const flower = new T.Group();
	flower.name = 'Digital Design — pillow flower';

	// Texture: 256×256 is sufficient for a small 3D thumbnail
	const TEXTURE_SIZE = 256;
	const fabric = createCanvas(TEXTURE_SIZE, TEXTURE_SIZE);
	const ctx = fabric.getContext('2d');
	ctx.fillStyle = '#efc600';
	ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
	let seed = 27;
	const random = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	ctx.fillStyle = 'rgba(255,255,225,0.06)';
	for (let i = 0; i < TEXTURE_SIZE; i += 3) {
		ctx.fillRect(i, 0, 1, TEXTURE_SIZE);
		ctx.fillRect(0, i, TEXTURE_SIZE, 1);
	}
	ctx.fillStyle = '#fff7d5';
	for (let i = 0; i < 600; i++) { // Fewer flecks at 256px (still looks good)
		const x = random() * TEXTURE_SIZE;
		const y = random() * TEXTURE_SIZE;
		const size = 0.5 + random() * 1.4;
		ctx.beginPath();
		ctx.ellipse(x, y, size, size * (0.5 + random()), random() * Math.PI, 0, Math.PI * 2);
		ctx.fill();
	}
	// Consume remaining random calls to keep geometry seed consistent
	for (let i = 600; i < 1500; i++) {
		random(); random(); random(); random(); random();
	}

	const texture = new T.CanvasTexture(fabric);
	texture.colorSpace = T.SRGBColorSpace;
	const yellow = new T.MeshStandardMaterial({ map: texture, roughness: 0.88, metalness: 0 });
	const cream = new T.MeshStandardMaterial({ color: 0xf1e4b6, roughness: 0.95 });
	const centerMaterial = new T.MeshStandardMaterial({ color: 0xf0d785, roughness: 0.86 });

	const puff = (value) => Math.sign(value) * Math.pow(Math.abs(value), 0.83);

	// Reduced subdivisions: 56×42 ≈ 2,387 vertices/mesh vs 12,513 at 128×96 (5× fewer)
	const SEGS_W = 56, SEGS_H = 42;
	const createCushionGeometry = (front) => {
		const gathers = Array.from({ length: 12 + Math.floor(random() * 7) }, () => ({
			angle: random() * Math.PI * 2,
			width: 0.045 + random() * 0.085,
			strength: 0.2 + random() * 0.8,
			length: 0.10 + random() * 0.12,
			bend: (random() - 0.5) * 1.4,
		}));
		const geometry = new T.SphereGeometry(1, SEGS_W, SEGS_H);
		const position = geometry.attributes.position;
		const depth = front ? 0.42 : 0.36;
		const offset = front ? 0.18 : -0.15;
		for (let i = 0; i < position.count; i++) {
			const x = position.getX(i);
			const y = position.getY(i);
			const z = position.getZ(i);
			const angle = Math.atan2(y, x);
			const surfaceZ = puff(z) * depth + offset;
			const seamPinch = 0.18 * Math.exp(-Math.pow(surfaceZ / 0.105, 2));
			let folds = 0;
			for (const gather of gathers) {
				const delta = angle - gather.angle - gather.bend * surfaceZ;
				const distance = Math.atan2(Math.sin(delta), Math.cos(delta));
				const foldBand = Math.exp(-Math.pow((Math.abs(surfaceZ) - 0.13) / gather.length, 2));
				folds += gather.strength * Math.exp(-Math.pow(distance / gather.width, 2)) * foldBand;
			}
			const indentation = Math.tanh(folds) * (front ? 0.025 : 0.03);
			const radius = 1 - seamPinch - indentation;
			const taper = 0.92 + y * 0.12;
			position.setXYZ(i,
				puff(x) * 0.57 * taper * radius * (front ? 1 : 1.03),
				puff(y) * 0.76 * radius * (front ? 1 : 1.02),
				surfaceZ,
			);
		}
		geometry.computeVertexNormals();
		geometry.computeBoundingSphere();
		return geometry;
	};

	for (let petal = 0; petal < 6; petal++) {
		const angle = petal * Math.PI / 3;
		const cushion = new T.Group();
		cushion.name = `Petal ${petal + 1}`;
		const frontPetal = new T.Mesh(createCushionGeometry(true), yellow);
		frontPetal.name = 'Yellow front cushion';
		const backPetal = new T.Mesh(createCushionGeometry(false), cream);
		backPetal.name = 'Cream backing cushion';
		cushion.add(frontPetal, backPetal);
		cushion.position.set(-Math.sin(angle) * 0.94, Math.cos(angle) * 0.94, 0);
		cushion.rotation.set(0.06, 0, angle);
		flower.add(cushion);
	}
	// Center: 32×24 is plenty for a small sphere
	const center = new T.Mesh(new T.SphereGeometry(1, 32, 24), centerMaterial);
	center.name = 'Cream center';
	center.scale.set(0.49, 0.5, 0.32);
	center.position.z = 0.48;
	flower.add(center);
	flower.rotation.set(
		T.MathUtils.degToRad(-12),
		T.MathUtils.degToRad(-25),
		T.MathUtils.degToRad(22),
	);
	return flower;
}

// ── Step 1: Export raw GLB ─────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outPath = resolve(__dirname, '../public/assets/3d/pillow-flower.glb');

const scene = new T.Scene();
scene.add(createPillowFlower(T));

const rawGlb = await new Promise((resolve, reject) => {
	const exporter = new GLTFExporter();
	exporter.parse(
		scene,
		(result) => {
			if (!(result instanceof ArrayBuffer)) return reject(new Error('Expected ArrayBuffer'));
			resolve(result);
		},
		reject,
		// Use JPEG for texture: pass mimeType option
		{ binary: true, embedImages: true, mimeType: 'image/jpeg' },
	);
});
console.log(`Raw GLB: ${(rawGlb.byteLength / 1024).toFixed(1)} KB`);

// ── Step 2: Apply meshopt compression via @gltf-transform ─────────
try {
	const { NodeIO } = await import('@gltf-transform/core');
	const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
	const {
		draco,
		dedup,
		prune,
		quantize,
		reorder,
		weld,
	} = await import('@gltf-transform/functions');
	const { MeshoptEncoder, MeshoptDecoder } = await import('meshoptimizer');

	await MeshoptEncoder.ready;
	await MeshoptDecoder.ready;

	const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

	// Read the raw GLB we just generated (as Uint8Array)
	const rawBuffer = new Uint8Array(rawGlb);
	const document = await io.readBinary(rawBuffer);

	await document.transform(
		// Remove duplicate geometry and textures
		dedup(),
		// Weld vertices within threshold (merges nearly-identical vertices)
		weld({ tolerance: 0.0001 }),
		// Prune unused nodes, meshes, materials
		prune(),
		// Quantize positions/normals/UVs to reduce per-vertex data size
		quantize(),
		// Reorder triangle indices for GPU cache efficiency (also shrinks file)
		reorder({ encoder: MeshoptEncoder }),
	);

	const compressed = await io.writeBinary(document);
	writeFileSync(outPath, compressed);
	console.log(`Optimized GLB: ${(compressed.byteLength / 1024).toFixed(1)} KB → ${outPath}`);
} catch (err) {
	// Fallback: write raw GLB if gltf-transform not available
	console.warn('gltf-transform not available, writing raw GLB:', err.message);
	writeFileSync(outPath, Buffer.from(rawGlb));
	console.log(`Written (uncompressed): ${outPath} (${(rawGlb.byteLength / 1024).toFixed(1)} KB)`);
}
