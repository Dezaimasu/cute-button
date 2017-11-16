'use strict';

const de_webextApi = {
    download: function(downloadRequest){
        browser.runtime.sendMessage(downloadRequest);
    },
    listen: function(){
        browser.runtime.onMessage.addListener(function(message){
            switch (message) {
                case 'on': {de_listeners.switch(true); break;}
                case 'off': {de_listeners.switch(false); break;}
                case 'duplicate_warning': {de_button.jerkClass('warning'); break;}
            }
        });
    },
    settings: function(){
        browser.storage.onChanged.addListener(function(changes){
            let newSettings = {};

            if (Object.keys(changes).toString() === 'isCute') {
                de_listeners.switch(changes.isCute.newValue);
                return; // click on browser_action button changes only "isCute" setting
            }

            de_settings.originalNames.forEach(function(settingName){
                newSettings[settingName] = changes[settingName].newValue;
            });
            de_settings.setSettings(newSettings);
        });
        browser.storage.local.get(de_settings.originalNames).then(function(items){
            de_settings.setSettings(items);
        });
    }
};

const de_settings = {
    originalNames: ['defaultSavePath', 'minSize', 'exclusions', 'icon', 'originalNameByDefault', 'hideButton', 'isCute', 'position', 'folders'],

    selectedSavePath: null,

    setSettings: function(newSettings){
        this.minSize = newSettings.minSize;
        this.folders = newSettings.folders;
        this.keysList = newSettings.folders.map(x => x.keyCode).concat([32]);
        this.defaultSavePath = newSettings.defaultSavePath;
        this.exclusions = newSettings.exclusions.split(' ');
        this.originalNameButton = newSettings.originalNameByDefault ? 0 : 2;
        [this.vertical, this.horizontal] = newSettings.position.split('-');
        de_button.elem.style.backgroundImage = newSettings.icon;
        de_button.elem.classList.toggle('shy', newSettings.hideButton);
        de_listeners.switch(newSettings.isCute);
    },
};

