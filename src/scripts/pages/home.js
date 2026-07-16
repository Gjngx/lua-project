import { TriggerSetup } from '../../core/trigger-setup.js';
import { gsap } from '../../core/gsap.js';

export class HomeScript extends TriggerSetup {
	setup(data, mode) {
		console.log(`🏠 Home Script Setup (Mode: ${mode})`);
		// Ví dụ: Set thuộc tính mặc định cho các thành phần trang Home
	}

	playOnce(data) {
		console.log("🏠 Home Script Play Once (Tải trang lần đầu)");
		// Ví dụ: Animation lúc web mới load xong
	}

	playEnter(data) {
		console.log("🏠 Home Script Play Enter (Chuyển trang bằng Barba)");
		// Ví dụ: Animation lúc từ trang khác chuyển về Home
	}

	trigger(data) {
		// Gọi hàm setTrigger từ class cha TriggerSetup
		// Ví dụ:
		// const box = data.next.container.querySelector('.box-home');
		// if (box) {
		// 	this.setTrigger(box, () => {
		// 		gsap.fromTo(box, { scale: 0.8 }, { scale: 1, duration: 1, ease: 'back.out(1.7)' });
		// 	});
		// }
	}

	destroy() {
		// Bắt buộc gọi cleanTrigger nếu có dùng ScrollTrigger
		this.cleanTrigger();
		console.log("🧹 Home Script Destroyed (Đã dọn dẹp bộ nhớ)");
	}
}
