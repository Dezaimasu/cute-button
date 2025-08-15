'use strict';

const de_webextApi = {
  download: function(downloadRequest){
    chrome.runtime.sendMessage(Object.assign(downloadRequest, {type: 'download'}));
  },
  getButtonStyle: function(){
    chrome.runtime.sendMessage({type: 'button_style'});
  },
  switchPageStyle: function(style, turnOn = true){
    chrome.runtime.sendMessage({type: 'page_style', style: style, turnOn: turnOn});
  },
  listen: function(){
    chrome.runtime.onMessage.addListener(message => {
      switch (message) {
        case 'css_injected'     : {de_button.styled = true; break;}
        case 'duplicate_warning': {de_button.jerkClass('warning'); break;}
      }
    });
  },
  settings: function(){
    function setSettings(settings, isChanges = false){
      de_hotkeys.reset();

      Object.entries(settings).forEach(([settingName, setting]) => {
        if (settingName.startsWith('~')) {return;}
        const settingValue = isChanges ? setting.newValue : setting;
        de_settings.setters[settingName](settingValue);
      });
    }

    chrome.storage.onChanged.addListener(settings => setSettings(settings, true));
    chrome.storage.local.get(null).then(setSettings);
  },
};

const de_settings = {
  setters: {
    defaultSavePath       : newValue => de_hotkeys.fallbackRule.path = newValue,
    minSize               : newValue => de_settings.minSize = parseInt(newValue),
    exclusions            : newValue => de_settings.exclusions = newValue,
    icon                  : newValue => de_button.elem.style.backgroundImage = newValue,
    hideButton            : newValue => de_button.elem.classList.toggle('shy', newValue),
    isCute                : newValue => de_events.switchAll(newValue),
    position              : newValue => [de_settings.vertical, de_settings.horizontal] = newValue.split('-'),
    folders               : newValue => newValue.forEach(de_hotkeys.assignHotkeyRule),
    placeUnderCursor      : newValue => de_settings.placeUnderCursor = newValue,
    saveOnHover           : newValue => de_settings.saveOnHover = newValue,
    showSaveDialog        : newValue => de_settings.showSaveDialog = newValue,
    forbidDuplicateFiles  : newValue => de_settings.forbidDuplicateFiles = newValue,
    originalNameByDefault : newValue => de_settings.originalNameButton = newValue ? 0 : 2,
    saveFullSized         : newValue => de_settings.saveFullSized = newValue,
    checkByRealImageSize  : newValue => de_settings.checkByRealImageSize = newValue,
    disableSpacebarHotkey : newValue => !newValue && de_hotkeys.bindReservedHotkeys(),
    domainExclusions      : newValue => de_settings.disableIfExcluded(newValue),
    styleForSaveMark      : newValue => de_settings.refreshStyleForSaveMark(newValue),
    verticalOffset        : newValue => de_settings.verticalOffset = parseInt(newValue),
    horizontalOffset      : newValue => de_settings.horizontalOffset = parseInt(newValue),
  },

  disableIfExcluded: function(excludedDomains){
    de_settings.domainExcluded = excludedDomains.split(' ').includes(de_contentscript.pageInfo.domain);
    de_events.switchAll(!de_settings.domainExcluded);
  },

  refreshStyleForSaveMark: function(value){
    de_settings.styleForSaveMark && de_webextApi.switchPageStyle(de_settings.styleForSaveMark, false);
    if (value) {
      const newCssString = `.${de_contentscript.classForSaveMark} {${value}}`;
      de_settings.styleForSaveMark = newCssString;
      de_webextApi.switchPageStyle(newCssString, true);
    }
  },
};