const de_button = {
    elem: null,
    downloadRequest: {
        src         : null,
        originalName: null,
        backupName  : null
    },

    init: function(){
        let that = this,
            btnElem;

        function mouseupListener(event){
            that.disableDefaultClick(event);
            if (!btnElem.classList.contains('click') || !that.downloadRequest.src) {return;}

            de_webextApi.download(Object.assign(
                {path: de_settings.selectedSavePath || de_settings.defaultSavePath},
                that.downloadRequest,
                that.isOriginalNameButton(event) ? {} : {originalName: null}
            ));
            de_settings.selectedSavePath = null;
            if (event.button === 1) {
                that.copyToClipboard(that.downloadRequest.src);
            }
            btnElem.classList.remove('click');
        }
        function mousedownListener(event){
            that.disableDefaultClick(event);
            btnElem.classList.add('click')
        }
        function mouseoutListener(event){
            btnElem.classList.remove('click');
        }

        that.elem = document.createElement('de_cbutton');
        btnElem = that.elem;
        btnElem.id = 'de-cute-id';
        btnElem.classList.add('de-img-full-src'); // crutch for Dollchan Extension Script for expanded by center images
        btnElem.addEventListener('click', that.disableDefaultClick);
        btnElem.addEventListener('contextmenu', that.disableDefaultClick);
        btnElem.addEventListener('mousedown', mousedownListener);
        btnElem.addEventListener('mouseout', mouseoutListener);
        btnElem.addEventListener('mouseup', mouseupListener);
    },

    disableDefaultClick: function(event){
        event.stopPropagation();
        event.preventDefault();
    },

    show: function(position, src, originalName){
        let btnElem = this.elem;

        this.prepareDL(src, originalName);
        btnElem.style.top = position.top;
        btnElem.style.bottom = position.bottom;
        btnElem.style.left = position.left;
        btnElem.style.right = position.right;
        position.container.appendChild(btnElem);
        setTimeout(() => {btnElem.style.visibility = 'visible';}, 32);
    },

    hide: function(){
        this.prepareDL(null, null);
        this.elem.style.visibility = 'hidden';
    },

    isVisible: function(){
        return this.elem.style.visibility === 'visible';
    },

    emulateClick: function(buttonCode = 0){
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
            originalName: originalName,
            backupName: (src && de_contentscript.isSeparateTab) ? document.title : null
        };
    },

    isOriginalNameButton: function(event){
        return event.button === de_settings.originalNameButton;
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
    host            : null,
    bgSrc           : null,
    actualNode      : null,
    srcLocation     : null,
    previousSrc     : null,
    isSeparateTab   : null,
    dollchanImproved: null,

    init: function(){
        this.host = this.getFilteredHost();
        this.isSeparateTab = ['image/', 'video/'].indexOf(document.contentType.substr(0, 6)) > -1;
        this.srcLocation = this.isSeparateTab ? 'baseURI' : 'currentSrc';
        this.dollchanImproved = !!document.querySelector('#de-main');

        de_button.init();
        de_webextApi.listen();
        de_webextApi.settings();
    },

    getFilteredHost: function(){
        return document.location.host.replace(/^www\./, '').replace(/(.*)\.(tumblr\.com)$/, '$2');
    },

    nodeTools: {
        observer: new MutationObserver(mutations => {
            let target = mutations.pop().target;
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
            if (that.isSeparateTab || node.tagName === 'VIDEO' || modifier) {
                return false;
            }
            if (node.complete && !(node.naturalWidth < de_settings.minSize || node.naturalHeight < de_settings.minSize)) {
                return false;
            }
            return (node.width < de_settings.minSize || node.height < de_settings.minSize);
        },
        deepSearchByHost: function(node, modifier){
            let that = de_contentscript,
                crutches = {
                    'twitter.com': () => xpath('self::div[contains(@class, "GalleryNav")]/preceding-sibling::div[@class="Gallery-media"]/img', node)
                };
            if (!modifier) {return false;}

            that.actualNode = crutches[that.host] && crutches[that.host]();
            return !!that.actualNode;
        }
    },

    isTrash: function(node, modifier){
        let tools = de_contentscript.nodeTools;
        if (
            tools.checkForBgSrc(node, modifier) ||
            tools.deepSearchByHost(node, modifier)
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

    getPositionForButton: function(node){
        let nodeRect = node.getBoundingClientRect(),
            parentRect,
            offset = 6,
            reverseOffset = 38, // offset + button width (32px)
            position = {left: null, top: null, right: null, bottom: null},
            getMinOffset = sideSize => sideSize === 0 ? -999999 : 0; //crutch(?) for tumblr for image containers with 0px width/height

        let sizeGettersRegular = {
            left    : () => Math.max(0, nodeRect.left) + offset,
            top     : () => Math.max(0, nodeRect.top) + offset,
            right   : () => Math.min(document.documentElement.clientWidth, nodeRect.right) - reverseOffset,
            bottom  : () => Math.min(document.documentElement.clientHeight, nodeRect.bottom) - reverseOffset,
        };
        let sizeGettersInPositioned = {
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

        return position; // only two position properties are set at once, other two are null on purpose to reset their default values
    },

    nodeHandler: function(currentTarget, shiftKey, ctrlKey){
        let that = de_contentscript,
            src = currentTarget[that.srcLocation];

        if (!currentTarget || ctrlKey) {return;}
        if (!src || src !== that.previousSrc) {
            de_button.hide();
        }
        if (that.isTrash(currentTarget, shiftKey)) {
            return;
        }
        that.previousSrc = src;
        currentTarget = that.actualNode || currentTarget;

        de_button.show(
            that.getPositionForButton(currentTarget),
            that.getOriginalSrc(currentTarget) || src || currentTarget.src || that.bgSrc,
            that.getOriginalFilename(currentTarget)
        );
        that.bgSrc = null;
        that.actualNode = null;
    },

    getOriginalSrc: function(node){
        let getters = {
                'vk.com': function(){
                    let info = JSON.parse(node.getAttribute('onclick').match(/^.*"?temp"? *: *({[^{}]+}).*$/)[1]);
                    return info['base'] + (info['w_'] || info['z_'] || info['y_'])[0] + '.jpg';
                },
                'twitter.com': function(){
                    return node.currentSrc.replace(/(:[a-z0-9]+)?$/i, ':orig');
                },
                'tumblr.com': function(){
                    return node.currentSrc.replace(/(tumblr_[a-z0-9]+)(_\d{2,3}).(jpg|jpeg|png)$/i, '$1_1280.$3');
                },
            },
            getter = getters[this.host],
            originalSrc = null;

        if (!getter || this.isSeparateTab) {return null;}
        try {
            originalSrc = getter();
        } catch (e) {} //tfw no safe navigation operator in 2017

        return originalSrc;
    },

    getOriginalFilename: function(node){
        let getters = {
                'boards.4chan.org': () => {
                    let container = xpath('ancestor::div[@class="file"]//*[(@class="fileText" and @title) or self::a]', node);
                    return container.title || container.innerHTML;
                },
                '2ch.hk': () => {
                    let container = xpath('ancestor::figure[@class="image"]/figcaption/a', node);
                    return container.title || container.innerHTML;
                },
                'iichan.hk': () => {
                    return xpath('../preceding-sibling::span[@class="filesize"]/em', node).innerHTML.match(/([^,]+, ){2}(.+)/)[2];
                },
                'boards.fireden.net': () => {
                    let container = xpath('(../following-sibling::div[@class="post_file"]|../../preceding-sibling::div[@class="post_file"])/a[@class="post_file_filename"]', node);
                    return container.title || container.innerHTML;
                },
                '8ch.net': () => {
                    let container = xpath('../preceding-sibling::p[@class="fileinfo"]/span[@class="unimportant"]/a', node);
                    return container.title || container.innerHTML;
                },
            },
            aliases = {'yuki.la': 'boards.4chan.org'},
            getter = getters[this.host] || getters[aliases[this.host]],
            originalFilename = null;

        function tryFilenameFromDollchanImageByCenter(){
            let filenameTry;
            if (!de_contentscript.dollchanImproved) {return null;}
            filenameTry = xpath('following-sibling::div[@class="de-img-full-info" and ancestor::div[2]/@class="de-img-center"]/a[@class="de-img-full-src" and text() != "Spoiler Image"]', node);

            return filenameTry ? filenameTry.innerHTML : null;
        }

        if (!getter || this.isSeparateTab) {return null;}
        try {
            originalFilename = tryFilenameFromDollchanImageByCenter() || getter();
        } catch (e) {} //tfw still no safe navigation operator

        return originalFilename;
    }
};

const de_listeners = {
    mouseoverListener: function(event){
        if (event.target.tagName === 'DE_CBUTTON' || (event.relatedTarget && event.relatedTarget.tagName === 'DE_CBUTTON')) {return;}
        de_contentscript.nodeHandler(event.target, event.shiftKey, event.ctrlKey);
    },
    keydownListener: function(event){
        if (de_listeners.isHotkeyPossible(event)) {event.preventDefault();}
    },
    keyupListener: function(event){
        if (event.keyCode === 81 && event.altKey) {de_button.hide(); return;}
        if (!de_listeners.isHotkeyPossible(event)) {return;}

        if (event.keyCode === 32) {
            de_settings.selectedSavePath = null;
            de_button.emulateClick(event.ctrlKey ? 2 : 0);
            return;
        }
        for (const folder of de_settings.folders) {
            if (
                folder.keyCode !== event.keyCode ||
                (folder.modifier && !event[folder.modifier]) ||
                (!folder.modifier && (event.shiftKey || event.ctrlKey || event.altKey))
            ) {
                continue;
            }

            de_settings.selectedSavePath = folder.path;
            de_button.emulateClick();
            break;
        }
    },
    
    isHotkeyPossible: function(event){
        return de_button.isVisible() && ['INPUT', 'TEXTAREA'].indexOf(event.target.tagName) === -1 && de_settings.keysList.indexOf(event.keyCode) > -1;
    },

    switch: function(turnOn = true){
        let functionName = turnOn ? 'addEventListener' : 'removeEventListener';

        window[functionName]('mouseover', de_listeners.mouseoverListener);
        window[functionName]('keydown', de_listeners.keydownListener);
        window[functionName]('keyup', de_listeners.keyupListener);
    },
};

function xpath(path, contextNode){
    return document.evaluate(path, contextNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

de_contentscript.init();
