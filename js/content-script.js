'use strict';

const de_webextApi = {
	download: function(downloadRequest){
		browser.runtime.sendMessage(downloadRequest);
	},
	listen: function(){
		browser.runtime.onMessage.addListener(function(message){
			if (message === 'duplicate_warning') {
				de_button.jerkClass('warning');
			}
		});
	},
	settings: function(){
		browser.storage.onChanged.addListener(function(changes){
			de_contentscript.setSettings({
				minSize: 	changes.minSize.newValue,
				exclusions: changes.exclusions.newValue,
				icon: 		changes.icon.newValue
			});
		});
		browser.storage.local.get(['minSize', 'exclusions', 'icon']).then(function(result){
			de_contentscript.setSettings(result);
		});
	}
};

const de_button = {
	elem: null,
	downloadRequest: {
		src: null,
		originalName: null
	},

	init: function(){
		let that = this,
			btnElem;

		function mouseupListener(event){
			if (!btnElem.classList.contains('click') || !that.downloadRequest.src) {return;}
			de_webextApi.download({
				src: that.downloadRequest.src,
				originalName: event.button === 2 ? that.downloadRequest.originalName : null
			});
			btnElem.classList.remove('click');
		}
		function mousedownListener(event){
			event.preventDefault();
			btnElem.classList.add('click')
		}
		function mouseoutListener(event){
			btnElem.classList.remove('click');
		}

		de_webextApi.listen();

		that.elem = document.createElement('de_tsbutton');
		btnElem = that.elem;
		btnElem.addEventListener('contextmenu', event => event.preventDefault());
		btnElem.addEventListener('mousedown', mousedownListener);
		btnElem.addEventListener('mouseout', mouseoutListener);
		btnElem.addEventListener('mouseup', mouseupListener);
	},

	show: function(x, y, src, originalName){
		let btnElem = this.elem,
			offset = 6;

		this.prepareDL(src, originalName);
		btnElem.style.left = x + offset + 'px';
		btnElem.style.top = y + offset + 'px';
		document.body.appendChild(btnElem);
		setTimeout(() => {btnElem.style.visibility = 'visible';}, 32);
	},

	hide: function(){
		this.prepareDL(null, null);
		this.elem.style.visibility = 'hidden';
	},

	isVisible: function(){
		return this.elem.style.visibility === 'visible';
	},

	emulateClick: function(buttonCode){
		this.jerkClass('implying-click', 'click');
		this.elem.dispatchEvent(new MouseEvent('mouseup', {button: buttonCode}));
	},

	jerkClass: function(...classNames){
		let buttonClasses = this.elem.classList;
		buttonClasses.add(...classNames);
		setTimeout(() => buttonClasses.remove(...classNames), 100);
	},

	prepareDL: function(src, originalName){
		this.downloadRequest = {
			src: src,
			originalName: originalName
		};
	}
};

