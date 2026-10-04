export const HERO_LIQUID_DEFAULTS = Object.freeze({
	simHeight: 192,
	overscan: 1.17,
	pointerForce: 3,
	maxVelocity: 90,
	activeMs: 2400,
	splatRadius: 0.0045,
	splatStrength: 0.7,
	dyeAmount: 0.05,
	pressureIterations: 16,
	velocityDt: 0.032,
	velocityDissipation: 0.935,
	dyeDt: 0.135,
	dyeDissipation: 0.885,
	displacement: 2,
});

const VERTEX = `
precision highp float;
attribute vec2 a_position;
uniform vec2 u_texel;
varying vec2 v_uv, v_l, v_r, v_t, v_b;
void main() {
  v_uv = a_position * .5 + .5;
  v_l = v_uv - vec2(u_texel.x, 0.);
  v_r = v_uv + vec2(u_texel.x, 0.);
  v_t = v_uv + vec2(0., u_texel.y);
  v_b = v_uv - vec2(0., u_texel.y);
  gl_Position = vec4(a_position, 0., 1.);
}`;

const FRAGMENTS = {
	splat: `precision highp float;
    varying vec2 v_uv; uniform sampler2D u_input; uniform float u_aspect;
    uniform vec2 u_point; uniform vec3 u_value; uniform float u_radius,u_strength;
    void main(){ vec2 p=v_uv-u_point; p.x*=u_aspect;
      vec3 impulse=u_strength*exp2(-dot(p,p)/u_radius)*u_value;
      gl_FragColor=vec4(texture2D(u_input,v_uv).xyz+impulse,1.); }`,
	divergence: `precision highp float;
    varying vec2 v_l,v_r,v_t,v_b; uniform sampler2D u_velocity;
    void main(){ float d=.25*(texture2D(u_velocity,v_r).x-texture2D(u_velocity,v_l).x
      +texture2D(u_velocity,v_t).y-texture2D(u_velocity,v_b).y);
      gl_FragColor=vec4(d,0.,0.,1.); }`,
	pressure: `precision highp float;
    varying vec2 v_uv,v_l,v_r,v_t,v_b; uniform sampler2D u_pressure,u_divergence;
    void main(){ float n=texture2D(u_pressure,v_l).x+texture2D(u_pressure,v_r).x
      +texture2D(u_pressure,v_t).x+texture2D(u_pressure,v_b).x;
      gl_FragColor=vec4((n-texture2D(u_divergence,v_uv).x)*.25,0.,0.,1.); }`,
	gradient: `precision highp float;
    varying vec2 v_uv,v_l,v_r,v_t,v_b; uniform sampler2D u_pressure,u_velocity;
    void main(){ vec2 v=texture2D(u_velocity,v_uv).xy;
      v-=vec2(texture2D(u_pressure,v_r).x-texture2D(u_pressure,v_l).x,
      texture2D(u_pressure,v_t).x-texture2D(u_pressure,v_b).x);
      gl_FragColor=vec4(v,0.,1.); }`,
	advection: `precision highp float;
    varying vec2 v_uv; uniform sampler2D u_velocity,u_input;
    uniform vec2 u_texel,u_output_texel; uniform float u_dt,u_dissipation;
    vec4 bilerp(sampler2D s,vec2 uv,vec2 size){ vec2 p=uv/size-.5,i=floor(p),f=fract(p);
      vec4 a=texture2D(s,(i+vec2(.5))*size),b=texture2D(s,(i+vec2(1.5,.5))*size);
      vec4 c=texture2D(s,(i+vec2(.5,1.5))*size),d=texture2D(s,(i+vec2(1.5))*size);
      return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
    void main(){ vec2 p=v_uv-u_dt*bilerp(u_velocity,v_uv,u_texel).xy*u_texel;
      gl_FragColor=u_dissipation*bilerp(u_input,p,u_output_texel); }`,
	display: `precision highp float;
    varying vec2 v_uv; uniform sampler2D u_image,u_velocity,u_dye;
    uniform float u_aspect,u_image_aspect,u_visible_scale,u_displacement; uniform vec2 u_focus;
    vec2 cover(vec2 uv){ vec2 visible=vec2(1.);
      if(u_aspect>u_image_aspect) visible.y=u_image_aspect/u_aspect;
      else visible.x=u_aspect/u_image_aspect;
      vec2 center=clamp(u_focus,visible*.5,1.-visible*.5);
      return (uv-.5)*visible+center; }
    void main(){ vec2 frame=(v_uv-.5)/u_visible_scale+.5;
      float dye=texture2D(u_dye,v_uv).r;
      vec2 velocity=texture2D(u_velocity,v_uv).xy+vec2(.001);
      vec2 base=cover(frame);
      // Fade displacement at the image boundary instead of stretching its last pixel row.
      vec2 edge=min(base,1.-base);
      float boundary=smoothstep(0.,.08,min(edge.x,edge.y));
      vec2 offset=u_displacement*normalize(velocity)*dye*boundary;
      vec2 room=mix(1.-base,base,step(vec2(0.),offset));
      vec2 limits=room/max(abs(offset),vec2(.00001));
      offset*=clamp(min(limits.x,limits.y),0.,1.);
      vec2 uv=base-offset;
      gl_FragColor=texture2D(u_image,clamp(uv,0.,1.)); }`,
};

