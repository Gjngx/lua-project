import { initBarba } from './barba';
import { smoothScroll } from './lenis';
import { scrollTop } from './scroll.js';
import { scrollIndicator } from './components/scroll-indicator.js';
import { mouse } from './mouse.js';

const initApp = () => {
	// Khởi tạo Scroll mượt (Lenis)
	smoothScroll.init();

	// Scroll indicator dùng chung, tồn tại xuyên suốt các lần chuyển trang Barba
	scrollIndicator.init();

	// Custom cursor dùng chung, chỉ khởi tạo một lần trên desktop.
	mouse.init();

	// Trả scroll về đầu trang và refresh ScrollTrigger (như Webflow boilerplate)
	scrollTop();

	// Khởi tạo Barba.js
	initBarba();

	console.log('🚀 App scripts initialized with GSAP, Barba, and Lenis');
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initApp);
} else {
	initApp();
}
