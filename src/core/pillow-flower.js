// Procedural reconstruction of the reference: six stuffed fabric petals.
export function createPillowFlower(T) {
	const flower = new T.Group();
	flower.name = 'Digital Design — pillow flower';
	const fabric = document.createElement('canvas');
	fabric.width = fabric.height = 512;
	const ctx = fabric.getContext('2d');
	ctx.fillStyle = '#efc600';
	ctx.fillRect(0, 0, 512, 512);
	let seed = 27;
	const random = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	// Tiny woven threads and irregular ivory flecks, rather than a flat yellow.
	ctx.fillStyle = 'rgba(255,255,225,0.06)';
	for (let i = 0; i < 512; i += 3) {
		ctx.fillRect(i, 0, 1, 512);
		ctx.fillRect(0, i, 512, 1);
	}
	ctx.fillStyle = '#fff7d5';
	for (let i = 0; i < 1500; i++) {
		const x = random() * 512;
		const y = random() * 512;
		const size = 0.5 + random() * 1.4;
		ctx.beginPath();
		ctx.ellipse(x, y, size, size * (0.5 + random()), random() * Math.PI, 0, Math.PI * 2);
		ctx.fill();
	}
	const texture = new T.CanvasTexture(fabric);
	texture.colorSpace = T.SRGBColorSpace;
	const yellow = new T.MeshStandardMaterial({ map: texture, roughness: 0.88, metalness: 0 });
	const cream = new T.MeshStandardMaterial({ color: 0xf1e4b6, roughness: 0.95 });
	const centerMaterial = new T.MeshStandardMaterial({ color: 0xf0d785, roughness: 0.86 });

	const puff = (value) => Math.sign(value) * Math.pow(Math.abs(value), 0.83);
	const createCushionGeometry = (front) => {
		// Each cushion gets fixed, irregular gathers; never randomize per frame.
		const gathers = Array.from({ length: 12 + Math.floor(random() * 7) }, () => ({
			angle: random() * Math.PI * 2,
			width: 0.045 + random() * 0.085,
			strength: 0.2 + random() * 0.8,
			length: 0.10 + random() * 0.12,
			bend: (random() - 0.5) * 1.4,
		}));
		const geometry = new T.SphereGeometry(1, 128, 96);
		const position = geometry.attributes.position;
		const depth = front ? 0.42 : 0.36;
		const offset = front ? 0.18 : -0.15;
		for (let i = 0; i < position.count; i++) {
			const x = position.getX(i);
			const y = position.getY(i);
			const z = position.getZ(i);
			const angle = Math.atan2(y, x);
			const surfaceZ = puff(z) * depth + offset;
			// Both closed cushions meet at the same recessed waist (z = 0).
			// Pinch the actual surface rather than adding a raised seam mesh.
			const seamPinch = 0.18 * Math.exp(-Math.pow(surfaceZ / 0.105, 2));
			let folds = 0;
			for (const gather of gathers) {
				const delta = angle - gather.angle - gather.bend * surfaceZ;
				const distance = Math.atan2(Math.sin(delta), Math.cos(delta));
				const foldBand = Math.exp(-Math.pow((Math.abs(surfaceZ) - 0.13) / gather.length, 2));
				folds += gather.strength * Math.exp(-Math.pow(distance / gather.width, 2)) * foldBand;
			}
			// Keep overlapping gathers soft, with quiet areas between clusters.
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
		// Overlap the two cushions so the backing sits snugly against the front.
		const frontPetal = new T.Mesh(createCushionGeometry(true), yellow);
		frontPetal.name = 'Yellow front cushion';
		const backPetal = new T.Mesh(createCushionGeometry(false), cream);
		backPetal.name = 'Cream backing cushion';
		cushion.add(frontPetal, backPetal);
		cushion.position.set(-Math.sin(angle) * 0.94, Math.cos(angle) * 0.94, 0);
		cushion.rotation.set(0.06, 0, angle);
		flower.add(cushion);
	}
	const center = new T.Mesh(new T.SphereGeometry(1, 64, 48), centerMaterial);
	center.name = 'Cream center';
	center.scale.set(0.49, 0.5, 0.32);
	center.position.z = 0.48;
	flower.add(center);
	// Tilt the flower inside the animated group to retain the reference pose.
	flower.rotation.set(
		T.MathUtils.degToRad(-12),
		T.MathUtils.degToRad(-25),
		T.MathUtils.degToRad(22),
	);
	return flower;
}