function makeProgram(gl, fragmentSource) {
	const compile = (type, source) => {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const message = gl.getShaderInfoLog(shader);
			gl.deleteShader(shader);
			throw new Error(message || 'Hero liquid shader compilation failed');
		}
		return shader;
	};
	const program = gl.createProgram();
	const vertex = compile(gl.VERTEX_SHADER, VERTEX);
	const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.bindAttribLocation(program, 0, 'a_position');
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS))
		throw new Error(gl.getProgramInfoLog(program));
	const uniforms = {};
	for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i += 1) {
		const uniform = gl.getActiveUniform(program, i);
		uniforms[uniform.name] = gl.getUniformLocation(program, uniform.name);
	}
	return { program, uniforms };
}

export class HeroLiquid {
	constructor(root, image, pointerTarget = root, options = {}) {
		this.root = root;
		this.image = image;
		this.isVideo = image instanceof HTMLVideoElement;
		this.pointerTarget = pointerTarget;
		this.options = { ...HERO_LIQUID_DEFAULTS, ...options };
		this.pointer = { x: 0, y: 0, dx: 0, dy: 0, active: false, moved: false };
		this.visible = true;
		this.raf = null;
		this.videoFrameId = null;
		this.videoFrameReady = true;
		this.needsWarmup = this.isVideo;
		this.render = this.render.bind(this);
		this.resize = this.resize.bind(this);
	}

	init() {
		if (
			(this.isVideo &&
				(this.image.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !this.image.videoWidth)) ||
			(!this.isVideo && (!this.image.complete || !this.image.naturalWidth))
		)
			return;
		this.canvas = document.createElement('canvas');
		this.canvas.className = `home-hero-liquid${this.isVideo ? ' is-video' : ''}`;
		this.root.appendChild(this.canvas);
		const gl = this.canvas.getContext('webgl', {
			alpha: false,
			antialias: false,
			powerPreference: 'high-performance',
		});
		if (
			!gl ||
			!gl.getExtension('OES_texture_float') ||
			!gl.getExtension('OES_texture_float_linear')
		)
			return this.destroy();
		this.gl = gl;
		try {
			this.programs = Object.fromEntries(
				Object.entries(FRAGMENTS).map(([name, source]) => [name, makeProgram(gl, source)]),
			);
			this.quad = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
			gl.bufferData(
				gl.ARRAY_BUFFER,
				new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
				gl.STATIC_DRAW,
			);
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
			this.indices = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
			this.imageTexture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			this.configureTexture();
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
			this.onVideoPlay = () => {
				this.videoFrameReady = false;
				if (performance.now() < this.activeUntil) this.schedule();
			};
			if (this.isVideo) this.image.addEventListener('play', this.onVideoPlay);

			this.onPointerMove = (event) => {
				const rect = this.root.getBoundingClientRect();
				const x = event.clientX - rect.left;
				const y = event.clientY - rect.top;
				if (this.pointer.active) {
					const { maxVelocity, pointerForce } = this.options;
					this.pointer.dx = Math.max(
						-maxVelocity,
						Math.min(maxVelocity, pointerForce * (x - this.pointer.x)),
					);
					this.pointer.dy = Math.max(
						-maxVelocity,
						Math.min(maxVelocity, pointerForce * (y - this.pointer.y)),
					);
					this.pointer.moved = true;
					this.activeUntil = performance.now() + this.options.activeMs;
				}
				Object.assign(this.pointer, { x, y, active: true });
				this.schedule();
			};
			this.onPointerLeave = () => Object.assign(this.pointer, { active: false, moved: false });
			this.pointerTarget.addEventListener('pointermove', this.onPointerMove, { passive: true });
			this.pointerTarget.addEventListener('pointerleave', this.onPointerLeave);
			this.resizeObserver = new ResizeObserver(this.resize);
			this.resizeObserver.observe(this.root);
			this.observer = new IntersectionObserver(([entry]) => {
				this.visible = entry.isIntersecting;
				if (this.visible) {
					this.schedule();
					this.scheduleVideoFrame();
				}
			});
			this.observer.observe(this.root);
			this.resize();
		} catch (error) {
			console.warn('[HeroLiquid] Canvas unavailable:', error);
			this.destroy();
		}
	}

