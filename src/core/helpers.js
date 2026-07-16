import { gsap, ScrollTrigger } from './gsap.js';

export const childSelect = (parent) => {
	return (child) => child ? parent.querySelector(child) : parent;
}

export const xSetter = (el) => gsap.quickSetter(el, "x", "px");
export const ySetter = (el) => gsap.quickSetter(el, "y", "px");
export const xGetter = (el) => gsap.getProperty(el, "x");
export const yGetter = (el) => gsap.getProperty(el, "y");

export const viewport = {
	get w() { return window.innerWidth; },
	get h() { return window.innerHeight; },
};

let cachedSvh100 = null;
export const getSvh100 = () => {
	if (cachedSvh100 != null) return cachedSvh100;
	const el = document.createElement("div");
	el.style.cssText = "position:fixed;top:0;left:0;height:100svh;width:0;pointer-events:none;visibility:hidden;";
	document.body.appendChild(el);
	cachedSvh100 = el.getBoundingClientRect().height;
	document.body.removeChild(el);
	return cachedSvh100;
};
if (typeof window !== 'undefined') {
	window.addEventListener("resize", () => { cachedSvh100 = null; });
}

export const cvUnit = (val, unit) => {
	let result;
	switch (true) {
		case unit === "vw":
			result = window.innerWidth * (val / 100);
			break;
		case unit === "vh":
			result = (window.innerWidth <= 767 ? getSvh100() : window.innerHeight) * (val / 100);
			break;
		case unit === "svh":
			result = getSvh100() * (val / 100);
			break;
		case unit === "rem":
			result = (val / 10) * parseFloat(getComputedStyle(document.documentElement).fontSize);
			break;
		default:
			break;
	}
	return result;
};

export const isHoverableDevice = () => {
	return window.matchMedia("(hover: hover) and (pointer: fine)").matches && viewport.w > 767;
};

export const isInViewport = (el, orientation = "vertical") => {
	if (!el) return;
	const rect = el.getBoundingClientRect();
	if (orientation == "horizontal") {
		return rect.left <= window.innerWidth && rect.right >= 0;
	} else {
		return rect.top <= window.innerHeight && rect.bottom >= 0;
	}
};

export const isMouseInArea = (el, mousePos) => {
	if (!el) return false;
	const rect = el.getBoundingClientRect();
	return (
		mousePos.x >= rect.left &&
		mousePos.x <= rect.right &&
		mousePos.y >= rect.top &&
		mousePos.y <= rect.bottom
	);
};

export const debounce = (func, timeout = 300) => {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			func.apply(this, args);
		}, timeout);
	};
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const lerp = (a, b, t) => (1 - t) * a + t * b;
export const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const normalize = (mousePos, maxDis) => (mousePos / maxDis - 0.5) * 2;

export const getAllScrollTrigger = (action) => {
	let triggers = ScrollTrigger.getAll();
	triggers.forEach((trigger) => {
		if (action === "refresh") {
			if (trigger.progress === 0) {
				trigger.refresh();
			}
		} else if (action === "kill") {
			trigger.kill(false);
		} else {
			trigger[action]?.();
		}
	});
};

export const isTouchDevice = () => {
	return (('ontouchstart' in window) ||
		(navigator.maxTouchPoints > 0) ||
		(navigator.msMaxTouchPoints > 0));
};

let _heightObserver = null;
let _heightDebounceTimer = null;

export function documentHeightObserver(action, data, callback) {
	let observerEl = viewport.w > 767 ? document.querySelector('body') : data?.next?.container || document.body;
	let previousHeight = observerEl?.scrollHeight;
	function onRefresh() {
		clearTimeout(_heightDebounceTimer);
		_heightDebounceTimer = setTimeout(() => {
			const currentHeight = observerEl.scrollHeight;
			if (currentHeight !== previousHeight) {
				import('./lenis.js').then(({ smoothScroll }) => {
					if (smoothScroll.lenis) {
						smoothScroll.lenis.resize();
						ScrollTrigger.getAll().forEach(trigger => {
							if (trigger.vars.scrub && trigger.progress === 1) {
								return;
							}
							trigger.refresh();
						});
					}
				});
				if (callback) {
					callback();
				}
				previousHeight = currentHeight;
			}
		}, 200);
	}

	if (action === "init") {
		if (!observerEl) return;
		if (_heightObserver) _heightObserver.disconnect();
		_heightObserver = new ResizeObserver(onRefresh);
		_heightObserver.observe(observerEl);
	} else if (action === "disconnect") {
		if (_heightObserver) {
			_heightObserver.disconnect();
			_heightObserver = null;
		}
	}
}

export const isObjectEmpty = (objectName) => {
    return (
        objectName &&
        Object.keys(objectName).length === 0 &&
        objectName.constructor === Object
    );
};
