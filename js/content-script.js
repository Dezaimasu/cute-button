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
        const settingValue = isChanges ? setting.newValue : setting;
        de_settings.setters[settingName](settingValue);
      });
    }

    chrome.storage.onChanged.addListener(settings => setSettings(settings, true));
    chrome.storage.local.get(null, setSettings);
  },
};

const de_settings = {
  setters: {
    defaultSavePath       : newValue => de_hotkeys.fallbackRule.path = newValue,
    minSize               : newValue => de_settings.minSize = newValue,
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
  downloadRequest: {},

  init: function(){
    const that = this;

    that.elem = document.createElement(that.name);
    that.elem.id = 'de-cute-id';
    that.elem.addEventListener('contextmenu', that.disableEvent);
    that.elem.addEventListener('mouseout', that.unclick);
    that.initDownloadRequest(null, null);

    that.overrideAndListen('mouseup');
    that.overrideAndListen('mousedown');
    that.overrideAndListen('click');
  },

  initDownloadRequest: function(src, originalName){
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
    const btnElem = this.elem;

    if (!this.styled) {
      de_webextApi.getButtonStyle();
    }
    this.initDownloadRequest(src, originalName);
    btnElem.style.top     = position.top;
    btnElem.style.bottom  = position.bottom;
    btnElem.style.left    = position.left;
    btnElem.style.right   = position.right;
    position.container.appendChild(btnElem);
    setTimeout(() => btnElem.classList.add('visible'), 32);
  },

  hide: function(){
    this.initDownloadRequest(null, null);
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
    const hostname = document.location.hostname;

    de_events.listen('mouseover'); // asap

    document.addEventListener('readystatechange', function onReadystatechange(event){ // too late for "load" event
      if (event.target.readyState !== 'complete') {return;}
      de_contentscript.pageInfo.title = document.title;
      de_siteParsers.checkDollchanPresence();
      document.removeEventListener('readystatechange', onReadystatechange);
    });

    this.isSeparateTab = ['image/', 'video/', 'audio/'].includes(document.contentType.substr(0, 6));
    this.srcLocation = this.isSeparateTab ? 'baseURI' : 'currentSrc';
    this.pageInfo = {
      domain    : hostname,
      title     : null,
      threadNum : de_siteParsers.getPossibleThreadNum(),
      boardCode : de_siteParsers.getPossibleBoardCode(),
    };

    de_siteParsers.setFilteredHost(hostname);

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
    this.historyTimer = setTimeout(() => this.downloadsHistory = [], historyLifetime);
  },

  addSaveMark: function(){
    if (!de_settings.styleForSaveMark || this.currentNode.tagName !== 'IMG') {return;}
    this.currentNode.classList.add(this.classForSaveMark);
  },

  nodeTools: {
    absoluteMinSize: 50,

    observer: new MutationObserver(mutations => {
      const target = mutations.pop().target;
      this.handleAgainOn('load', target);
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
      return (!src || !src.startsWith('http') || src.startsWith('https://www.google.com/recaptcha/'));
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
      offset = 6,
      reverseOffset = 38, // offset + button width (32px)
      position = {},
      getMinOffset = sideSize => sideSize === 0 ? -999999 : 0; //hack(?) for tumblr for image containers with 0px width/height
    let parentRect;

    const sizeGettersRegular = {
      left  : () => Math.max(0, nodeRect.left) + offset,
      top   : () => Math.max(0, nodeRect.top) + offset,
      right : () => Math.min(document.documentElement.clientWidth, nodeRect.right) - reverseOffset,
      bottom: () => Math.min(document.documentElement.clientHeight, nodeRect.bottom) - reverseOffset,
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
      position[de_settings.horizontal] = Math.max(getMinOffset(parentRect.width), sizeGettersInPositioned[de_settings.horizontal]()) + offset + 'px';
      position[de_settings.vertical] = Math.max(getMinOffset(parentRect.height), sizeGettersInPositioned[de_settings.vertical]()) + offset + 'px';
    } else {
      position.container = document.body.parentNode;
      position.left = sizeGettersRegular[de_settings.horizontal]() + window.scrollX + 'px';
      position.top = sizeGettersRegular[de_settings.vertical]() + window.scrollY + 'px';
    }

    return position;
  },

  getPositionUnderCursor: function(mouseEvent){
    if (!mouseEvent.target) {return null;}
    return mouseEvent.target.offsetParent && this.isForRelativePositioning(mouseEvent.target.offsetParent) ? {
      container : mouseEvent.target.offsetParent,
      left      : mouseEvent.layerX + 'px',
      top       : mouseEvent.layerY + 'px'
    } : {
      container : document.body,
      left      : mouseEvent.clientX + window.scrollX + 'px',
      top       : mouseEvent.clientY + window.scrollY + 'px'
    };
  },

  nodeHandler: function(currentTarget, event = {}){
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

    de_button.show(
      Object.assign(
        {left: null, top: null, right: null, bottom: null}, // only two position properties would be set at once, other two are null on purpose to reset their default values
        (de_settings.placeUnderCursor && that.getPositionUnderCursor(event)) || that.getPosition(that.currentNode)
      ),
      de_siteParsers.getOriginalSrc(that.currentNode) || src || that.currentNode.currentSrc || that.bgSrc,
      de_siteParsers.getOriginalFilename(that.currentNode)
    );

    if (event.ctrlKey && event.altKey && de_settings.saveOnHover) {
      de_button.emulateClick();
      de_button.jerkClass('visible');
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
      siteHacks = {
        'twitter.com'   : 'self::div[not(*)]/../../preceding-sibling::div[not(@class)]/div/video[not(starts-with(@src, "blob:"))]',
        'tumblr.com'    : 'self::a/parent::div[@class="photo-wrap"]/img | self::a[@target="_blank"]/parent::div/preceding-sibling::div[@class="post_content"]/div/div[@data-imageurl] | self::span/parent::div/parent::a[@target="_blank"]/parent::div/preceding-sibling::div[@class="post_content"]/div/div[@data-imageurl] | self::div[@class="vjs-big-play-button"]/preceding-sibling::video',
        'yandex.*'      : 'self::div[contains(@class, "preview2__arrow")]/preceding-sibling::div[contains(@class, "preview2__wrapper")]/div[@class="preview2__thumb-wrapper"]/img[contains(@class, "visible")] | self::div[contains(@class, "preview2__control")]/../preceding-sibling::div[contains(@class, "preview2__wrapper")]/div[@class="preview2__thumb-wrapper"]/img[contains(@class, "visible")]',
        'instagram.com' : 'self::div[parent::div/parent::div]/preceding-sibling::div/img | self::*[@role="button"]/preceding-sibling::div/div/div/video | self::div[@role="dialog"]/../../preceding-sibling::img',
        'iwara.tv'      : 'self::div[@class="vjs-poster"]/preceding-sibling::video[@class="vjs-tech"]',
        'vk.com'        : 'self::a[contains(@class, "image_cover") and contains(@onclick, "showPhoto")]',
        'twitch.tv'     : 'self::div[@class="player-overlay"]/ancestor::div[contains(@class, "video-player__container")]/div[@class="player-video"]/video',
        'behance.net'   : 'self::div[contains(@class, "js-prev") or contains(@class, "js-next")]/following::div[contains(@class, "js-slide-content") and not(contains(@class, "hidden"))]/img',
        '2ch.hk'        : 'self::div[@id="html5videofixer"]/preceding-sibling::video',
        'pixiv.net'     : 'self::button/ancestor::div[@role="presentation"]//img',
      },
      aliases = {
        'clips.twitch.tv': 'twitch.tv',
      },
      xpathForHost = siteHacks[this.host] || siteHacks[aliases[this.host]];

    return (this.dollchanImproved && xpath(dollchanHack, node)) || (xpathForHost && xpath(xpathForHost, node));
  },

  getOriginalSrc: function(node){
    const getters = {
        'vk.com': () => {
          const info = JSON.parse(node.getAttribute('onclick').match(/^.*"?temp"? *: *({[^{}]+}).*$/)[1]);
          return info['w'] || info['z'] || info['y'] || info['x'];
        },
        'twitter.com': () => {
          return node.currentSrc.replace(/\.(jpg|jpeg|png)(:[a-z0-9]+)?$/i, '.$1:orig').replace(/name=[a-z0-9]+/, 'name=orig');
        },
        'tumblr.com': function(){
          return (node.dataset['imageurl'] || node.currentSrc).replace(/(\/[a-z0-9]{32}\/tumblr_\w+)(_\d{2,4}).(jpg|jpeg|png|gif)$/i, '$1_1280.$3');
        },
        'instagram.com': () => {
          function getWidth(str){
            return Number(str.trim().match(/^.+ (\d+)w$/)[1]);
          }
          return node.getAttribute('srcset').split(',').reduce((a, b) => {
            return getWidth(a) > getWidth(b) ? a : b;
          }).split(' ')[0]
        },
        'iwara.tv': () => {
          return node.parentNode.href;
        },
        'tiktokapi.ga': () => {
          return node.parentNode.getAttribute('videolink');
        },
        'discordapp.com': () => {
          const videoSrcTry = node.currentSrc.match(/\/external\/.+\/https\/(.+\.\w{3,4})$/i);
          if (videoSrcTry) {
            return `https://${videoSrcTry[1]}`;
          }

          const href = node.parentNode.href;
          return href.includes('/attachments/') && href;
        },
      },
      aliases = {
        'tweetdeck.twitter.com' : 'twitter.com',
        'mobile.twitter.com'    : 'twitter.com',
        'pbs.twimg.com'         : 'twitter.com',
      },
      getter = getters[this.host] || getters[aliases[this.host]];
    let originalSrc = null;

    if (!de_settings.saveFullSized || !getter) {return null;}
    try {
      originalSrc = getter();
    } catch (e) {} //tfw no safe navigation operator in 2017

    return originalSrc;
  },

  getOriginalFilename: function(node){
    const that = this,
      dollchanXpath = '(. | self::img/..)/parent::div[contains(@class, "de-fullimg-wrap-center")]//a[@class="de-fullimg-link" and text() != "Spoiler Image"]',
      getters = {
        'boards.4chan.org': () => {
          const container = xpath('ancestor::div[contains(concat(" ", normalize-space(@class), " "), " file ")]//*[(@class="fileText" and @title) or self::a]', node);
          return container.title || container.textContent;
        },
        '2ch.hk': () => {
          const container = xpath('ancestor::figure[@class="image" or @class="post__image"]/figcaption/a', node);
          return container.title || container.textContent;
        },
        'iichan.hk': () => {
          return xpath('../preceding-sibling::span[@class="filesize"]/a', node).textContent;
        },
        'boards.fireden.net': () => {
          const container = xpath('(../following-sibling::div[@class="post_file"]|../../preceding-sibling::div[@class="post_file"])/a[@class="post_file_filename"]', node);
          return container.title || container.textContent;
        },
        '8ch.net': () => {
          const container = xpath('../preceding-sibling::p[@class="fileinfo"]/span[@class="unimportant"]/a', node);
          return container.title || container.textContent;
        },
        'tiktokapi.ga': () => {
          const parent = node.parentNode,
            id = parent.getAttribute('videoid'),
            name = parent.getAttribute('videotitle');
          return `${id}__${name}.mp4`;
        },
        'discordapp.com': () => {
          const filename = new URL(node.currentSrc).pathname.split('/').pop(),
            postNode = xpath('ancestor::div[contains(@class, "cozyMessage-")]', node),
            parentPostNode = isGroupStart(postNode) ?
              postNode :
              xpath('preceding-sibling::div[contains(@class, "cozyMessage-") and contains(@class, "groupStart-")][1]', postNode),
            timeNode = parentPostNode.querySelector('h2[class*="header-"] span[class*="timestampCozy"] > span'),
            mediaInGroup = [];
          let prefix = formatDate(new Date(timeNode.getAttribute('aria-label'))),
            nodeInGroup;

          function isGroupStart(node){
            return node.getAttribute('class').includes('groupStart-');
          }

          nodeInGroup = parentPostNode;
          do {
            const mediaNodesInCurrentNode = nodeInGroup.querySelectorAll('a[class*="imageWrapper-"] img, a[class*="imageWrapper-"] video');
            mediaInGroup.push(...mediaNodesInCurrentNode);
            nodeInGroup = nodeInGroup.nextElementSibling;
          } while (!isGroupStart(nodeInGroup));

          if (mediaInGroup.length > 1) {
            prefix += ` ${mediaInGroup.indexOf(node) + 1}`;
          }

          return `${prefix} ${filename}`;
        },
      },
      aliases = {
        'boards.4channel.org' : 'boards.4chan.org',
        'yuki.la'             : 'boards.4chan.org',
        'arch.b4k.co'         : 'boards.fireden.net',
        '8kun.top'            : '8ch.net',
      },
      getter = getters[this.host] || getters[aliases[this.host]];
    let originalFilename = null;

    function tryFilenameFromDollchanImageByCenter(){
      if (!that.dollchanImproved) {return null;}
      const filenameTry = xpath(dollchanXpath, node);

      return filenameTry ? filenameTry.textContent : null;
    }

    if (!getter || de_contentscript.isSeparateTab) {return null;}
    try {
      originalFilename = tryFilenameFromDollchanImageByCenter() || getter();
    } catch (e) {} //tfw still no safe navigation operator

    return originalFilename;
  },
};

const de_events = {
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
    return isSet(this.keyboardHotkeys, hotkeyId);
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

function xpath(path, contextNode){
  return document.evaluate(path, contextNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function isSet(object, key){
  return typeof object[key] !== 'undefined';
}

function formatDate(date){
  const full = datePart => datePart.toString().padStart(2, '0');
  return `${date.getFullYear()}.${full(date.getMonth() + 1)}.${full(date.getDate())}_${date.toLocaleTimeString('uk').replace(/:/g, '_')}`;
}

de_contentscript.init();