	configureTexture() {
		const gl = this.gl;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	createTarget(width, height) {
		const gl = this.gl;
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		this.configureTexture();
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB, gl.FLOAT, null);
		const framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		return { texture, framebuffer, width, height };
	}

	createDoubleTarget(width, height) {
		let read = this.createTarget(width, height);
		let write = this.createTarget(width, height);
		return {
			width,
			height,
			read: () => read,
			write: () => write,
			swap: () => {
				[read, write] = [write, read];
			},
		};
	}

	deleteTargets() {
		if (!this.gl || !this.targets) return;
		const targets = [this.targets.divergence];
		for (const pair of [this.targets.velocity, this.targets.dye, this.targets.pressure])
			targets.push(pair.read(), pair.write());
		for (const target of targets) {
			this.gl.deleteTexture(target.texture);
			this.gl.deleteFramebuffer(target.framebuffer);
		}
		this.targets = null;
	}

	resize() {
		if (!this.gl) return;
		const width = Math.max(1, this.root.clientWidth);
		const height = Math.max(1, this.root.clientHeight);
		const nativeDpr = window.devicePixelRatio || 1;
		const dprCap = width * nativeDpr >= 2560 ? 1 : 2;
		const dpr = Math.min(nativeDpr, dprCap);
		const { overscan, simHeight } = this.options;
		const offset = (overscan - 1) * -50;
		Object.assign(this.canvas.style, {
			width: `${overscan * 100}%`,
			height: `${overscan * 100}%`,
			left: `${offset}%`,
			top: `${offset}%`,
		});
		this.canvas.width = Math.round(width * overscan * dpr);
		this.canvas.height = Math.round(height * overscan * dpr);
		const simWidth = Math.max(2, Math.round((simHeight * width) / height));
		if (!this.targets || this.targets.velocity.width !== simWidth) {
			this.deleteTargets();
			this.targets = {
				velocity: this.createDoubleTarget(simWidth, simHeight),
				dye: this.createDoubleTarget(simWidth, simHeight),
				pressure: this.createDoubleTarget(simWidth, simHeight),
				divergence: this.createTarget(simWidth, simHeight),
			};
		}
		this.aspect = width / height;
		Object.assign(this.pointer, { x: width * 0.65, y: height * 0.5 });
		this.activeUntil = performance.now();
		this.schedule();
	}

	setOptions(options) {
		Object.assign(this.options, options);
		this.resize();
	}

	use(name, values = {}) {
		const item = this.programs[name];
		this.gl.useProgram(item.program);
		for (const [key, value] of Object.entries(values)) {
			const location = item.uniforms[key];
			if (location == null) continue;
			if (Array.isArray(value)) this.gl[`uniform${value.length}f`](location, ...value);
			else this.gl.uniform1f(location, value);
		}
		return item;
	}

	bind(texture, unit, location) {
		this.gl.activeTexture(this.gl.TEXTURE0 + unit);
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
		this.gl.uniform1i(location, unit);
	}

