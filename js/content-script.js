'use strict';

const de_webextApi = {
    download: function(downloadRequest){
        browser.runtime.sendMessage(Object.assign(downloadRequest, {type: 'download'}));
    },
    getStyle: function(){
        browser.runtime.sendMessage({type: 'style'});
    },
    listen: function(){
        browser.runtime.onMessage.addListener(function(message){
            switch (message) {
                case 'on'               : {de_listeners.switch(true); break;}
                case 'off'              : {de_listeners.switch(false); break;}
                case 'css_injected'     : {de_button.styled = true; break;}
                case 'duplicate_warning': {de_button.jerkClass('warning'); break;}
            }
        });
    },
    settings: function(){
        browser.storage.onChanged.addListener(function(changes){
            const newSettings = {},
                changesList = Object.keys(changes);

            if (changesList.toString() === 'isCute') {
                de_listeners.switch(changes.isCute.newValue);
                return; // click on browser_action button changes only "isCute" setting
            }

            changesList.forEach(function(settingName){
                newSettings[settingName] = changes[settingName].newValue;
            });
            de_settings.setSettings(newSettings);
        });
        browser.storage.local.get().then(function(items){
            de_settings.setSettings(items);
        });
    },
};

const de_settings = {
    selectedSavePath: null,

    setSettings: function(newSettings){
        this.minSize = newSettings.minSize;
        this.saveOnHover = newSettings.saveOnHover;
        this.saveFullSized = newSettings.saveFullSized;
        this.showSaveDialog = newSettings.showSaveDialog;
        this.defaultSavePath = newSettings.defaultSavePath;
        this.placeUnderCursor = newSettings.placeUnderCursor;
        this.forbidDuplicateFiles = newSettings.forbidDuplicateFiles;
        this.exclusions = newSettings.exclusions.split(' ');
        this.originalNameButton = newSettings.originalNameByDefault ? 0 : 2;
        [this.vertical, this.horizontal] = newSettings.position.split('-');
        de_button.elem.style.backgroundImage = newSettings.icon;
        de_button.elem.classList.toggle('shy', newSettings.hideButton);
        de_listeners.switch(newSettings.isCute);
        Object.assign(de_hotkeys.list, this.prepareHotkeysList(newSettings.folders), de_hotkeys.reserved)
    },

    prepareHotkeysList: function(folders){
        const hotkeys = {};

        folders.forEach(function(folder){
            if (!folder.id) { // to generate ids for old hotkeys created before ids existed, remove later
            	const pseudoEvent = {keyCode: folder.keyCode};
            	pseudoEvent[folder.modifier] = true;
            	folder.id = de_hotkeys.buildHotkeyId(pseudoEvent);
            }
            hotkeys[folder.id] = folder;
        });

        return hotkeys;
    },
};

