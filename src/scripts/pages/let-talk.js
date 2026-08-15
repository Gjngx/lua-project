import { gsap } from '../../core/gsap.js';

export const LetTalkPage = {
	Hero: class {
		constructor() {
			this.el = null;
			this.footerLinkCleanups = [];
		}

		setup(data, mode) {
			this.el = data.next.container.querySelector('.let-talk-wrap');
			if (!this.el) return;
			this.interact();

			if (mode === 'once') {
				this.setupOnce(data);
			} else if (mode === 'enter') {
				this.setupEnter(data);
			}
		}

		setupOnce(data) {
			this.animationScrub();

			this.tlOnce = gsap.timeline({
				paused: true,
			});

			this.animationReveal(this.tlOnce);
		}

		setupEnter(data) {
			this.animationScrub();

			this.tlEnter = gsap.timeline({
				paused: true,
			});

			this.animationReveal(this.tlEnter);
		}

		playOnce() {
			if (this.tlOnce) {
				this.tlOnce.play();
			}
		}

		playEnter() {
			if (this.tlEnter) {
				this.tlEnter.play();
			}
		}

		animationReveal(timeline) {
			
		}

		animationScrub(){

		}
		
		interact() {
			this.footerLinkCleanups.forEach((cleanup) => cleanup());
			this.footerLinkCleanups = [];

			this.el.querySelectorAll('.let-talk-footer-link').forEach((link) => {
				let hoverFrame = null;
				const handleHoverPoint = (event) => {
					const bounds = event.currentTarget.getBoundingClientRect();
					const x = ((event.clientX - bounds.left) / bounds.width) * 100;
					const y = ((event.clientY - bounds.top) / bounds.height) * 100;
					event.currentTarget.style.setProperty('--footer-icon-hover-x', `${x}%`);
					event.currentTarget.style.setProperty('--footer-icon-hover-y', `${y}%`);
				};
				const handlePointerEnter = (event) => {
					handleHoverPoint(event);
					if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
					link.classList.remove('is-hovered');
					getComputedStyle(link, '::before').clipPath;
					hoverFrame = requestAnimationFrame(() => {
						link.classList.add('is-hovered');
						hoverFrame = null;
					});
				};
				const handlePointerLeave = (event) => {
					handleHoverPoint(event);
					if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
					getComputedStyle(link, '::before').clipPath;
					hoverFrame = requestAnimationFrame(() => {
						link.classList.remove('is-hovered');
						hoverFrame = null;
					});
				};

				link.addEventListener('pointerenter', handlePointerEnter, { passive: true });
				link.addEventListener('pointerleave', handlePointerLeave, { passive: true });
				this.footerLinkCleanups.push(() => {
					link.removeEventListener('pointerenter', handlePointerEnter);
					link.removeEventListener('pointerleave', handlePointerLeave);
					if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
					link.classList.remove('is-hovered');
				});
			});
		}

		destroy() {
			this.footerLinkCleanups.forEach((cleanup) => cleanup());
			this.footerLinkCleanups = [];
			this.el = null;
		}
	},
};
