import { ScrollTrigger } from './gsap';

/**
 * Base class for scroll-triggered section scripts.
 */
export class TriggerSetup {
	constructor() {
		this.stInstance = null;
		this.once = true;
	}
	
	setTrigger(triggerEl, onTrigger) {
		if (this.stInstance) {
			this.stInstance.kill();
		}
		this.stInstance = ScrollTrigger.create({
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
		});
	}
	
	cleanTrigger() {
		if (!this.once) {
			this.once = true;
		}
		if (this.stInstance) {
			this.stInstance.kill();
			this.stInstance = null;
		}
	}
}
