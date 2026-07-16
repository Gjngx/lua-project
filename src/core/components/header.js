export class Header {
	constructor() {
		this.el = null;
	}
	
	init(data) {
		this.el = document.querySelector(".header");
		if (!this.el) return;
		
		console.log("Header initialized");
		// Add your header setup logic here (e.g. menu toggle, scroll events)
	}
	
	update(data) {
		if (!this.el) return;
		
		console.log("Header updated on page transition");
		// Add your header update logic here (e.g. changing active links based on new namespace)
	}
}

export const header = new Header();
