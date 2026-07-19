export class Header {
	constructor() {
		this.el = null;
	}
	
	init(data) {
		this.el = document.querySelector(".header");
		if (!this.el) return;
	}
	
	update(data) {
		if (!this.el) return;
		this.el = document.querySelector(".header");
	}
}

export const header = new Header();
