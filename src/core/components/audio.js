import bgmSrc from '../../assets/audio/bgm.mp3';

export class AudioManager {
	constructor() {
		this.audio = null;
		this.isPlaying = false;
		this.isInitialized = false;
		this.audioCtx = null;
		this.analyser = null;
		this.dataArray = null;
		this.rects = [];
	}

	init() {
		if (this.isInitialized) return;
		this.isInitialized = true;

		// Tạo thẻ audio từ file đã import qua Vite
		this.audio = new Audio(bgmSrc);
		this.audio.loop = true;
		this.audio.volume = 0.5;

		this.totalAccumulatedTime = 0;
		this.lastAudioTime = 0;

		// Đồng bộ hóa đồng hồ: Đếm dồn thời gian ngay cả khi nhạc lặp lại
		this.audio.addEventListener('timeupdate', () => {
			const currentTime = this.audio.currentTime;
			
			// Phát hiện bài nhạc bị lặp (thời gian đột ngột rớt xuống)
			if (currentTime < this.lastAudioTime - 0.5) {
				this.totalAccumulatedTime += this.lastAudioTime;
			}
			this.lastAudioTime = currentTime;

			const totalSeconds = Math.floor(this.totalAccumulatedTime + currentTime);

			const textEl = document.querySelector('.header-shape-text .txt');
			if (textEl) {
				const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
				const s = (totalSeconds % 60).toString().padStart(2, '0');
				textEl.textContent = `${m}:${s}`;
			}
		});

		// Cố gắng Autoplay ngay lập tức khi load trang
		this.audio.play().then(() => {
			this.isPlaying = true;
			this.setupVisualizer();
		}).catch(err => {
			// Bị chặn -> Hiện popup hỏi người dùng thay vì rình rập
			this.showAudioPopup();
		});
	}
	
	showAudioPopup() {
		const popup = document.createElement('div');
		popup.className = 'audio-popup';
		popup.innerHTML = `
			<p class="audio-popup-text">This website experience is best with audio.<br/> Would you like to turn on the music?</p>
			<div class="audio-popup-btns">
				<button class="audio-btn audio-btn-yes">Play</button>
				<button class="audio-btn audio-btn-no">No, thanks</button>
			</div>
		`;
		
		document.body.appendChild(popup);
		
		requestAnimationFrame(() => {
			popup.classList.add('show');
		});

		const closePopup = () => {
			popup.classList.remove('show');
			setTimeout(() => popup.remove(), 400);
		};

		popup.querySelector('.audio-btn-yes').addEventListener('click', (e) => {
			e.stopPropagation();
			this.play();
			closePopup();
		});

		popup.querySelector('.audio-btn-no').addEventListener('click', (e) => {
			e.stopPropagation();
			closePopup();
		});
	}
	
	setupVisualizer() {
		if (this.audioCtx) return;
		try {
			this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
			const source = this.audioCtx.createMediaElementSource(this.audio);
			this.analyser = this.audioCtx.createAnalyser();
			
			this.analyser.fftSize = 64; // Chia nhỏ tần số
			const bufferLength = this.analyser.frequencyBinCount; // 32 bins
			this.dataArray = new Uint8Array(bufferLength);
			
			source.connect(this.analyser);
			this.analyser.connect(this.audioCtx.destination);
			
			this.renderFrame();
		} catch (e) {
			console.log("AudioContext không khả dụng:", e);
		}
	}

	renderFrame = () => {
		let needsNextFrame = false;
		
		if (!this.rects.length || !document.body.contains(this.rects[0])) {
			this.rects = Array.from(document.querySelectorAll('.header-shape-ic rect'));
		}

		if (this.rects.length === 4) {
			if (this.isPlaying && this.analyser) {
				needsNextFrame = true;
				this.analyser.getByteFrequencyData(this.dataArray);
				
				const getBandValue = (startIndex, endIndex) => {
					let sum = 0;
					for (let i = startIndex; i < endIndex; i++) {
						sum += this.dataArray[i];
					}
					return sum / (endIndex - startIndex);
				};

				const values = [
					getBandValue(0, 3),
					getBandValue(3, 7),
					getBandValue(7, 15),
					getBandValue(15, 31)
				];

				this.rects.forEach((rect, i) => {
					const normalized = values[i] / 255;
					const targetH = 3 + normalized * 15;
					const currentH = parseFloat(rect.getAttribute('height')) || 3;
					const h = currentH + (targetH - currentH) * 0.3; 
					const y = 10 - h / 2; 
					
					rect.setAttribute('height', h.toFixed(2));
					rect.setAttribute('y', y.toFixed(2));
				});
			} else if (!this.isPlaying) {
				this.rects.forEach(rect => {
					const currentH = parseFloat(rect.getAttribute('height')) || 3;
					if (currentH > 3.05) {
						needsNextFrame = true;
						const h = currentH + (3 - currentH) * 0.1;
						const y = 10 - h / 2;
						rect.setAttribute('height', h.toFixed(2));
						rect.setAttribute('y', y.toFixed(2));
					} else if (currentH !== 3) {
						rect.setAttribute('height', 3);
						rect.setAttribute('y', 8.5);
					}
				});
			}
		} else {
			if (this.isPlaying) needsNextFrame = true;
		}

		if (needsNextFrame) {
			this.rafId = requestAnimationFrame(this.renderFrame);
		}
	}

	play() {
		if (this.audio && !this.isPlaying) {
			this.audio.play().then(() => {
				this.isPlaying = true;
				// Resume AudioContext nếu trình duyệt tạm dừng
				if (this.audioCtx && this.audioCtx.state === 'suspended') {
					this.audioCtx.resume();
				}
				this.setupVisualizer();
				
				cancelAnimationFrame(this.rafId);
				this.rafId = requestAnimationFrame(this.renderFrame);
			}).catch(err => {
				// Vẫn bị chặn
			});
		}
	}

	pause() {
		if (this.audio && this.isPlaying) {
			this.audio.pause();
			this.isPlaying = false;
			cancelAnimationFrame(this.rafId);
			this.rafId = requestAnimationFrame(this.renderFrame);
		}
	}

	toggle() {
		if (this.isPlaying) {
			this.pause();
		} else {
			this.play();
		}
	}
}

export const audioManager = new AudioManager();
