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

document.hidden = false;
window.innerHeight = 800;
controller.direct = true;
controller.surfaceDpr = 1.25;
controller.renderer.domElement.getBoundingClientRect =
	() => ({ left: 0, right: 390, top: 200, bottom: 600 });
const viewports = [];
controller.renderer.setScissorTest = () => {};
controller.renderer.clear = () => {};
controller.renderer.clearDepth = () => {};
controller.renderer.setViewport = (...rect) => viewports.push(rect);
controller.renderer.setScissor = () => {};
controller.items.forEach((entry, index) => {
	entry.canvas.getBoundingClientRect = () => ({
		left: index * 300, right: index * 300 + 100,
		top: 300, bottom: 400, width: 100, height: 100,
	});
	entry.context.drawImage = () => assert.fail('Direct WebGL must not copy to Canvas 2D');
});
controller.render(10020);
assert.deepEqual(viewports, [[0, 250, 125, 125], [375, 250, 125, 125]]);
const directDraws = draws;
controller.render(10036);
assert.equal(draws - directDraws, 2, 'Direct rendering must follow each refresh, not the old 30fps cap');
console.log('Direct rendering DPR, visibility and zero-copy checks passed');

let clears = 0;
controller.renderer.clear = () => clears++;
controller.items.forEach((entry) => { entry.visible = false; });
controller.raf = null;
controller.surfaceHasContent = true;
HowModels.prototype.schedule.call(controller);
HowModels.prototype.schedule.call(controller);
assert.equal(clears, 1, 'Offscreen surface must clear once, not on every scroll/schedule');
console.log('Offscreen GPU work check passed');