const de_button = {
    elem: null,
    name: 'DE_CBUTTON',
    styled: false,
    downloadRequest: {
        src             : null,
        originalName    : null,
        backupName      : null,
        showSaveDialog  : null,
    },

    init: function(){
        const that = this;

        that.elem = document.createElement(that.name);
        that.elem.id = 'de-cute-id';
        that.elem.addEventListener('contextmenu', that.disableEvent);
        that.elem.addEventListener('mouseout', that.unclick);

        Object.keys(that.globalEventsHandlers).forEach(function(eventName){
            document.addEventListener(eventName, that.overrideEvent, {capture: true});
        });
    },

    overrideEvent: function(event){
        let that = de_button;
        if (event.target.nodeName !== that.name) {return;}

        that.disableEvent(event);
        that.globalEventsHandlers[event.type](event.button);
    },
    
    globalEventsHandlers: {
        mouseup: function(eventButton){
            const that = de_button,
                btnElem = that.elem,
                downloadRequest = Object.assign(
                    {path: de_settings.selectedSavePath || de_settings.defaultSavePath},
                    that.downloadRequest,
                    that.isOriginalNameButton(eventButton) ? {} : {originalName: null}
                ),
                historyEntry = JSON.stringify(downloadRequest);

            if (
                !btnElem.classList.contains('click') ||
                !that.downloadRequest.src ||
                (de_settings.forbidDuplicateFiles && de_contentscript.downloadsHistory.includes(historyEntry))
            ) {
                that.unclick();
                return;
            }

            de_webextApi.download(downloadRequest);
            de_settings.selectedSavePath = null;
            de_contentscript.rememberDownload(historyEntry);
            if (eventButton === 1) {
                that.copyToClipboard(that.downloadRequest.src);
            }
            that.unclick();
        },

        mousedown: function(){
            de_button.elem.classList.add('click');
        },
        
        click: function(){},
    },

    disableEvent: function(event){
        event.stopPropagation();
        event.preventDefault();
    },

    show: function(position, src, originalName){
        const btnElem = this.elem;

        if (!this.styled) {
            de_webextApi.getStyle();
        }
        this.prepareDL(src, originalName);
        btnElem.style.top = position.top;
        btnElem.style.bottom = position.bottom;
        btnElem.style.left = position.left;
        btnElem.style.right = position.right;
        position.container.appendChild(btnElem);
        setTimeout(() => btnElem.classList.add('visible'), 32);
    },

    hide: function(){
        this.prepareDL(null, null);
        this.elem.classList.remove('visible');
    },

    unclick: function(){
        de_button.elem.classList.remove('click');
    },

    isVisible: function(){
        return this.elem.classList.contains('visible');
    },

    emulateClick: function(buttonCode = 0){
        this.jerkClass('implying-click', 'click');
        this.elem.dispatchEvent(new MouseEvent('mouseup', {button: buttonCode}));
    },

    jerkClass: function(...classNames){
        const buttonClasses = this.elem.classList;
        buttonClasses.add(...classNames);
        setTimeout(() => buttonClasses.remove(...classNames), 100);
    },

    prepareDL: function(src, originalName){
        this.downloadRequest = {
            src             : src,
            originalName    : originalName,
            backupName      : (src && de_contentscript.isSeparateTab) ? document.title : null,
            showSaveDialog  : de_settings.showSaveDialog
        };
    },

    isOriginalNameButton: function(eventButton){
        return eventButton === de_settings.originalNameButton;
    },

    copyToClipboard: function(string){
        const clpbrd = document.createElement('input'),
            body = document.body;

        body.appendChild(clpbrd);
        clpbrd.value = string;
        clpbrd.select();
        document.execCommand('copy');
        body.removeChild(clpbrd);
    },
};

