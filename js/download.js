'use strict';

function download(tabId, downloadRequest){
    new Download(downloadRequest, tabId).process();
}

function Download(downloadRequest, tabId){
    this.downloadRequest    = downloadRequest;
    this.tabId              = tabId;
    this.savePath           = '';
    this.filename           = '';
    this.basename           = '';
    this.prefix             = '';
}

Download.prototype = {
    process: function(){
        this.savePath = filenameTools.prepareSavePath(this.downloadRequest.path);
        this.prefix = filenameTools.preparePrefix(this.downloadRequest.filenamePrefix);

        if (this.downloadRequest.originalName) {
            this.filename = this.downloadRequest.originalName;
        } else {
            Object.assign(this, filenameTools.getFilename(this.downloadRequest.src));
        }

        if (this.filename) {
            this.download();
        } else {
            this.getHeadersAndDownload();
        }
    },

    getHeadersAndDownload: function(requestType = 'HEAD'){
        const xhr = new XMLHttpRequest();
        xhr.open(requestType, this.downloadRequest.src);
        xhr.onload = () => {
            if (requestType === 'HEAD' && [404, 405, 501].includes(xhr.status)) { // HEAD request method is not supported / allowed / implemented by server
                this.getHeadersAndDownload('GET');
            } else {
                this.setFilenameFromHeaders(xhr);
                this.download();
            }
        };
        xhr.onerror = () => {
            this.setFallbackFilename();
            this.download();
        };
        xhr.send();
    },

    setFilenameFromHeaders: function(xhr){
        const contentDisposition = xhr.getResponseHeader('Content-Disposition'),
            tmpFilename = contentDisposition && contentDisposition.match(/^.+filename\*?=(.{0,20}')?([^;]*);?$/i);

        if (tmpFilename) {
            this.filename = decodeURI(tmpFilename[2]).replace(/"/g, '');
        }
        if (!this.filename) {
            const contentType = xhr.getResponseHeader('Content-Type'),
                extension = contentType ? ('.' + contentType.match(/\w+\/(\w+)/)[1].replace('jpeg', 'jpg')) : '';

            this.filename = (this.basename || Date.now()) + extension
        }
    },

    setFallbackFilename: function(){
        const filenameTry = (this.downloadRequest.backupName || '').match(/[^\s]+\.(jpg|jpeg|png|gif|bmp|webm|mp4|ogg|mp3)/i);
        this.filename = filenameTry ? filenameTry[0] : this.downloadRequest.backupName;
    },

    download: function(){
        const finalFilename = filenameTools.prepareFilename(this.filename, this.prefix);
        chrome.downloads.download({
                url             : this.downloadRequest.src,
                filename        : this.savePath + finalFilename,
                saveAs          : this.downloadRequest.showSaveDialog,
                conflictAction  : 'uniquify'
            },
            downloadId => this.checkForDuplicate(finalFilename, downloadId)
        );
    },

    /*
    * If resulted filename is not the same as the filename, passed to downloads.download function,
    * then it was modified by 'uniquify' conflict action of WebExt API,
    * and user should be warned that he saved already existing file.
    */
    checkForDuplicate: function(originalFilename, downloadId){
        chrome.downloads.search({
            id: downloadId
        }, downloadItems => {
            if (!downloadItems[0] || !downloadItems[0].filename || downloadItems[0].filename.endsWith(originalFilename)) {return;}
            chrome.tabs.sendMessage(this.tabId, 'duplicate_warning');
        });
    },
};

const filenameTools = {
    /*
    * If the path is not empty then trims leading/trailing slashes/backslashes
    * and adds a single slash to the end for concating with filename.
    * Doesn't matter which slashes are used in save path, WebExt API recognizes both.
    */
    prepareSavePath: function(rawPath){
        return rawPath && (rawPath.replace(/^\\+|^\/+|\\+$|\/+$/, '') + '/');
    },

    preparePrefix: function(prefix){
        switch (prefix) {
            case '::date::' : {return new Date().toISOString().replace('T', '_').replace(/\..+/g, '').replace(/[^\d_]/g, '');}
            case '::time::' : {return new Date().getTime();}
            default         : {return prefix;}
        }
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
    getFilename: function(originalUrl){
        const url = decodeURI(originalUrl).replace(/^.*https?:\/\/([^/]+)\/+/, '').split(/[?#]/)[0].replace(/:\w+$/, '').replace(/\/{2,}/, '/'),
            filenameTry = url.match(/^([^/]+\/)*([^/]+\.(jpg|jpeg|png|gif|bmp|webm|mp4|ogg|mp3))([\/][^.]+)?$/i);

        return filenameTry ?
            {filename: filenameTry[2]} :
            {basename: url.replace(/\/480$/, '').split('/').pop()}; // '/480' removal is a hack for tumblr videos
    },

    trimForbiddenWinChars: function(string){
        return string.replace(/[/\\:*?"<>|\x09]/g, '');
    },

    prepareFilename: function(filename, prefix){
        return this.trimForbiddenWinChars((prefix ? `${prefix}__` : '') + decodeURIComponent(filename));
    }
};
