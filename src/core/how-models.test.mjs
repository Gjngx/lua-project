import assert from 'node:assert/strict';
import { HowModels } from './how-models.js';

globalThis.window = {
	scrollY: 0,
	matchMedia: () => ({ matches: false }),
};
globalThis.document = { hidden: false };

const controller = new HowModels(null);
let draws = 0;
controller.renderer = {
	domElement: { width: 100, height: 100 },
	render: () => draws++,
};
controller.camera = { aspect: 1 };
controller.schedule = () => {};
const item = (visible) => ({
	visible, width: 100, height: 100, index: 0,
	canvas: { width: 100, height: 100, classList: { add() {} } },
	context: { clearRect() {}, drawImage() {} },
	model: { rotation: { set() {} } },
	dragVelX: 0, dragVelY: 0, dragOffsetX: 0, dragOffsetY: 0,
});
controller.items = [item(true), item(true), item(false)];
controller.render(0);
assert.equal(draws, 2, 'Both visible models must render; offscreen model must not');
for (let frame = 1; frame <= 600; frame++) controller.render(frame * 16.6);
assert.ok(draws >= 596 && draws <= 600, '30fps pacing must retain remainder across RAF jitter');
const beforeHidden = draws;
document.hidden = true;
controller.render(10001);
assert.equal(draws, beforeHidden, 'Hidden tab must not render');
assert.equal(controller.lastRenderTime, null);
console.log('HowModels visibility and frame pacing checks passed');