const de_contentscript = {
	host: document.location.host.replace(/^www\./, ''),
	bgSrc: null,
	srcLocation: null,
	previousSrc: null,
	settings: {
		minSize: null,
		exclusions: []
	},

	init: function(){
		let isSeparateTab = ['image/', 'video/'].indexOf(document.contentType.substr(0, 6)) > -1;

		this.srcLocation = isSeparateTab ? 'baseURI' : 'currentSrc';
		de_button.init();
		de_webextApi.settings();
	},

	setSettings: function(newSettings){
		this.settings.minSize = newSettings.minSize;
		this.settings.exclusions = newSettings.exclusions.split(' ');
		de_button.elem.style.backgroundImage = newSettings.icon;
	},

	nodeTools: {
		hostCrutches: {
			'tumblr.com': function(node, modifier){
				let observer,
					observerLifetime;
				observer = new MutationObserver(function(mutations){
					clearTimeout(observerLifetime);
					de_contentscript.nodeHandler(mutations[mutations.length - 1].target, modifier);
					this.disconnect();
				});
				observer.observe(node, {
					attributes: true,
					childList: false,
					characterData: false,
					attributeFilter: ['src']
				});
				observerLifetime = setTimeout(() => observer.disconnect(), 3000);
			}
		},
		checkForBgSrc: function(node, modifier){
			let bgImg;
			if (!modifier) {return false;}

			bgImg = getComputedStyle(node).getPropertyValue('background-image');
			if (bgImg && bgImg.indexOf('url') === 0) {
				bgImg = bgImg.match(/^url\((.+)\).*/i);
				if (bgImg) {
					de_contentscript.bgSrc = bgImg[1].replace(/(^(\s|"|')|(\s|"|')$)/g, '');
					return true;
				}
			}
			return false;
		},
		filterByTag: function(tagName){
			return (tagName !== 'IMG' && tagName !== 'VIDEO');
		},
		filterBySrc: function(src){
			return (!src || ['http', 'data', 'blob'].indexOf(src.substr(0, 4)) === -1);
		},
		filterByClass: function(classList){
			return de_contentscript.settings.exclusions.some(exclusion => classList.contains(exclusion));
		},
		filterBySize: function(node, modifier){
			let that = de_contentscript,
				buttonPlaceholderSize = 50;

			if (node.tagName === 'IMG' && node.width < buttonPlaceholderSize && node.height < buttonPlaceholderSize) {
				return true;
			}
			if (that.srcLocation === 'baseURI' || node.tagName === 'VIDEO' || modifier) {
				return false;
			}
			if (node.complete && !(node.naturalWidth < that.settings.minSize || node.naturalHeight < that.settings.minSize)) {
				return false;
			}
			return (node.width < that.settings.minSize || node.height < that.settings.minSize);
		},
		processByHost: function(node, modifier){
			let hostHandler = de_contentscript.nodeTools.hostCrutches[de_contentscript.host];
			if (hostHandler) {
				hostHandler(node, modifier);
			}
		}
	},

	isTrash: function(node, modifier){
		let that = de_contentscript;
		if (that.nodeTools.checkForBgSrc(node, modifier)) {
			return false;
		}
		if (
			that.nodeTools.filterByTag(node.tagName) ||
			that.nodeTools.filterBySrc(node[that.srcLocation]) ||
			that.nodeTools.filterByClass(node.classList)
		) {
			return true;
		}
		that.nodeTools.processByHost(node, modifier);
		return that.nodeTools.filterBySize(node, modifier);
	},

	getNodeCoordinates: function(node){
		let nodeRect = node.getBoundingClientRect();
		return {
			x: Math.max(0, nodeRect.left) + window.scrollX,
			y: Math.max(0, nodeRect.top) + window.scrollY
		};
	},

	nodeHandler: function(currentTarget, shiftKey, ctrlKey){
		let that = de_contentscript,
			src = currentTarget[that.srcLocation],
			coords;

		if (!currentTarget || ctrlKey || currentTarget.tagName === 'DE_TSBUTTON') {return;}
		if (!src || src !== that.previousSrc) {
			de_button.hide();
		}
		if (that.isTrash(currentTarget, shiftKey)) {
			return;
		}
		that.previousSrc = src;
		coords = that.getNodeCoordinates(currentTarget);
		de_button.show(
			coords.x,
			coords.y,
			src || currentTarget.src || that.bgSrc,
			that.originalFilenameGrabber(currentTarget)
		);
		that.bgSrc = null;
	},

	originalFilenameGrabber: function(node){
		let gettersInfo = {
				'boards.4chan.org': {
					containerSelector: '.fileText',
					parentLevels: {'VIDEO': 1, 'IMG': 2},
					getFilename: function(container){
						let a,
							conTitle = container.title;
						if (conTitle) {
							return conTitle;
						}
						a = container.querySelector('a');
						return a ? (a.title || a.innerHTML) : null;
					},
				},
				'2ch.hk': {
					containerSelector: 'figcaption a',
					parentLevels: {'VIDEO': 2, 'IMG': 3},
					getFilename: function(container){
						return container.title || container.innerHTML;
					},
				},
				'iichan.hk': {
					containerSelector: '.filesize em',
					parentLevels: {'IMG': 2},
					getFilename: function(container){
						let match,
							str = container.innerHTML;
						if (!str) {return null;}
						match = str.match(/[^(, )]+,\s[^(, )]+,\s(.+)/);
						return match ? match[1] : null;
					},
				},
				'boards.fireden.net': {
					containerSelector: '.post_file a.post_file_filename',
					parentLevels: {'IMG': 3},
					getFilename: function(container){
						return container.title || container.innerHTML;
					},
				},
				'exhentai.org': {
					containerSelector: 'div#i2 div:nth-child(2)',
					parentLevels: {'IMG': 3},
					getFilename: function(container){
						let str = container.innerHTML;
						if (!str) {return null;}
						return str.substr(0, str.indexOf(' :: '));
					},
				},
			},
			aliases = {'yuki.la': 'boards.4chan.org'},
			getter = gettersInfo[this.host] || gettersInfo[aliases[this.host]],
			parent = node,
			container;

		if (!getter || this.srcLocation === 'baseURI') {return null;}
		for (let i = 0, parentLevel = getter.parentLevels[node.tagName]; i < parentLevel; i++) {
			parent = parent.parentNode;
		}
		container = parent.querySelector(getter.containerSelector);

		return container ? getter.getFilename(container) : null;
	}
};

const de_tsblisteners = {
	mouseoverListener: function(event){
		de_contentscript.nodeHandler(event.target, event.shiftKey, event.ctrlKey);
	},
	keydownListener: function(event){
		if (event.keyCode === 32 && de_button.isVisible()) {event.preventDefault();}
	},
	keyupListener: function(event){
		if (event.keyCode === 32 && de_button.isVisible()) {de_button.emulateClick(event.ctrlKey ? 2 : 0);}
		if (event.keyCode === 81 && event.altKey) {de_button.hide();}
	}
};

window.addEventListener('mouseover', de_tsblisteners.mouseoverListener);
window.addEventListener('keydown', de_tsblisteners.keydownListener);
window.addEventListener('keyup', de_tsblisteners.keyupListener);

de_contentscript.init();
