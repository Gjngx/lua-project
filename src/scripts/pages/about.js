import { gsap } from '../../core/gsap.js';
import { footer } from '../../core/components/footer.js';

export const AboutPage = {
	Hero: class {
		constructor() {
			this.el = null;
			this.footerLinkCleanups = [];
		}

		setup(data, mode) {
			this.el = data.next.container.querySelector('.about-hero-wrap');
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

		animationScrub() {

		}

		interact() {
			
		}

		destroy() {
			this.el = null;
		}
	},
	Footer: class {
		setup(data) {
			footer.trigger(data);
		}

		destroy() {
			footer.destroy();
		}
	},
};
