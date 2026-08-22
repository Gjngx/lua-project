const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const seededUnit = (index, salt) => {
	const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
	return value - Math.floor(value);
};

export class SvgPathParticles {
	constructor(svg, canvas, { dprCap = 1.5 } = {}) {
		this.svg = svg;
		this.canvas = canvas;
		this.root = canvas.parentElement;
		this.ctx = canvas.getContext('2d');
		this.dprCap = dprCap;
		this.progress = 0;
		this.scaleX = 1;
		this.scaleY = 1;
		this.originX = 0;
		this.originY = 0;
		this.particles = [];
		this.resizeObserver = null;
		this.intersectionObserver = null;
		this.isVisible = false;
		this.idleTimer = null;
		this.idleFrame = null;
		this.idleStartedAt = 0;
		this.lastIdleFrame = 0;
		this.animateIdle = this.animateIdle.bind(this);
		this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

		if (!this.ctx || !this.svg.viewBox?.baseVal) return;

		this.viewBox = this.svg.viewBox.baseVal;
		this.color = getComputedStyle(this.root).color;
		this.createParticles();
		$(this.root).addClass(['is-path-particles-active']);
		this.resize();

		this.resizeObserver = new ResizeObserver(() => {
			this.resize();
		});
		this.resizeObserver.observe(this.svg);

		this.intersectionObserver = new IntersectionObserver(([entry]) => {
			this.isVisible = entry.isIntersecting;

			if (this.isVisible) {
				this.scheduleIdleMotion();
			} else {
				this.cancelIdleMotion();
			}
		});
		this.intersectionObserver.observe(this.root);
		$(document).on('visibilitychange', this.handleVisibilityChange);
	}

	createParticles() {
		const paths = $(this.svg).find('path').toArray();

		this.particles = Array.from(paths, (path, index) => {
			const bounds = path.getBBox();
			const availableX = Math.max(0, this.viewBox.width - bounds.width);
			const availableY = Math.max(0, this.viewBox.height - bounds.height);
			const randomX = this.viewBox.x + seededUnit(index, 1) * availableX;
			const randomY = this.viewBox.y + seededUnit(index, 2) * availableY;

			return {
				shape: new Path2D($(path).attr('d')),
				offsetX: randomX - bounds.x,
				offsetY: randomY - bounds.y,
				idleAmplitude: 1 + seededUnit(index, 3) * 1.25,
				idleSpeed: 0.0012 + seededUnit(index, 4) * 0.0007,
				phaseX: seededUnit(index, 5) * Math.PI * 2,
				phaseY: seededUnit(index, 6) * Math.PI * 2,
			};
		});
	}

	resize() {
		const svgRect = this.svg.getBoundingClientRect();
		const canvasRect = this.canvas.getBoundingClientRect();
		if (
			!svgRect.width ||
			!svgRect.height ||
			!canvasRect.width ||
			!canvasRect.height
		) return;

		const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
		const width = Math.max(1, Math.round(canvasRect.width * dpr));
		const height = Math.max(1, Math.round(canvasRect.height * dpr));

		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
		}

		this.scaleX = (svgRect.width * dpr) / this.viewBox.width;
		this.scaleY = (svgRect.height * dpr) / this.viewBox.height;
		this.originX =
			(svgRect.left - canvasRect.left) * dpr -
			this.viewBox.x * this.scaleX;
		this.originY =
			(svgRect.top - canvasRect.top) * dpr -
			this.viewBox.y * this.scaleY;
		this.color = getComputedStyle(this.root).color;
		this.render(this.progress);
	}

	render(progress) {
		if (!this.ctx || !this.particles.length) return;

		this.cancelIdleMotion();
		this.progress = clamp(progress);
		const isAssembled = this.progress >= 0.9995;
		$(this.root).toggleClass('is-path-particles-assembled', isAssembled);

		if (isAssembled) return;

		this.draw();
		this.scheduleIdleMotion();
	}

	draw(idleElapsed = 0) {
		const { ctx, canvas, scaleX, scaleY, originX, originY } = this;
		const easedProgress = Math.sin(this.progress * Math.PI * 0.5);
		const remaining = 1 - easedProgress;
		const idleRampProgress = clamp(idleElapsed / 450);
		const idleRamp =
			idleRampProgress * idleRampProgress * (3 - 2 * idleRampProgress);
		const idleStrength =
			Math.min(1, (1 - this.progress) * 2) * idleRamp;

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		this.color = getComputedStyle(this.root).color;
		ctx.fillStyle = this.color;

		for (let index = 0; index < this.particles.length; index++) {
			const particle = this.particles[index];
			const wobbleX = idleStrength
				? Math.sin(idleElapsed * particle.idleSpeed + particle.phaseX) *
					particle.idleAmplitude *
					idleStrength
				: 0;
			const wobbleY = idleStrength
				? Math.cos(idleElapsed * particle.idleSpeed * 0.85 + particle.phaseY) *
					particle.idleAmplitude *
					idleStrength
				: 0;

			ctx.setTransform(
				scaleX,
				0,
				0,
				scaleY,
				originX +
					(particle.offsetX * remaining + wobbleX) * scaleX,
				originY +
					(particle.offsetY * remaining + wobbleY) * scaleY
			);
			ctx.fill(particle.shape);
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}

	scheduleIdleMotion() {
		if (
			!this.isVisible ||
			document.hidden ||
			this.progress >= 0.9995 ||
			this.idleTimer ||
			this.idleFrame
		) return;

		this.idleTimer = window.setTimeout(() => {
			this.idleTimer = null;
			this.idleStartedAt = performance.now();
			this.lastIdleFrame = 0;
			this.idleFrame = requestAnimationFrame(this.animateIdle);
		}, 100);
	}

	animateIdle(timestamp) {
		const isAssembled = this.progress >= 0.9995;

		if (!this.isVisible || document.hidden || isAssembled) {
			$(this.root).toggleClass('is-path-particles-assembled', isAssembled);
			this.idleFrame = null;
			return;
		}

		$(this.root).removeClass(['is-path-particles-assembled']);

		if (!this.lastIdleFrame || timestamp - this.lastIdleFrame >= 1000 / 30) {
			this.lastIdleFrame = timestamp;
			this.draw(timestamp - this.idleStartedAt);
		}

		this.idleFrame = requestAnimationFrame(this.animateIdle);
	}

	cancelIdleMotion() {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}

		if (this.idleFrame) {
			cancelAnimationFrame(this.idleFrame);
			this.idleFrame = null;
		}
	}

	handleVisibilityChange() {
		if (document.hidden) {
			this.cancelIdleMotion();
		} else {
			this.scheduleIdleMotion();
		}
	}

	destroy() {
		this.cancelIdleMotion();
		this.resizeObserver?.disconnect();
		this.intersectionObserver?.disconnect();
		$(document).off('visibilitychange', this.handleVisibilityChange);
		$(this.root).removeClass(['is-path-particles-active', 'is-path-particles-assembled']);
		this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.particles = [];
	}
}
