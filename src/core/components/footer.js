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
		this.svgAnimation();
		const marquee = new Marquee(this.el.querySelector('.footer-marquee-inner'));
		marquee.setup();
		
		this.startTime();
	}

	startTime() {
		const hourEl = this.el.querySelector('.time-h');
		const minEl = this.el.querySelector('.time-m');
		const secEl = this.el.querySelector('.time-s');
		
		if (!hourEl || !minEl || !secEl) return;
		
		const update = () => {
			// Lấy thời gian hiện tại
			const now = new Date();
			
			// Định dạng 2 chữ số (ví dụ: 09 thay vì 9)
			const h = String(now.getHours()).padStart(2, '0');
			const m = String(now.getMinutes()).padStart(2, '0');
			const s = String(now.getSeconds()).padStart(2, '0');
			
			// Chỉ cập nhật DOM nếu có sự thay đổi để tối ưu hiệu năng
			if (hourEl.textContent !== h) hourEl.textContent = h;
			if (minEl.textContent !== m) minEl.textContent = m;
			if (secEl.textContent !== s) secEl.textContent = s;
		};
		
		update(); // Gọi ngay lần đầu tiên
		this.timeInterval = setInterval(update, 1000);
	}

	svgAnimation() {
		const svgWrap = this.el.querySelector('.footer-top-ic');
		const svgEl = this.el.querySelector('.footer-top-ic-main svg');
		const paths = this.el.querySelectorAll('.footer-top-ic-main svg path');

		// Nhóm path thành từng cặp (mỗi hình lá gồm 2 path liền nhau)
		const pairs = [];

		for (let i = 0; i < paths.length; i += 2) {
			const pathA = paths[i];
			const pathB = paths[i + 1] || null;

			const bboxA = pathA.getBBox();
			const cxA = bboxA.x + bboxA.width / 2;
			const cyA = bboxA.y + bboxA.height;
			pathA.style.transformOrigin = `${cxA}px ${cyA}px`;

			let cxB, cyB;
			if (pathB) {
				const bboxB = pathB.getBBox();
				cxB = bboxB.x + bboxB.width / 2;
				cyB = bboxB.y + bboxB.height;
				pathB.style.transformOrigin = `${cxB}px ${cyB}px`;
			}

			// Tâm trung bình của cặp
			const pairCx = pathB ? (cxA + cxB) / 2 : cxA;
			const pairCy = pathB ? ((bboxA.y + bboxA.height / 2) + (pathB ? (paths[i + 1].getBBox().y + paths[i + 1].getBBox().height / 2) : 0)) / 2 : bboxA.y + bboxA.height / 2;

			pairs.push({
				els: pathB ? [pathA, pathB] : [pathA],
				cx: pairCx,
				cy: pairCy,
				active: false
			});
		}

		const RADIUS = 150; // Bán kính ảnh hưởng khi hover (pixel trong hệ SVG)

		svgWrap.addEventListener('mousemove', (e) => {
			const rect = svgEl.getBoundingClientRect();

			// Chuyển toạ độ chuột sang hệ toạ độ SVG
			const viewBox = svgEl.viewBox.baseVal;
			const scaleX = (viewBox ? viewBox.width : 1268) / rect.width;
			const scaleY = (viewBox ? viewBox.height : 622) / rect.height;
			const mouseX = (e.clientX - rect.left) * scaleX;
			const mouseY = (e.clientY - rect.top) * scaleY;

			pairs.forEach((pair) => {
				const dx = pair.cx - mouseX;
				const dy = pair.cy - mouseY;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < RADIUS) {
					if (!pair.active) {
						pair.els.forEach(el => el.style.transform = 'scale(1)');
						pair.active = true;
					}
				} else {
					if (pair.active) {
						pair.els.forEach(el => el.style.transform = 'scale(0)');
						pair.active = false;
					}
				}
			});
		});

		// Khi rời chuột khỏi vùng SVG, ẩn hết
		svgWrap.addEventListener('mouseleave', () => {
			pairs.forEach((pair) => {
				pair.els.forEach(el => el.style.transform = 'scale(0)');
				pair.active = false;
			});
		});
	}
	animationReveal() {
		this.svgAnimation();
	}
	destroy() {
		super.cleanTrigger();
		if (this.timeInterval) {
			clearInterval(this.timeInterval);
		}
	}
}

export const footer = new Footer();