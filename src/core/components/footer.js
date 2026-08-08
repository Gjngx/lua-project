import { TriggerSetup } from "../trigger-setup";
import { Marquee } from "../helpers";

export class Footer extends TriggerSetup {
	constructor() {
		super();
		this.el = null;
	}
	trigger(data) {
		this.el = document.querySelector(".footer");
		if (this.el) {
			super.setTrigger(this.el, this.onTrigger.bind(this));
		}
	}
	onTrigger() {
		this.setup();
		this.animationReveal();
	}
	setup() {
		if (!this.el) return;
		console.log(this.el);
	}
	animationReveal() {
		
	}
	destroy() {
		super.cleanTrigger();
	}
}

export const footer = new Footer();