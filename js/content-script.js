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
		let settingsList = ['minSize', 'exclusions', 'icon', 'originalNameByDefault'];

		browser.storage.onChanged.addListener(function(changes){
			let newSettings = {};
			settingsList.forEach(function(settingName){
				newSettings[settingName] = changes[settingName].newValue;
			});
			de_settings.setSettings(newSettings);
		});
		browser.storage.local.get(settingsList).then(function(result){
			de_settings.setSettings(result);
		});
	}
};

const de_settings = {
	minSize: null,
	exclusions: [],
	originalNameButton: null,

	setSettings: function(newSettings){
		this.minSize = newSettings.minSize;
		this.exclusions = newSettings.exclusions.split(' ');
		this.originalNameButton = newSettings.originalNameByDefault ? 0 : 2;
		de_button.elem.style.backgroundImage = newSettings.icon;
	},
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
				originalName: event.button === de_settings.originalNameButton ? that.downloadRequest.originalName : null
			});
			if (event.button === 1) { //TODO move this call from here to background script listener, so filename could be copied too
				that.copyToClipboard(that.downloadRequest.src); //TODO copy filename (maybe filepath too) instead if some modifier was pressed
			}
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

		that.elem = document.createElement('de_cbutton');
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
	},

	copyToClipboard: function(string){
		let clpbrd = document.createElement('input'),
			body = document.body;

		body.appendChild(clpbrd);
		clpbrd.value = string;
		clpbrd.select();
		document.execCommand('copy');
		body.removeChild(clpbrd);
	}
};

const de_contentscript = {
	host: document.location.host.replace(/^www\./, ''),
	bgSrc: null,
	srcLocation: null,
	previousSrc: null,

	init: function(){
		let isSeparateTab = ['image/', 'video/'].indexOf(document.contentType.substr(0, 6)) > -1;

		this.srcLocation = isSeparateTab ? 'baseURI' : 'currentSrc';
		de_button.init();
		de_webextApi.settings();
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
			if (bgImg) {
				let bgUrlMatches = bgImg.match(/^url\([\s"']*(https?:\/\/[^\s"']+)[\s"']*\).*/i);
				if (bgUrlMatches) {
					de_contentscript.bgSrc = bgUrlMatches[1];
					return true;
				}
			}
			return false;
		},
		filterByTag: function(tagName){
			return (tagName !== 'IMG' && tagName !== 'VIDEO');
		},
		filterBySrc: function(src){
			return (!src || src.indexOf('http') !== 0);
		},
		filterByClass: function(classList){
			return de_settings.exclusions.some(exclusion => classList.contains(exclusion));
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
			if (node.complete && !(node.naturalWidth < de_settings.minSize || node.naturalHeight < de_settings.minSize)) {
				return false;
			}
			return (node.width < de_settings.minSize || node.height < de_settings.minSize);
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

		if (!currentTarget || ctrlKey || currentTarget.tagName === 'DE_CBUTTON') {return;}
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
