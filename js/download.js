'use strict';

const supportedFormats = '(jpg|jpeg|png|gif|bmp|webp|webm|mp4|ogg|mp3)',
  regexps = {
    extensionCheck  : new RegExp(`\\.${supportedFormats}$`, 'i'),
    filenameExtract : new RegExp(`^([^/]+\/)*([^/]+\\.${supportedFormats})([\\/][^.]+)?$`, 'i'),
    filenameInTitle : new RegExp(`[^\\s]+\\.${supportedFormats}`, 'i'),
  };

let canUseRefHeader = false;
if (typeof browser !== 'undefined') {
  browser.runtime.getBrowserInfo().then(info => {
    if (info.name === 'Firefox' && info.version.split('.')[0] >= 70) {
      canUseRefHeader = true;
    }
  });
}

function download(tabId, downloadRequest){
  new Download(downloadRequest, tabId).action();
}

function Download(downloadRequest, tabId){
  this.downloadRequest    = downloadRequest;
  this.tabId              = tabId;
  this.duplicateCheckTry  = 0;
}

Download.prototype = {
  action: async function(){
    let extractedFilename;

    if (!this.downloadRequest.template.filename) {
      this.downloadRequest.template.filename = '::both_filenames::'; // default behavior
    }

    if (this.filenameExtractionRequired()) {
      const extractedFromSrc = filenameTools.extractFilename(this.downloadRequest.src);
      if (extractedFromSrc.filename) {
        extractedFilename = extractedFromSrc.filename;
      } else {
        const extractedFromHeaders = await this.getFilenameFromHeaders();
        if (extractedFromHeaders.filename) {
          extractedFilename = extractedFromHeaders.filename;
        } else {
          if (extractedFromSrc.basename && extractedFromHeaders.extension) {
            extractedFilename = `${extractedFromSrc.basename}.${extractedFromHeaders.extension}`;
          } else {
            extractedFilename = this.getFallbackFilename(extractedFromHeaders.extension);
          }
        }
      }
    }

    const path = filenameTools.preparePath(filenameTools.replacePathPlaceholders(this.downloadRequest)),
      filename = filenameTools.prepareFilename(filenameTools.replaceFilenamePlaceholders(this.downloadRequest, extractedFilename))

    this.download(path, filename);
  },

  getFilenameFromHeaders: async function(){
    const headers = await this.getHeaders();
    if (!headers) {
      return {};
    }

    const tmpFilename = headers.contentDisposition && headers.contentDisposition.match(/^.+filename\*?=(.{0,20}')?([^;]*);?$/i);

    return tmpFilename ?
      {filename: decodeURI(tmpFilename[2]).replace(/"/g, '')} :
      {extension: headers.contentType && headers.contentType.match(/\w+\/(\w+)/)[1].replace('jpeg', 'jpg')};
  },

  getHeaders: async function(){
    let response = await fetch(this.downloadRequest.src, {method: 'HEAD'});

    if ([404, 405, 501].includes(response.status)) { // HEAD request method is not supported / allowed / implemented by server
      response = await fetch(this.downloadRequest.src, {method: 'GET'});
    }

    return response.ok ? {
      contentType: response.headers.get('content-type'),
      contentDisposition: response.headers.get('content-disposition'),
    } : null;
  },

  getFallbackFilename: function(possibleExtension){
    const filenameTry = (this.downloadRequest.pageInfo.title || '').match(regexps.filenameInTitle);
    return filenameTry ? filenameTry[0] : `${filenameTools.getTimestamp()}.${possibleExtension || 'jpg'}`;
  },

  download: function(path, filename, withReferer = true){
    chrome.downloads.download({
      url           : this.downloadRequest.src,
      filename      : path + filename,
      saveAs        : this.downloadRequest.showSaveDialog,
      conflictAction: 'uniquify',
      headers       : canUseRefHeader && withReferer ? [
        {name: 'Referer', value: this.downloadRequest.pageInfo.href},
      ] : [],
    }, downloadId => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message.includes('request header name')) {
            this.download(path, filename, false);
          }
          return;
        }

        this.checkForDuplicate(filename, downloadId);
      }
    );
  },

  /*
   * If resulted filename is not the same as the filename passed to downloads.download function,
   * then it was modified by 'uniquify' conflict action of WebExt API,
   * and user should be warned that he saved already existing file.
   */
  checkForDuplicate: function(originalFilename, downloadId){
    chrome.downloads.search({
      id: downloadId
    }, downloadItems => {
      if (!downloadItems[0]) {
      	this.checkForDuplicateRetry(originalFilename, downloadId);
      	return;
      }
      if (downloadItems[0].filename && !downloadItems[0].filename.endsWith(originalFilename)) {
        chrome.tabs.sendMessage(this.tabId, 'duplicate_warning');
      }
    });
  },

  /*
   * Hack for once broken(?) downloads.search, now it can't find download if called instantly from downloads.download callback
   */
  checkForDuplicateRetry: function(originalFilename, downloadId){
    if (this.duplicateCheckTry > 5) {return;}
    this.duplicateCheckTry++;
    setTimeout(() => this.checkForDuplicate(originalFilename, downloadId), 50);
  },

  filenameExtractionRequired: function(){
    const filenameTemplate = this.downloadRequest.template.filename;

    if (filenameTemplate.includes('::filename::')) {
    	return true;
    }
    return !(
      filenameTemplate.endsWith('::original_filename::') ||
      (
        filenameTemplate.endsWith('::both_filenames::') &&
        this.downloadRequest.useOriginalName &&
        this.downloadRequest.originalName &&
        this.downloadRequest.originalName.match(regexps.extensionCheck)
      )
    );
  },
};

const filenameTools = {
  replacePathPlaceholders: function(dlRequest){
    // TODO: don't use *filename* replacements here
    return this.replacePlaceholders(dlRequest.template.path, dlRequest);
  },

  replaceFilenamePlaceholders: function(dlRequest, extractedFilename){
    const filename = this.replacePlaceholders(dlRequest.template.filename, dlRequest, extractedFilename);
    return this.addMissingExtension(filename, extractedFilename);
  },

  replacePlaceholders: function(template, dlRequest, extractedFilename = null){
    let string = template;
    const placeholders = {
      '::domain::'            : () => this.trimForbiddenWinChars(dlRequest.pageInfo.domain),
      '::title::'             : () => this.trimForbiddenWinChars(dlRequest.pageInfo.title),
      '::thread_number::'     : () => this.trimForbiddenWinChars(dlRequest.pageInfo.threadNum),
      '::board_code::'        : () => this.trimForbiddenWinChars(dlRequest.pageInfo.boardCode),
      '::datetime::'          : this.getDatetimeString,
      '::date::'              : this.getDateString,
      '::time::'              : this.getTimestamp,
      '::filename::'          : () => extractedFilename,
      '::original_filename::' : () => dlRequest.originalName || extractedFilename,
      '::both_filenames::'    : () => (dlRequest.useOriginalName && dlRequest.originalName) ? dlRequest.originalName : extractedFilename,
    };

    string.includes(':') && Object.entries(placeholders).forEach(([placeholder, replacement]) => {
      string = string.replace(placeholder, replacement());
    });

    return string;
  },

  /*
   * If there's no extension in the resulting filename, get it from extracted filename
   */
  addMissingExtension: function(resultingFilename, extractedFilename){
    return resultingFilename.match(regexps.extensionCheck) ?
      resultingFilename :
      (resultingFilename + extractedFilename.match(regexps.extensionCheck)[0]);
  },

  /*
   * Decodes url, cuts possible GET parameters, extracts filename from the url.
   * Usually filename is located at the end, after last "/" symbol, but sometimes
   * it might be somewhere in the middle between "/" symbols.
   * That's why it's important to extract filename manually by looking for the last sub-string
   * with pre-known extension located between "/" symbols.
   * WebExt API is incapable of extracting such filenames.
   * Cheers pineapple.
   */
  extractFilename: function(originalUrl){
    const url = decodeURI(originalUrl).replace(/^.*https?:\/\/([^/]+)\/+/, '').split(/[?#]/)[0].replace(/:\w+$/, '').replace(/\/{2,}/g, '/'),
      filenameTry = url.match(regexps.filenameExtract);

    return filenameTry ?
      {filename: filenameTry[2]} :
      {basename: url.replace(/\/480$/, '').split('/').pop()}; // '/480' removal is a hack for tumblr videos
  },

  trimForbiddenWinChars: function(string){
    return (string || '').replace(/[/\\:*?"<>|\x09\u0080-\u008f\u0001-\u0009]/g, '').replace(/^[. ]+|[. ]+$/g, '');
  },

  /*
   * If the path is not empty then trims leading/trailing slashes/backslashes
   * and adds a single slash to the end for concating with filename.
   * Doesn't matter which slashes are used in save path, WebExt API recognizes both.
   */
  preparePath: function(path){
    return path && (path.replace(/^\\+|\\+$|^\/+|\/+$/, '') + '/');
  },

  prepareFilename: function(filename){
    let decodedFilename;
    try {
      decodedFilename = decodeURI(filename);
    } catch (e) { // malformed URI sequence
      decodedFilename = filename;
    }

    return this.trimForbiddenWinChars(decodedFilename);
  },

  getDatetimeString: function(){
    const date = new Date(),
      full = datePart => datePart.toString().padStart(2, '0');
    return `${date.getFullYear()}.${full(date.getMonth() + 1)}.${full(date.getDate())}_${date.toLocaleTimeString('uk').replace(/:/g, '_')}`;
  },

  getDateString: function(){
    return filenameTools.getDatetimeString().split('_')[0];
  },

  getTimestamp: function(){
    return Date.now();
  },
};
