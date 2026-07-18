import { initBarba } from './barba';
import { smoothScroll } from './lenis';
import { scrollTop } from './scroll.js';

const initApp = () => {
	// Khởi tạo Scroll mượt (Lenis)
	smoothScroll.init();
	
	// Trả scroll về đầu trang và refresh ScrollTrigger (như Webflow boilerplate)
	scrollTop();

	// Khởi tạo Barba.js
	initBarba();
	
	console.log("🚀 App scripts initialized with GSAP, Barba, and Lenis");
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initApp);
} else {
	initApp();
}
