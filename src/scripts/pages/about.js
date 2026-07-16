import { TriggerSetup } from '../../core/trigger-setup.js';

export class AboutScript extends TriggerSetup {
	setup(data, mode) {
		console.log(`ℹ️ About Script Setup (Mode: ${mode})`);
	}

	playOnce(data) {
		console.log("ℹ️ About Script Play Once");
	}

	playEnter(data) {
		console.log("ℹ️ About Script Play Enter");
	}

	trigger(data) {
		// Gọi hàm setTrigger từ class cha TriggerSetup
	}

	destroy() {
		this.cleanTrigger();
		console.log("🧹 About Script Destroyed");
	}
}