const de_contentscript = {
    host            : null,
    bgSrc           : null,
    actualNode      : null,
    srcLocation     : null,
    previousSrc     : null,
    isSeparateTab   : null,
    dollchanImproved: null,
    historyTimer    : null,
    downloadsHistory: [],

    init: function(){
        this.host = this.getFilteredHost();
        this.isSeparateTab = document.contentType.startsWith('image/') || document.contentType.startsWith('video/');
        this.srcLocation = this.isSeparateTab ? 'baseURI' : 'currentSrc';
        window.addEventListener('load', e => this.dollchanImproved = !!document.querySelector('#de-main'), {once: true});

        de_button.init();
        de_webextApi.listen();
        de_webextApi.settings();
        de_webextApi.getStyle();
    },

    getFilteredHost: function(){
        return document.location.host.replace(/^www\./, '').replace(/(.*)\.(tumblr\.com)$/, '$2');
    },

    rememberDownload: function(url){
        const historyLen = 50;
        if (!de_settings.forbidDuplicateFiles) {return;}
        (this.downloadsHistory = this.downloadsHistory.slice(-historyLen + 1)).push(url);
        this.refreshHistoryLifetime();
    },

    refreshHistoryLifetime: function(){
        const historyLifetime = 300000; // 5 minutes
        clearTimeout(this.historyTimer);
        this.historyTimer = setTimeout(() => this.downloadsHistory = [], historyLifetime);
    },

    nodeTools: {
        observer: new MutationObserver(mutations => {
            const target = mutations.pop().target;
            target.addEventListener('load', e => de_contentscript.nodeHandler(target), {once: true});
        }),

        addSrcObserver: function(node){
            if (node.tagName !== 'IMG') {return;}
            this.observer.disconnect();
            this.observer.observe(node, {
                attributes      : true,
                childList       : false,
                characterData   : false,
                attributeFilter : ['src']
            });
        },
        checkForBgSrc: function(node, modifier){
            let bgImg;
            if (!modifier) {return false;}

            bgImg = getComputedStyle(node).getPropertyValue('background-image');
            if (bgImg) {
                const bgUrlMatches = bgImg.match(/^url\([\s"']*(https?:\/\/[^\s"']+)[\s"']*\).*/i);
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
            return (!src || !src.startsWith('http') || src.startsWith('https://www.google.com/recaptcha/'));
        },
        filterByClass: function(classList){
            return de_settings.exclusions.some(exclusion => classList.contains(exclusion));
        },
        filterBySize: function(node, modifier){
            const buttonPlaceholderSize = 50;
            if (node.tagName === 'IMG' && (node.width < buttonPlaceholderSize || node.height < buttonPlaceholderSize)) {
                return true;
            }
            if (de_contentscript.isSeparateTab || node.tagName === 'VIDEO' || modifier) {
                return false;
            }
            if (node.complete && !(node.naturalWidth < de_settings.minSize || node.naturalHeight < de_settings.minSize)) {
                return false;
            }
            return (node.width < de_settings.minSize || node.height < de_settings.minSize);
        },
        deepSearchHostSpecific: function(node){
            const that = de_contentscript,
                crutches = {
                    'twitter.com': () => xpath('self::div[contains(@class, "GalleryNav")]/preceding-sibling::div[@class="Gallery-media"]/img', node),
                    'tumblr.com': () => xpath('self::a/parent::div[@class="photo-wrap"]/img', node),
                };

            that.actualNode = crutches[that.host] && crutches[that.host]();
            return !!that.actualNode;
        },
    },

    isTrash: function(node, modifier){
        const tools = de_contentscript.nodeTools;
        if (
            tools.checkForBgSrc(node, modifier) ||
            tools.deepSearchHostSpecific(node)
        ) {
            return false;
        }
        if (tools.filterByTag(node.tagName)) {
        	return true;
        }
        tools.addSrcObserver(node);
        if (
            tools.filterBySrc(node[de_contentscript.srcLocation]) ||
            tools.filterByClass(node.classList)
        ) {
            return true;
        }
        return tools.filterBySize(node, modifier);
    },

    isPositioned: function(node){
        return window.getComputedStyle(node).position !== 'static';
    },

    getPosition: function(node){
        const nodeRect = node.getBoundingClientRect(),
            offset = 6,
            reverseOffset = 38, // offset + button width (32px)
            position = {},
            getMinOffset = sideSize => sideSize === 0 ? -999999 : 0; //crutch(?) for tumblr for image containers with 0px width/height
        let parentRect;

        const sizeGettersRegular = {
            left    : () => Math.max(0, nodeRect.left) + offset,
            top     : () => Math.max(0, nodeRect.top) + offset,
            right   : () => Math.min(document.documentElement.clientWidth, nodeRect.right) - reverseOffset,
            bottom  : () => Math.min(document.documentElement.clientHeight, nodeRect.bottom) - reverseOffset,
        };
        const sizeGettersInPositioned = {
            left    : () => nodeRect.left - parentRect.left - Math.min(0, nodeRect.left),
            top     : () => nodeRect.top - parentRect.top - Math.min(0, nodeRect.top),
            right   : () => parentRect.right - nodeRect.right + Math.max(0, nodeRect.right - document.documentElement.clientWidth),
            bottom  : () => parentRect.bottom - nodeRect.bottom + Math.max(0, nodeRect.bottom - document.documentElement.clientHeight),
        };

        if (this.isPositioned(node.offsetParent)) {
            parentRect = node.offsetParent.getBoundingClientRect();
            position.container = node.offsetParent;
            position[de_settings.horizontal] = Math.max(getMinOffset(parentRect.width), sizeGettersInPositioned[de_settings.horizontal]()) + offset + 'px';
            position[de_settings.vertical] = Math.max(getMinOffset(parentRect.height), sizeGettersInPositioned[de_settings.vertical]()) + offset + 'px';
        } else {
            position.container = document.body;
            position.left = sizeGettersRegular[de_settings.horizontal]() + window.scrollX + 'px';
            position.top = sizeGettersRegular[de_settings.vertical]() + window.scrollY + 'px';
        }

        return position;
    },

    getPositionUnderCursor: function(mouseEvent){
        if (!mouseEvent.target) {return null;}
        return mouseEvent.target.offsetParent && this.isPositioned(mouseEvent.target.offsetParent) ? {
            container: mouseEvent.target.offsetParent,
            left: mouseEvent.layerX + 'px',
            top: mouseEvent.layerY + 'px'
        } : {
            container: document.body,
            left: mouseEvent.clientX + window.scrollX + 'px',
            top: mouseEvent.clientY + window.scrollY + 'px'
        };
    },

    nodeHandler: function(currentTarget, event = {}){
        const that = de_contentscript,
            src = currentTarget[that.srcLocation];

        if (!currentTarget || (event.ctrlKey && !event.altKey)) {return;}
        if (!src || src !== that.previousSrc) {
            de_button.hide();
        }
        if (that.isTrash(currentTarget, event.shiftKey)) {
            return;
        }
        that.previousSrc = src;
        currentTarget = that.actualNode || currentTarget;

        de_button.show(
            Object.assign(
                {left: null, top: null, right: null, bottom: null}, // only two position properties would be set at once, other two are null on purpose to reset their default values
                (de_settings.placeUnderCursor && that.getPositionUnderCursor(event)) || that.getPosition(currentTarget)
            ),
            that.getOriginalSrc(currentTarget) || src || currentTarget.src || that.bgSrc,
            that.getOriginalFilename(currentTarget)
        );

        if (event.ctrlKey && event.altKey && de_settings.saveOnHover) {
            de_button.emulateClick();
            de_button.jerkClass('visible');
        }

        that.bgSrc = null;
        that.actualNode = null;
    },

    getOriginalSrc: function(node){
        const getters = {
                'vk.com': function(){
                    const info = JSON.parse(node.getAttribute('onclick').match(/^.*"?temp"? *: *({[^{}]+}).*$/)[1]);
                    return info['base'] + (info['w_'] || info['z_'] || info['y_'])[0] + '.jpg';
                },
                'twitter.com': function(){
                    return node.currentSrc.replace(/(jpg|jpeg|png)(:[a-z0-9]+)?$/i, '$1:orig');
                },
                'tumblr.com': function(){
                    return node.currentSrc.replace(/^.+\/([a-z0-9]{32}\/tumblr_\w+)(_\d{2,4}).(jpg|jpeg|png)$/i, 'https://s3.amazonaws.com/data.tumblr.com/$1_raw.$3');
                },
            },
            getter = getters[this.host];
        let originalSrc = null;

        if (!de_settings.saveFullSized || !getter) {return null;}
        try {
            originalSrc = getter();
        } catch (e) {} //tfw no safe navigation operator in 2017

        return originalSrc;
    },

    getOriginalFilename: function(node){
        const getters = {
                'boards.4chan.org': () => {
                    const container = xpath('ancestor::div[contains(concat(" ", normalize-space(@class), " "), " file ")]//*[(@class="fileText" and @title) or self::a]', node);
                    return container.title || container.textContent;
                },
                '2ch.hk': () => {
                    const container = xpath('ancestor::figure[@class="image"]/figcaption/a', node);
                    return container.title || container.textContent;
                },
                'iichan.hk': () => {
                    return xpath('../preceding-sibling::span[@class="filesize"]/em', node).textContent.split(', ')[2];
                },
                'boards.fireden.net': () => {
                    const container = xpath('(../following-sibling::div[@class="post_file"]|../../preceding-sibling::div[@class="post_file"])/a[@class="post_file_filename"]', node);
                    return container.title || container.textContent;
                },
                '8ch.net': () => {
                    const container = xpath('../preceding-sibling::p[@class="fileinfo"]/span[@class="unimportant"]/a', node);
                    return container.title || container.textContent;
                },
            },
            aliases = {'yuki.la': 'boards.4chan.org'},
            getter = getters[this.host] || getters[aliases[this.host]];
        let originalFilename = null;

        function tryFilenameFromDollchanImageByCenter(){
            let filenameTry;
            if (!de_contentscript.dollchanImproved) {return null;}
            filenameTry = xpath('following-sibling::div[@class="de-fullimg-info" and contains(ancestor::div[1]/@class, "de-fullimg-wrap-center")]/a[@class="de-fullimg-src" and text() != "Spoiler Image"]', node);

            return filenameTry ? filenameTry.textContent : null;
        }

        if (!getter || this.isSeparateTab) {return null;}
        try {
            originalFilename = tryFilenameFromDollchanImageByCenter() || getter();
        } catch (e) {} //tfw still no safe navigation operator

        return originalFilename;
    },
};

const de_listeners = {
    mouseoverListener: function(event){
        if (event.target.tagName === de_button.name || (event.relatedTarget && event.relatedTarget.tagName === de_button.name)) {return;}
        de_contentscript.nodeHandler(event.target, event);
    },
    keydownListener: function(event){
        if (de_hotkeys.isHotkeyPossible(event) && de_hotkeys.isHotkeyExists(de_hotkeys.buildHotkeyId(event))) {
            event.preventDefault();
        }
    },
    keyupListener: function(event){
        const hotkeyId = de_hotkeys.buildHotkeyId(event);

        if (hotkeyId === de_hotkeys.hide) {
            de_button.hide();
            return;
        }
        if (!de_hotkeys.isHotkeyPossible(event) || !de_hotkeys.isHotkeyExists(hotkeyId)) {
        	return;
        }

        de_settings.selectedSavePath = de_hotkeys.list[hotkeyId].path;
        de_button.emulateClick(hotkeyId === '10032' ? 2 : 0);
    },

    switch: function(turnOn = true){
        const functionName = turnOn ? 'addEventListener' : 'removeEventListener';
        window[functionName]('mouseover', de_listeners.mouseoverListener);
        window[functionName]('keydown', de_listeners.keydownListener);
        window[functionName]('keyup', de_listeners.keyupListener);
    },
};

const de_hotkeys = {
    list: {},

    hide: '01081', // Alt+Q, hide button

    reserved: {
        '00032': {path: null}, // Space, save to default location
        '10032': {path: null}, // Ctrl+Space, save to default location with original filename
    },

    buildHotkeyId: function(event){
        return `${event.ctrlKey ? 1 : 0}${event.altKey ? 1 : 0}${event.shiftKey ? 1 : 0}${event.keyCode}`;
    },

    isHotkeyPossible: function(event){
        return de_button.isVisible() && ['INPUT', 'TEXTAREA'].indexOf(event.target.tagName) === -1;
    },

    isHotkeyExists: function(hotkeyId){
        return typeof de_hotkeys.list[hotkeyId] !== 'undefined';
    },
};

function xpath(path, contextNode){
    return document.evaluate(path, contextNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

de_contentscript.init();
