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
			this._sections = Object.values(PageClass).map((SectionClass) => new SectionClass());
			return this._sections;
		}).catch(err => {
			console.error(`[PageManager] Lỗi khi load module cho trang ${this.namespace}:`, err);
			return [];
		});
		return this._loadPromise;
	}

	initOnce(data) {
		return this._loadSections().then(() => {
			this._sections?.forEach((section) => {
				if (section.trigger) section.trigger(data);
				if (section.setup) section.setup(data, 'once');
				if (section.playOnce) section.playOnce(data);
			});
		});
	}

	initEnter(data) {
		return this._loadSections().then(() => {
			this._sections?.forEach((section) => {
				if (section.trigger) section.trigger(data);
				if (section.setup) section.setup(data, 'enter');
				if (section.playEnter) section.playEnter(data);
			});
		});
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
