import { pageLoaders, pageNamespaces } from '../scripts/pages/index.js';

export class PageManager {
	constructor(namespace) {
		this.namespace = namespace;
		this._sections = null;
		this._loadPromise = null;
	}

	_loadSections() {
		if (this._loadPromise) return this._loadPromise;

		if (!pageLoaders[this.namespace]) {
			console.warn(`[PageManager] Không tìm thấy script cho trang: ${this.namespace}`);
			return Promise.resolve([]);
		}

		this._loadPromise = pageLoaders[this.namespace]().then((PageClass) => {
			// Module trả về class, khởi tạo class đó
			this._sections = Object.values(PageClass).flatMap((ExportedItem) => {
				if (typeof ExportedItem === 'function') {
					return [new ExportedItem()];
				} else if (typeof ExportedItem === 'object' && ExportedItem !== null) {
					return Object.values(ExportedItem).map(SectionClass => new SectionClass());
				}
				return [];
			});
			return this._sections;
		}).catch(err => {
			console.error(`[PageManager] Lỗi khi load module cho trang ${this.namespace}:`, err);
			return [];
		});
		return this._loadPromise;
	}

	prepareOnce(data) {
		return this._loadSections().then(() => {
			this._sections?.forEach((section) => {
				if (section.trigger) section.trigger(data);
				if (section.setup) section.setup(data, 'once');
			});
		});
	}

	playOnce(data) {
		this._sections?.forEach((section) => {
			if (section.playOnce) section.playOnce(data);
		});
	}

	initOnce(data) {
		return this.prepareOnce(data).then(() => this.playOnce(data));
	}

	prepareEnter(data) {
		return this._loadSections().then(() => {
			this._sections?.forEach((section) => {
				if (section.trigger) section.trigger(data);
				if (section.setup) section.setup(data, 'enter');
			});
		});
	}

	playEnter(data) {
		this._sections?.forEach((section) => {
			if (section.playEnter) section.playEnter(data);
		});
	}

	initEnter(data) {
		return this.prepareEnter(data).then(() => this.playEnter(data));
	}

	destroy(data) {
		this._sections?.forEach((section) => {
			if (section.destroy) section.destroy();
			if (section.cleanTrigger) section.cleanTrigger();
		});

		this._sections = null;
		this._loadPromise = null;
	}
}

export const PageManagerRegistry = {};

pageNamespaces.forEach((namespace) => {
	PageManagerRegistry[namespace] = new PageManager(namespace);
});