const de_button = {
  elem: null,
  name: 'DE_CBUTTON',
  styled: false,
  setVisibleTimeout: null,
  downloadRequest: {},

  init: function(){
    this.elem = document.createElement(this.name);
    this.elem.id = 'de-cute-id';
    this.elem.addEventListener('contextmenu', this.disableEvent);
    this.elem.addEventListener('mouseout', this.unclick);
    this.prepareDownloadRequest(null, null);

    this.overrideAndListen('mouseup');
    this.overrideAndListen('mousedown');
    this.overrideAndListen('click');
  },

  prepareDownloadRequest: function(src, originalName){
    if (!de_contentscript.pageInfo.title && src) {
      de_contentscript.pageInfo.title = document.title;
    }

    this.downloadRequest = {
      src             : src,
      originalName    : originalName,
      useOriginalName : null,
      showSaveDialog  : de_settings.showSaveDialog,
      template        : de_hotkeys.fallbackRule,
      pageInfo        : de_contentscript.pageInfo,
    };
  },

  overrideAndListen: function(eventType){
    function listener(event){
      if (event.target.nodeName !== de_button.name) {return;}
      de_button.disableEvent(event);
      de_button.eventsHandlers[event.type](event.button);
    }

    document.addEventListener(eventType, listener, {capture: true});
  },

  eventsHandlers: {
    mouseup: function(eventButton){
      const that = de_button,
        btnElem = that.elem,
        downloadRequest = Object.assign(
          that.downloadRequest,
          {
            useOriginalName : that.isOriginalNameButton(eventButton),
            template        : de_hotkeys.selectedKeyboardRule || de_hotkeys.mouseHotkeys['ANY'] || de_hotkeys.mouseHotkeys[eventButton] || de_hotkeys.fallbackRule,
          },
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
      de_hotkeys.selectedKeyboardRule = null;
      de_contentscript.rememberDownload(historyEntry);
      if (eventButton === 1) { // TODO: make optional or delete
        that.copyToClipboard(that.downloadRequest.src);
      }
      that.unclick();
      de_contentscript.addSaveMark();
    },

    mousedown: function(){
      de_button.elem.classList.add('click');
    },

    click: function(){},
  },

  disableEvent: function(event){
    event.stopImmediatePropagation();
    event.preventDefault();
  },

  show: function(position, src, originalName){
    if (!this.styled) {
      de_webextApi.getButtonStyle();
    }
    this.prepareDownloadRequest(src, originalName);
    this.elem.style.top     = position.top;
    this.elem.style.bottom  = position.bottom;
    this.elem.style.left    = position.left;
    this.elem.style.right   = position.right;
    position.container.appendChild(this.elem);

    this.setVisibleTimeout = setTimeout(() => {
      de_button.elem.classList.add('visible');
      de_button.setVisibleTimeout = null;
    }, 32);
  },

  hide: function(){
    if (this.setVisibleTimeout) {return;}
    this.prepareDownloadRequest(null, null);
    this.elem.classList.remove('visible');
  },

  unclick: function(){
    de_button.elem.classList.remove('click');
  },

  isVisible: function(){
    return de_button.elem.classList.contains('visible');
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
  bgSrc             : null,
  actualNode        : null, // actual node with image/video (if the node under cursor is something else)
  currentNode       : null, // the node button is currently shown on
  srcLocation       : null,
  previousSrc       : null,
  isSeparateTab     : null,
  historyTimer      : null,
  insertedRuleIndex : null,
  downloadsHistory  : [],
  classForSaveMark  : 'cute-and-saved',
  pageInfo          : {
    domain    : null,
    title     : null,
    threadNum : null,
    boardCode : null,
  },

  init: function(){
    de_events.listen('mouseover'); // asap

    document.addEventListener('readystatechange', function onReadystatechange(event){ // too late for "load" event
      if (event.target.readyState !== 'complete') {return;}
      de_siteParsers.checkDollchanPresence();
      document.removeEventListener('readystatechange', onReadystatechange);
    });

    this.isSeparateTab = ['image/', 'video/', 'audio/'].includes(document.contentType.substr(0, 6));
    this.srcLocation = this.isSeparateTab ? 'baseURI' : 'currentSrc';
    this.pageInfo = {
      domain    : document.location.hostname,
      href      : document.location.href,
      title     : null,
      threadNum : de_siteParsers.getPossibleThreadNum(),
      boardCode : de_siteParsers.getPossibleBoardCode(),
    };

    de_siteParsers.setFilteredHost(document.location.hostname);

    de_button.init();
    de_webextApi.listen();
    de_webextApi.settings();
    de_webextApi.getButtonStyle();
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
    this.historyTimer = setTimeout(() => de_contentscript.downloadsHistory = [], historyLifetime);
  },

  addSaveMark: function(){
    if (!de_settings.styleForSaveMark || this.currentNode.tagName !== 'IMG') {return;}
    this.currentNode.classList.add(this.classForSaveMark);
  },

  nodeTools: {
    absoluteMinSize: 50,

    observer: new MutationObserver(mutations => {
      const target = mutations.pop().target;
      de_contentscript.nodeTools.handleAgainOn('load', target);
    }),

    addSrcObserver: function(node){
      if (node.tagName !== 'IMG') {return;}
      this.observer.disconnect();
      this.observer.observe(node, {
        attributeFilter: ['src', 'srcset'],
      });
    },
    handleAgainOn: function(eventType, node){
      node.addEventListener(eventType, () => de_contentscript.nodeHandler(node), {once: true});
    },
    checkForBgSrc: function(node, modifier){
      if (!modifier) {return false;}

      const bgImg = getComputedStyle(node).getPropertyValue('background-image');
      if (bgImg) {
        const bgUrlMatches = bgImg.match(/^url\([\s"']*(https?:\/\/[^\s"']+)[\s"']*\).*/i);
        if (bgUrlMatches) {
          de_contentscript.bgSrc = bgUrlMatches[1];
          return true;
        }
      }
      return false;
    },
    isSmallVideo: function(node){
      if (node.tagName !== 'VIDEO' || node.videoHeight || node.clientHeight > this.absoluteMinSize) {
        return false;
      }
      this.handleAgainOn('loadeddata', node);
      return true;
    },
    filterByTag: function(tagName){
      return !['IMG', 'VIDEO', 'AUDIO'].includes(tagName);
    },
    filterBySrc: function(src){
      return !src || !src.startsWith('http');
    },
    filterByExclusions: function(node){
      return node.matches(de_settings.exclusions);
    },
    filterBySize: function(node, modifier){
      if (node.tagName === 'IMG' && (node.width < this.absoluteMinSize || node.height < this.absoluteMinSize)) {
        return true; // never show on too small images
      }
      if (!modifier && (node.tagName === 'AUDIO' || this.isSmallVideo(node))) {
        return true; // don't show on audio tags or video tags with small height (would block play button) unless modifier pressed
      }
      if (de_contentscript.isSeparateTab || ['VIDEO', 'AUDIO'].includes(node.tagName) || modifier) {
        return false; // always show if it's a separate tab or if it's audio/video or if modifier is pressed
      }
      const isRenderedSizeBig = node.width >= de_settings.minSize && node.height >= de_settings.minSize;
      if (
        node.complete &&
        node.naturalWidth >= de_settings.minSize &&
        node.naturalHeight >= de_settings.minSize &&
        (de_settings.checkByRealImageSize || isRenderedSizeBig) // don't check by rendered size if checkByRealImageSize option enabled
      ) {
        return false; // show if image is fully loaded and its actual sizes bigger than minSize
      }
      return !isRenderedSizeBig; // otherwise hide if its rendered sizes smaller than minSize
    },
    deepSearchHostSpecific: function(node){
      de_contentscript.actualNode = de_siteParsers.getActualNode(node);
      return !!de_contentscript.actualNode;
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
      tools.filterByExclusions(node)
    ) {
      return true;
    }
    return tools.filterBySize(node, modifier);
  },

  isForRelativePositioning: function(node){
    const nodeStyle = window.getComputedStyle(node);
    return nodeStyle.position !== 'static' && nodeStyle.display !== 'table';
  },

  getPosition: function(node){
    const nodeRect = node.getBoundingClientRect(),
      buttonSideSize = 32,
      offsets = {
        left  : de_settings.horizontalOffset,
        right : de_settings.horizontalOffset + buttonSideSize,
        top   : de_settings.verticalOffset,
        bottom: de_settings.verticalOffset + buttonSideSize,
      },
      position = {},
      getMinOffset = sideSize => sideSize < this.nodeTools.absoluteMinSize ? -999999 : 0; // hack to ignore offsetParent position if it's too small (usually it not represents actual image position)
    let parentRect;

    const sizeGettersRegular = {
      left  : () => Math.max(0, nodeRect.left) + offsets.left,
      top   : () => Math.max(0, nodeRect.top) + offsets.top,
      right : () => Math.min(document.documentElement.clientWidth, nodeRect.right) - offsets.right,
      bottom: () => Math.min(document.documentElement.clientHeight, nodeRect.bottom) - offsets.bottom,
    };
    const sizeGettersInPositioned = {
      left  : () => nodeRect.left - parentRect.left - Math.min(0, nodeRect.left),
      top   : () => nodeRect.top - parentRect.top - Math.min(0, nodeRect.top),
      right : () => parentRect.right - nodeRect.right + Math.max(0, nodeRect.right - document.documentElement.clientWidth),
      bottom: () => parentRect.bottom - nodeRect.bottom + Math.max(0, nodeRect.bottom - document.documentElement.clientHeight),
    };

    if (this.isForRelativePositioning(node.offsetParent)) {
      parentRect = node.offsetParent.getBoundingClientRect();
      position.container = node.offsetParent;
      position[de_settings.horizontal] = Math.max(getMinOffset(parentRect.width), sizeGettersInPositioned[de_settings.horizontal]()) + offsets.left + 'px';
      position[de_settings.vertical] = Math.max(getMinOffset(parentRect.height), sizeGettersInPositioned[de_settings.vertical]()) + offsets.top + 'px';
    } else {
      position.container = document.body.parentNode;
      position.left = sizeGettersRegular[de_settings.horizontal]() + window.scrollX + 'px';
      position.top = sizeGettersRegular[de_settings.vertical]() + window.scrollY + 'px';
    }

    return position;
  },

  getPositionUnderCursor: function(mouseEvent){
    if (!mouseEvent.target) {return null;}

    const offset = 16; // half button size, so the cursor would be right in the center
    return {
      container : document.body.parentNode,
      left      : de_events.cursorPosition.x + window.scrollX - offset + 'px',
      top       : de_events.cursorPosition.y + window.scrollY - offset + 'px',
    };
  },

  nodeHandler: async function(currentTarget, event = {}){
    const that = de_contentscript,
      src = currentTarget[that.srcLocation];

    if (!currentTarget || (!that.isSeparateTab && event.ctrlKey && !event.altKey)) {return;}
    if (!src || src !== that.previousSrc) {
      de_button.hide();
    }
    if (that.isTrash(currentTarget, event.shiftKey)) {
      return;
    }
    that.previousSrc = src;
    that.currentNode = that.actualNode || currentTarget;

    let position = {left: null, top: null, right: null, bottom: null}; // only two position properties would be set at once, other two are null on purpose to reset their default values
    const finalSrc = await de_siteParsers.getOriginalSrc(that.currentNode) || src || that.currentNode.currentSrc || that.bgSrc,
      originalFilename = de_siteParsers.getOriginalFilename(that.currentNode);

    if (de_settings.placeUnderCursor) {
      setTimeout(() => {
        Object.assign(position, that.getPositionUnderCursor(event));
        de_button.show(position, finalSrc, originalFilename);
      }, 75); // waiting for the user to stop the cursor

    } else {
      Object.assign(position, that.getPosition(that.currentNode));
      de_button.show(position, finalSrc, originalFilename);

      if (event.ctrlKey && event.altKey && de_settings.saveOnHover) {
        de_button.emulateClick();
        de_button.jerkClass('visible');
      }
    }

    that.bgSrc = null;
    that.actualNode = null;
  },
};

const de_siteParsers = {
  host: null,
  dollchanImproved: null,

  setFilteredHost: function(hostname){
    this.host = hostname.replace(/^www\./, '')
      .replace(/^((.*)\.)?(tumblr\.com)$/, 'tumblr.com')
      .replace(/^yandex\.[a-z]{2,3}$/, 'yandex.*')
      .replace(/^(ecchi\.)?(iwara\.tv)$/, 'iwara.tv');
  },

  getPossibleBoardCode: function(){
    const boardCodeTry = document.location.pathname.match(/^\/(\w+)\//);
    return boardCodeTry && boardCodeTry[1];
  },

  getPossibleThreadNum: function(){
    const threadNumTry = document.location.pathname.match(/\/(\d+)(\/|\.|$)/);
    return threadNumTry && threadNumTry[1];
  },

  checkDollchanPresence: function(){
    setTimeout(() => {de_siteParsers.dollchanImproved = !!document.querySelector('#de-main');}, 1000);
  },

  getActualNode: function(node){
    const dollchanHack = 'self::div[@class="de-fullimg-video-hack"]/following-sibling::video',
      twitchHack = 'self::div[@data-a-target="player-overlay-click-handler"]/ancestor::div[@data-a-target="video-ref"]/video', // TODO: proper aliases
      siteHacks = {
        'tumblr.com'      : 'self::a/parent::div[@class="photo-wrap"]/img | self::a[@target="_blank"]/parent::div/preceding-sibling::div[@class="post_content"]/div/div[@data-imageurl] | self::span/parent::div/parent::a[@target="_blank"]/parent::div/preceding-sibling::div[@class="post_content"]/div/div[@data-imageurl] | self::div[@class="vjs-big-play-button"]/preceding-sibling::video',
        'yandex.*'        : 'self::div[contains(@class, "preview2__arrow")]/preceding-sibling::div[contains(@class, "preview2__wrapper")]/div[@class="preview2__thumb-wrapper"]/img[contains(@class, "visible")] | self::div[contains(@class, "preview2__control")]/../preceding-sibling::div[contains(@class, "preview2__wrapper")]/div[@class="preview2__thumb-wrapper"]/img[contains(@class, "visible")]',
        'instagram.com'   : 'self::div[parent::div/parent::div]/preceding-sibling::div/img | self::div[@role="dialog"]/../../preceding-sibling::img',
        'iwara.tv'        : 'self::div[@class="videoPlayer__bg"]/parent::div[@class="videoPlayer"]//video[@class="vjs-tech"]',
        'vk.com'          : 'self::a[contains(@class, "image_cover") and contains(@onclick, "showPhoto")]',
        'twitch.tv'       : twitchHack,
        'clips.twitch.tv' : twitchHack,
        'behance.net'     : 'self::div[contains(@class, "js-prev") or contains(@class, "js-next")]/following::div[contains(@class, "js-slide-content") and not(contains(@class, "hidden"))]/img',
        '2ch.hk'          : 'self::div[@id="html5videofixer"]/preceding-sibling::video',
        'pixiv.net'       : 'self::button/ancestor::div[@role="presentation"]//img',
        'streamable.com'  : 'self::div[@class="svp-events-catcher"]/preceding-sibling::video',
      },
      xpathForHost = `${siteHacks[this.host]}[not(starts-with(@src, "blob:"))]`;

    return (
      (this.dollchanImproved && de_siteParsers.xpath(dollchanHack, node)) ||
      (xpathForHost && de_siteParsers.xpath(xpathForHost, node))
    );
  },

  getOriginalSrc: async function(node){
    if (!de_settings.saveFullSized) {return null;}

    const getters = [
      {
        hosts: ['twitter.com', 'tweetdeck.twitter.com', 'mobile.twitter.com', 'pbs.twimg.com', 'x.com'],
        get: () => {
          return node.currentSrc.replace(/\.(jpg|jpeg|png)(:[a-z0-9]+)?$/i, '.$1:orig').replace(/name=[a-z0-9]+/, 'name=orig');
        }
      }, {
        hosts: ['vk.com'],
        get: () => {
          const srcset = JSON.parse(node.parentNode.dataset.options)['temp'];
          return srcset['w'] || srcset['z'] || srcset['y'] || srcset['x'];
        }
      }, {
        hosts: ['iwara.tv'],
        get: () => {
          return de_siteParsers.xpath('self::img/../../a[@class="slideshow__expand"]', node).href;
        }
      }, {
        hosts: ['chan.sankakucomplex.com'],
        get: () => {
          return node.parentNode.href;
        }
      }, {
        hosts: ['safebooru.org', 'gelbooru.com'],
        get: () => {
          if (node.currentSrc.includes('/images/')) {return null;}

          const xpathBase = {
            'safebooru.org' : 'div[@id="content"]/div[@id="post-view"]/div[@class="sidebar"]/div/ul/li',
            'gelbooru.com'  : 'div[@id="container"]/section/ul[@id="tag-list"]/li',
          };

          return de_siteParsers.xpath(`/html/body/${xpathBase[this.host]}/a[text()="Original image"]`, document).href;
        },
      }, {
        hosts: ['discord.com'],
        get: () => {
          const videoSrcTry = node.currentSrc.match(/\/external\/.+\/https\/(.+\.\w{3,4})$/i);
          if (videoSrcTry) {
            return `https://${videoSrcTry[1]}`;
          }

          const href = node.parentNode.href;
          return href.includes('/attachments/') && href;
        }
      }, {
        hosts: ['instagram.com'],
        get: () => {
          return de_siteParsers.getHighresFromSrcset(node.srcset);
        }
      }, {
        hosts: ['tumblr.com'],
        get: async () => {
          const highresMask = 's99999x99999';
          if (node.currentSrc.includes(highresMask)) {return null;}

          if (node.srcset) {
          	return de_siteParsers.getHighresFromSrcset(node.srcset);
          }

          const legacyUrlParts = (node.dataset['imageurl'] || node.currentSrc).match(/^(.+\/[a-z0-9]{32}\/tumblr_\w+)(_\d{2,4}).(jpg|jpeg|png|gif)$/i);
          if (legacyUrlParts) {
          	return `${legacyUrlParts[1]}_1280.${legacyUrlParts[3]}`;
          }

          // TODO: synchronous version
          const response = await fetch(node.currentSrc.replace(/\/s\d+x\d+\//, `/${highresMask}/`), {
            method: 'GET',
            headers: {'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}
          });
          if (!response.ok) {return null;}

          const html = await response.text();
          return html.match(new RegExp(`src="(http[^"]+\\/${highresMask}\\/[^"]+)"`))[1];
        }
      }, {
        hosts: ['zerochan.net'],
        get: () => {
          const parts = node.currentSrc.match(/zerochan\.net\/([^/]+)\.\d+\.(\d+)\.(\w{3,4})$/i);
          return parts ?
            `https://static.zerochan.net/${parts[1]}.full.${parts[2]}.${parts[3]}` :
            de_siteParsers.xpath('../following-sibling::p/a[img[contains(@src, "download")]]', node).href;
        }
      }, {
        hosts: ['steamcommunity.com', 'images.steamusercontent.com'],
        get: () => {
          let imw, imh, newSrc = node.currentSrc
          const params = new URLSearchParams(new URL(newSrc).search);

          if ((imw = params.get('imw')) === null) {
            newSrc += '&imw=5000';
          } else {
            newSrc = newSrc.replace(`imw=${imw}`, 'imw=5000')
          }
          if ((imh = params.get('imh')) === null) {
            newSrc += '&imh=5000';
          } else {
            newSrc = newSrc.replace(`imh=${imh}`, 'imh=5000')
          }

          return newSrc;
        },
      }, {
        hosts: ['space.bilibili.com'],
        get: () => {
          return node.currentSrc.split('@')[0];
        }
      }, {
        hosts: ['2ch.hk', '2ch.life'],
        get: () => {
          return node.classList.contains('post__file-preview') && node.parentNode.href;
        }
      },
    ];

    const getter = getters.find(g => g.hosts.includes(this.host));
    if (!getter) {return null;}

    try {
      return await getter.get();
    } catch { // tfw no safe navigation operator in 2021
      return null;
    }
  },

  getOriginalFilename: function(node){
    const hostsWithFilenameInSrc = [
      'images.steamusercontent.com',
    ];
    if (de_contentscript.isSeparateTab && !hostsWithFilenameInSrc.includes(this.host)) {return null;}

    const dollchanXpath = '(. | self::img/..)/parent::div[contains(@class, "de-fullimg-wrap-center")]//a[@class="de-fullimg-link" and text() != "Spoiler Image"]',
      getters = {
        'boards.4chan.org': () => {
          const container = de_siteParsers.xpath('ancestor::div[contains(concat(" ", normalize-space(@class), " "), " file ")]//*[(@class="fileText" and @title) or self::a]', node);
          return container.title || container.textContent;
        },
        '8chan.moe': () => {
          return de_siteParsers.xpath('../preceding-sibling::summary/div/a[@class="originalNameLink"]', node).textContent;
        },
        '2ch.hk': () => {
          const container = de_siteParsers.xpath('ancestor::figure[@class="image" or @class="post__image"]/figcaption/a', node);
          return container.title || container.textContent;
        },
        'iichan.hk': () => {
          return de_siteParsers.xpath('../preceding-sibling::span[@class="filesize"]/a', node).textContent;
        },
        'boards.fireden.net': () => {
          const container = de_siteParsers.xpath('(../following-sibling::div[@class="post_file"]|../../preceding-sibling::div[@class="post_file"])/a[@class="post_file_filename"]', node);
          return container.title || container.textContent;
        },
        'endchan.gg': () => {
          const container = de_siteParsers.xpath('../preceding-sibling::div[@class="uploadDetails"]/a[@class="originalNameLink"]', node);
          return container.download || container.textContent;
        },
        'steamcommunity.com': () => {
          return node.currentSrc.match(/^https:\/\/images\.steamusercontent\.com\/ugc\/(\d+)\/[a-z0-9]{40}\//i)[1] + '.jpg';
        },
        'iwara.tv': () => {
          return node.currentSrc.match(/[?&]filename=([^&]+)/)[1];
        },
      },
      aliases = {
        'boards.4channel.org'           : 'boards.4chan.org',
        'yuki.la'                       : 'boards.4chan.org',
        'arch.b4k.dev'                  : 'boards.fireden.net',
        'images.steamusercontent.com'   : 'steamcommunity.com',
        '8chan.se'                      : '8chan.moe',
      };

    const getter = getters[this.host] || getters[aliases[this.host]];
    if (!getter) {return null;}

    function tryFilenameFromDollchanImageByCenter(){
      if (!de_siteParsers.dollchanImproved) {return null;}
      const filenameTry = de_siteParsers.xpath(dollchanXpath, node);

      return filenameTry ? filenameTry.textContent : null;
    }

    try {
      return tryFilenameFromDollchanImageByCenter() || getter();
    } catch { // tfw still no safe navigation operator
      return null;
    }
  },

  xpath: function(path, contextNode){
    return document.evaluate(path, contextNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  },

  getHighresFromSrcset: function(srcset){ // by "w" only
    function getWidth(str){
      return Number(str.trim().match(/^.+ (\d+)w$/)[1]);
    }

    return srcset.split(/ *, */).reduce((a, b) => {
      return getWidth(a) > getWidth(b) ? a : b;
    }).split(' ')[0];
  },
};

const de_events = {
  cursorPosition: {x: 0, y: 0},

  listeners: {
    mouseover: function(event){
      if (event.target.tagName === de_button.name || (event.relatedTarget && event.relatedTarget.tagName === de_button.name)) {return;}
      try {
        de_contentscript.nodeHandler(event.target, event);
      } catch (e) {
        if (e.message.includes('de_settings')) { // settings are not initialized yet
          setTimeout(() => de_contentscript.nodeHandler(event.target, event), 100);
        }
      }
    },
    mousemove: function(event){
      de_events.cursorPosition.x = event.clientX;
      de_events.cursorPosition.y = event.clientY;
    },
    keydown: function(event){
      if (de_hotkeys.isHotkeyPossible(event) && de_hotkeys.isHotkeyExists(de_hotkeys.buildHotkeyId(event))) {
        event.preventDefault();
      }
    },
    keyup: function(event){
      const hotkeyId = de_hotkeys.buildHotkeyId(event);

      if (hotkeyId === de_hotkeys.hide) {
        de_button.hide();
        return;
      }
      if (!de_hotkeys.isHotkeyPossible(event) || !de_hotkeys.isHotkeyExists(hotkeyId)) {
        return;
      }

      if (de_contentscript.isSeparateTab && !de_button.isVisible()) {
        de_contentscript.nodeHandler(document.body.childNodes[0]);
      }

      de_hotkeys.selectedKeyboardRule = de_hotkeys.keyboardHotkeys[hotkeyId];
      de_button.emulateClick(de_hotkeys.selectedKeyboardRule.mouseButton || 0);
    },
  },

  switchAll: function(turnOn = true){
    const functionName = turnOn && !de_settings.domainExcluded ? 'listen' : 'unlisten';

    de_events[functionName]('mouseover');
    de_events[functionName]('mousemove');
    de_events[functionName]('keydown');
    de_events[functionName]('keyup');
  },

  listen: function(eventType){
    window.addEventListener(eventType, de_events.listeners[eventType], {capture: true});
  },

  unlisten: function(eventType){
    window.removeEventListener(eventType, de_events.listeners[eventType], {capture: true});
  },
};

const de_hotkeys = {
  selectedKeyboardRule: null,

  fallbackRule: {path: '', filename: '', priority: 4}, // lowest priority

  keyboardHotkeys: {},

  mouseHotkeys: {},

  hide: '01081', // Alt+Q, hide button

  reset: function(){
    this.keyboardHotkeys = {};
    this.mouseHotkeys = {};
  },

  bindReservedHotkeys: function(){
    this.assignHotkeyRule(Object.assign({mouseButton: 0, id: '00032'}, de_hotkeys.fallbackRule)); // Space, save to default location
    this.assignHotkeyRule(Object.assign({mouseButton: 2, id: '10032'}, de_hotkeys.fallbackRule)); // Ctrl+Space, save to default location with original filename
  },

  buildHotkeyId: function(event){
    return `${event.ctrlKey ? 1 : 0}${event.altKey ? 1 : 0}${event.shiftKey ? 1 : 0}${event.keyCode}`;
  },

  isHotkeyPossible: function(event){
    return (
      (de_contentscript.isSeparateTab && this.isNoScroll()) ||
      (
        de_button.isVisible() &&
        !['INPUT', 'TEXTAREA'].includes(event.target.tagName) &&
        !event.target.classList.contains('submit_post_field') // vk inputs
      )
    );
  },

  isHotkeyExists: function(hotkeyId){
    return this.keyboardHotkeys[hotkeyId] !== undefined;
  },

  isNoScroll: function(){
    return document.body.scrollHeight === document.body.clientHeight;
  },

  assignHotkeyRule: function(rule){
    const that = de_hotkeys;

    if (!that.isRuleForCurrentDomain(rule)) {return;}

    const priority = that.getPriorityLevel(rule),
      newRule = {
        path        : rule.path,
        filename    : rule.filename,
        mouseButton : rule.mouseButton,
        priority    : priority,
      };

    if (that.isHigherPriority(that.keyboardHotkeys[rule.id], priority)) {
      that.keyboardHotkeys[rule.id] = newRule;
    }
    if (rule.mouseButton !== '' && that.isHigherPriority(that.mouseHotkeys[rule.mouseButton], priority)) {
      that.mouseHotkeys[rule.mouseButton] = newRule;
    }
  },

  isHigherPriority: function(previousRule, newPriority){
    return !previousRule || previousRule.priority >= newPriority;
  },

  isRuleForCurrentDomain: function(rule){
    return (
      !rule.domain ||
      rule.domain === de_contentscript.pageInfo.domain ||
      (this.isExclusionRule(rule) && rule.domain !==`-${de_contentscript.pageInfo.domain}`)
    );
  },

  getPriorityLevel: function(rule){
    if (rule.priority) {
    	return rule.priority;
    } else if (!rule.domain) {
    	return 3;
    } else if (this.isExclusionRule(rule)) {
      return 2;
    } else {
      return 1;
    }
  },

  isExclusionRule: function(rule){
    return rule.domain.startsWith('-');
  },
};

de_contentscript.init();