	draw(target = null) {
		const gl = this.gl;
		gl.viewport(
			0,
			0,
			target?.width || gl.drawingBufferWidth,
			target?.height || gl.drawingBufferHeight,
		);
		gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer || null);
		gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	}

	splat(target, value) {
		const width = this.root.clientWidth;
		const height = this.root.clientHeight;
		const { overscan, splatRadius, splatStrength } = this.options;
		const inset = (overscan - 1) / 2;
		const point = [
			(this.pointer.x + width * inset) / (width * overscan),
			1 - (this.pointer.y + height * inset) / (height * overscan),
		];
		const program = this.use('splat', {
			u_texel: [1 / target.width, 1 / target.height],
			u_aspect: this.aspect,
			u_point: point,
			u_value: value,
			u_radius: splatRadius,
			u_strength: splatStrength,
		});
		this.bind(target.read().texture, 0, program.uniforms.u_input);
		this.draw(target.write());
		target.swap();
	}

	render(now) {
		this.raf = null;
		if (!this.gl || !this.visible || !this.targets) return;
		const isActive = this.pointer.moved || now < this.activeUntil || this.needsWarmup;
		if (this.isVideo && !isActive) {
			this.canvas.classList.remove('is-ready');
			if (this.videoFrameId !== null) {
				this.image.cancelVideoFrameCallback?.(this.videoFrameId);
				this.videoFrameId = null;
			}
			return;
		}
		const supportsVideoFrames =
			this.isVideo && typeof this.image.requestVideoFrameCallback === 'function';
		if (
			supportsVideoFrames &&
			!this.videoFrameReady &&
			!this.needsWarmup &&
			!this.canvas.classList.contains('is-ready')
		) {
			this.scheduleVideoFrame();
			return;
		}
		const { velocity, dye, pressure, divergence } = this.targets;
		const texel = [1 / velocity.width, 1 / velocity.height];
		if (this.pointer.moved) {
			this.splat(velocity, [this.pointer.dx, -this.pointer.dy, 0]);
			this.splat(dye, [this.options.dyeAmount, 0, 0]);
			this.pointer.moved = false;
		}

		let program = this.use('divergence', { u_texel: texel });
		this.bind(velocity.read().texture, 0, program.uniforms.u_velocity);
		this.draw(divergence);
		program = this.use('pressure', { u_texel: texel });
		this.bind(divergence.texture, 0, program.uniforms.u_divergence);
		for (let i = 0; i < this.options.pressureIterations; i += 1) {
			this.bind(pressure.read().texture, 1, program.uniforms.u_pressure);
			this.draw(pressure.write());
			pressure.swap();
		}
		program = this.use('gradient', { u_texel: texel });
		this.bind(pressure.read().texture, 0, program.uniforms.u_pressure);
		this.bind(velocity.read().texture, 1, program.uniforms.u_velocity);
		this.draw(velocity.write());
		velocity.swap();

		program = this.use('advection', {
			u_texel: texel,
			u_output_texel: texel,
			u_dt: this.options.velocityDt,
			u_dissipation: this.options.velocityDissipation,
		});
		this.bind(velocity.read().texture, 0, program.uniforms.u_velocity);
		this.bind(velocity.read().texture, 1, program.uniforms.u_input);
		this.draw(velocity.write());
		velocity.swap();
		program = this.use('advection', {
			u_texel: texel,
			u_output_texel: texel,
			u_dt: this.options.dyeDt,
			u_dissipation: this.options.dyeDissipation,
		});
		this.bind(velocity.read().texture, 0, program.uniforms.u_velocity);
		this.bind(dye.read().texture, 1, program.uniforms.u_input);
		this.draw(dye.write());
		dye.swap();

		if (
			this.isVideo &&
			(this.videoFrameReady || typeof this.image.requestVideoFrameCallback !== 'function') &&
			this.image.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
		) {
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.imageTexture);
			this.gl.texSubImage2D(
				this.gl.TEXTURE_2D,
				0,
				0,
				0,
				this.gl.RGBA,
				this.gl.UNSIGNED_BYTE,
				this.image,
			);
			this.videoFrameReady = false;
		}
		const position = getComputedStyle(this.image).objectPosition.split(' ').map(parseFloat);
		const mediaWidth = this.isVideo ? this.image.videoWidth : this.image.naturalWidth;
		const mediaHeight = this.isVideo ? this.image.videoHeight : this.image.naturalHeight;
		program = this.use('display', {
			u_texel: texel,
			u_aspect: this.aspect,
			u_image_aspect: mediaWidth / mediaHeight,
			u_focus: [(position[0] || 50) / 100, 1 - (position[1] || 50) / 100],
			u_visible_scale: 1 / this.options.overscan,
			u_displacement: this.options.displacement,
		});
		this.bind(this.imageTexture, 0, program.uniforms.u_image);
		this.bind(velocity.read().texture, 1, program.uniforms.u_velocity);
		this.bind(dye.read().texture, 2, program.uniforms.u_dye);
		this.draw();
		if (this.needsWarmup) {
			this.needsWarmup = false;
			this.canvas.classList.remove('is-ready');
			return;
		}
		this.canvas.classList.add('is-ready');
		if (now < this.activeUntil) {
			if (supportsVideoFrames) this.scheduleVideoFrame();
			else this.schedule();
		}
	}

	scheduleVideoFrame() {
		if (
			!this.isVideo ||
			!this.visible ||
			this.image.paused ||
			this.image.ended ||
			this.videoFrameId !== null ||
			performance.now() >= this.activeUntil ||
			typeof this.image.requestVideoFrameCallback !== 'function'
		)
			return;
		this.videoFrameId = this.image.requestVideoFrameCallback(() => {
			this.videoFrameId = null;
			this.videoFrameReady = true;
			this.schedule();
		});
	}

	schedule() {
		if (this.visible && this.raf === null) this.raf = requestAnimationFrame(this.render);
	}

	destroy() {
		if (this.raf !== null) cancelAnimationFrame(this.raf);
		if (this.videoFrameId !== null) this.image?.cancelVideoFrameCallback?.(this.videoFrameId);
		this.pointerTarget?.removeEventListener('pointermove', this.onPointerMove);
		this.pointerTarget?.removeEventListener('pointerleave', this.onPointerLeave);
		if (this.isVideo) this.image?.removeEventListener('play', this.onVideoPlay);
		this.resizeObserver?.disconnect();
		this.observer?.disconnect();
		this.deleteTargets();
		this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
		this.canvas?.remove();
		this.raf = null;
		this.gl = null;
	}
}
