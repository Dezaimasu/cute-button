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
            let newSettings = {};
            de_settings.originalNames.forEach(function(settingName){
                newSettings[settingName] = changes[settingName].newValue;
            });
            de_settings.setSettings(newSettings);
        });
        browser.storage.local.get(de_settings.originalNames).then(function(result){
            de_settings.setSettings(result);
        });
    }
};

const de_settings = {
    originalNames: ['minSize', 'exclusions', 'icon', 'originalNameByDefault', 'hideButton'],

    minSize: null,
    exclusions: [],
    originalNameButton: null,

    setSettings: function(newSettings){ //TODO check if all settings are set, open settings page otherwise
        this.minSize = newSettings.minSize;
        this.exclusions = newSettings.exclusions.split(' ');
        this.originalNameButton = newSettings.originalNameByDefault ? 0 : 2;
        de_button.elem.style.backgroundImage = newSettings.icon;
        de_button.elem.classList.toggle('shy', newSettings.hideButton);
    },
};

const de_button = {
    elem: null,
    downloadRequest: {
        src: null,
        originalName: null,
        backupName: null,
    },

    init: function(){
        let that = this,
            btnElem;

        function mouseupListener(event){
            if (!btnElem.classList.contains('click') || !that.downloadRequest.src) {return;}
            if (event.button !== de_settings.originalNameButton) {
                that.downloadRequest.originalName = null;
            }
            de_webextApi.download(that.downloadRequest);
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

    show: function(attachTo, src, originalName){
        let btnElem = this.elem,
            offset = 6;

        this.prepareDL(src, originalName);
        btnElem.style.left = attachTo.x + offset + 'px';
        btnElem.style.top = attachTo.y + offset + 'px';
        (attachTo.elem || document.body).appendChild(btnElem);
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
    isSeparateTab: null,

    init: function(){
        this.isSeparateTab = ['image/', 'video/'].indexOf(document.contentType.substr(0, 6)) > -1;
        this.srcLocation = this.isSeparateTab ? 'baseURI' : 'currentSrc';

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

    getNodeCoordinates: function(node){
        let nodeRect = node.getBoundingClientRect();
        return {
            x: Math.max(0, nodeRect.left) + window.scrollX,
            y: Math.max(0, nodeRect.top) + window.scrollY
        };
    },

    checkForOverlay: function(node){
        let overlayPath = {
                '2ch.hk': '#fullscreen-container, .de-img-center'
            }[this.host],
            overlayElem;

        if (!overlayPath) {return;}
        overlayElem = document.querySelector(overlayPath);

        return (overlayElem && overlayElem.contains(node)) ? {
            elem: overlayElem,
            x   : node.offsetLeft,
            y   : node.offsetTop
        } : null;
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
            that.checkForOverlay(currentTarget) || that.getNodeCoordinates(currentTarget),
            that.getOriginalSrc(currentTarget) || src || currentTarget.src || that.bgSrc,
            that.getOriginalFilename(currentTarget)
        );
        that.bgSrc = null;
    },

    getOriginalSrc: function(node){
        let getters = {
                'vk.com': function(){
                    let info = eval('(' + node.getAttribute('onclick').match(/[^{]*({.+})[^}]*/)[1] + ')');
                    return info['temp']['base'] + info['temp']['w_'][0] + '.jpg'; //TODO find actual extension and biggest available resolution instead of "w_"
                },
                'twitter.com': function(){
                    return node.currentSrc + ':orig';
                }
            },
            getter = getters[this.host],
            originalSrc = null;

        if (!getter) {return;}
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

const de_tsblisteners = {
    mouseoverListener: function(event){
        de_contentscript.nodeHandler(event.target, event.shiftKey, event.ctrlKey);
    },
    keydownListener: function(event){
        if (de_tsblisteners.isSpaceHotkey(event)) {event.preventDefault();}
    },
    keyupListener: function(event){
        if (de_tsblisteners.isSpaceHotkey(event)) {de_button.emulateClick(event.ctrlKey ? 2 : 0);}
        if (event.keyCode === 81 && event.altKey) {de_button.hide();}
    },
    
    isSpaceHotkey: function(event){
        return event.keyCode === 32 && de_button.isVisible() && ['INPUT', 'TEXTAREA'].indexOf(event.target.tagName) === -1;
    }
};

window.addEventListener('mouseover', de_tsblisteners.mouseoverListener);
window.addEventListener('keydown', de_tsblisteners.keydownListener);
window.addEventListener('keyup', de_tsblisteners.keyupListener);

de_contentscript.init();
