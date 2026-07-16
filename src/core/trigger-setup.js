import { gsap } from './gsap';

/**
 * Base class for scroll-triggered section scripts.
 */
export class TriggerSetup {
	constructor() {
		this.tlTrigger = null;
		this.once = true;
	}
	
	setTrigger(triggerEl, onTrigger) {
		this.tlTrigger = gsap.timeline({
			scrollTrigger: {
				trigger: triggerEl,
				start: "top bottom+=100%",
				end: "bottom top-=100%",
				onEnter: () => {
					if (this.once) {
						this.once = false;
						onTrigger();
					}
				},
				onEnterBack: () => {
					if (this.once) {
						this.once = false;
						onTrigger();
					}
				},
			},
		});
	}
	
	cleanTrigger() {
		if (!this.once) {
			this.once = true;
		}
		if (this.tlTrigger) {
			this.tlTrigger.kill();
			this.tlTrigger = null;
		}
	}
}
