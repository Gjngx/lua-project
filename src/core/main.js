import { initBarba } from './barba';
import { smoothScroll } from './lenis';

const initApp = () => {
	// Khởi tạo Scroll mượt (Lenis)
	smoothScroll.init();

	// Khởi tạo Barba.js
	initBarba();
	
	console.log("🚀 App scripts initialized with GSAP, Barba, and Lenis");
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initApp);
} else {
	initApp();
}
