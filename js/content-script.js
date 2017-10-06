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
    originalNames: ['minSize', 'exclusions', 'icon', 'originalNameByDefault', 'hideButton', 'isCute', 'position'],

    minSize: null,
    position: null,
    exclusions: [],
    originalNameButton: null,

    setSettings: function(newSettings){
        this.minSize = newSettings.minSize;
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
                {},
                that.downloadRequest,
                that.isOriginalNameButton(event) ? {} : {originalName: null}
            ));
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

        de_webextApi.listen();

        that.elem = document.createElement('de_cbutton');
        btnElem = that.elem;
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
        btnElem.style.left = position.x + 'px';
        btnElem.style.top = position.y + 'px';
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
    srcLocation     : null,
    previousSrc     : null,
    isSeparateTab   : null,

    init: function(){
        this.host = this.getFilteredHost();
        this.isSeparateTab = ['image/', 'video/'].indexOf(document.contentType.substr(0, 6)) > -1;
        this.srcLocation = this.isSeparateTab ? 'baseURI' : 'currentSrc';

        de_button.init();
        de_webextApi.settings();
    },

    getFilteredHost: function(){
        return document.location.host.replace(/^www\./, '').replace(/(.*)\.(tumblr\.com)$/, '$2');
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
            if (that.isSeparateTab || node.tagName === 'VIDEO' || modifier) {
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

    isPositioned: function(node){
        return window.getComputedStyle(node).position !== 'static';
    },

    getPositionForButton: function(node){
        let nodeRect = node.getBoundingClientRect(),
            parentRect,
            offset = 6,
            reverseOffset = 38, // offset + button width (32px)
            position = {};

        let sizeGettersRegular = {
            left    : () => Math.max(0, nodeRect.left) + offset,
            top     : () => Math.max(0, nodeRect.top) + offset,
            right   : () => Math.min(document.documentElement.clientWidth, nodeRect.right) - reverseOffset,
            bottom  : () => Math.min(document.documentElement.clientHeight, nodeRect.bottom) - reverseOffset,
        };
        let sizeGettersInPositioned = {
            left    : () => nodeRect.left - parentRect.left - Math.min(0, nodeRect.left) + offset,
            top     : () => nodeRect.top - parentRect.top - Math.min(0, nodeRect.top) + offset,
            right   : () => nodeRect.right - Math.min(document.documentElement.clientWidth, parentRect.right) - reverseOffset,
            bottom  : () => nodeRect.bottom - Math.min(document.documentElement.clientHeight, parentRect.bottom) - reverseOffset,
        };

        if (this.isPositioned(node.offsetParent)) {
            parentRect = node.offsetParent.getBoundingClientRect();
            position = {
                x: sizeGettersInPositioned[de_settings.horizontal](),
                y: sizeGettersInPositioned[de_settings.vertical](),
                container: node.offsetParent,
            }
        } else {
            position = {
                x: sizeGettersRegular[de_settings.horizontal]() + window.scrollX,
                y: sizeGettersRegular[de_settings.vertical]() + window.scrollY,
                container: document.body,
            }
        }

        console.log(position);
        return position;
    },

    nodeHandler: function(currentTarget, shiftKey, ctrlKey){
        let that = de_contentscript,
            src = currentTarget[that.srcLocation];

        if (!currentTarget || ctrlKey || currentTarget.tagName === 'DE_CBUTTON') {return;}
        if (!src || src !== that.previousSrc) {
            de_button.hide();
        }
        if (that.isTrash(currentTarget, shiftKey)) {
            return;
        }
        that.previousSrc = src;

        de_button.show(
            that.getPositionForButton(currentTarget),
            that.getOriginalSrc(currentTarget) || src || currentTarget.src || that.bgSrc,
            that.getOriginalFilename(currentTarget)
        );
        that.bgSrc = null;
    },

    getOriginalSrc: function(node){
        let getters = {
                'vk.com': function(){
                    let info = JSON.parse(node.getAttribute('onclick').match(/^.*"?temp"? *: *({[^{}]+}).*$/)[1]);
                    return info['base'] + (info['w_'] || info['z_'] || info['y_'])[0] + '.jpg';
                },
                'twitter.com': function(){
                    return node.currentSrc + ':orig';
                },
                'tumblr.com': function(){
                    return node.currentSrc.replace(/(tumblr_[\d\w]+)(_\d{2,3}).(jpg|jpeg|png)$/, '$1_1280.$3');
                }
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

        if (!getter || this.isSeparateTab) {return null;}
        for (let i = 0, parentLevel = getter.parentLevels[node.tagName]; i < parentLevel; i++) {
            parent = parent.parentNode;
        }
        if (parent.nodeName === 'HTML' || parent.nodeName === 'BODY') {return false;}
        container = parent.querySelector(getter.containerSelector);

        return container ? getter.getFilename(container) : null;
    }
};

const de_listeners = {
    mouseoverListener: function(event){
        de_contentscript.nodeHandler(event.target, event.shiftKey, event.ctrlKey);
    },
    keydownListener: function(event){
        if (de_listeners.isSpaceHotkey(event)) {event.preventDefault();}
    },
    keyupListener: function(event){
        if (de_listeners.isSpaceHotkey(event)) {de_button.emulateClick(event.ctrlKey ? 2 : 0);}
        if (event.keyCode === 81 && event.altKey) {de_button.hide();}
    },
    
    isSpaceHotkey: function(event){
        return event.keyCode === 32 && de_button.isVisible() && ['INPUT', 'TEXTAREA'].indexOf(event.target.tagName) === -1;
    },

    switch: function(turnOn = true){
        let functionName = turnOn ? 'addEventListener' : 'removeEventListener';

        window[functionName]('mouseover', de_listeners.mouseoverListener);
        window[functionName]('keydown', de_listeners.keydownListener);
        window[functionName]('keyup', de_listeners.keyupListener);
    },
};

de_contentscript.init();
