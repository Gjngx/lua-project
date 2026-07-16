export class Footer {
	constructor() {
		this.el = null;
	}
	
	init(data) {
		this.el = document.querySelector(".footer");
		if (!this.el) return;
		
		console.log("Footer initialized");
		// Add your footer setup logic here
	}
	
	update(data) {
		if (!this.el) return;
		
		console.log("Footer updated on page transition");
		// Add your footer update logic here
	}
}

export const footer = new Footer();
