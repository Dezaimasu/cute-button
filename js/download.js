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
    this.duplicateCheckTry  = 0;
}

Download.prototype = {
    process: function(){
        this.savePath = filenameTools.prepareSavePath(this.downloadRequest.path, this.downloadRequest.pageInfo);

        if (this.downloadRequest.originalName) { // TODO: also check if originalName contains extension only, e.g. ".jpg"
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

            this.filename = (this.basename || filenameTools.getTimestamp()) + extension
        }
    },

    setFallbackFilename: function(){
        const filenameTry = (this.downloadRequest.pageInfo.title || '').match(/[^\s]+\.(jpg|jpeg|png|gif|bmp|webm|mp4|ogg|mp3)/i);
        this.filename = filenameTry ? filenameTry[0] : filenameTools.getTimestamp();
    },

    download: function(){
        const finalFilename = filenameTools.prepareFilename(this.filename);
        chrome.downloads.download({
                url             : this.downloadRequest.src,
                filename        : this.savePath + finalFilename,
                saveAs          : this.downloadRequest.showSaveDialog,
                conflictAction  : 'uniquify'
            },
            downloadId => {
                if (chrome.extension.lastError) {return;}
                this.checkForDuplicate(finalFilename, downloadId);
            }
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
    * Hack for recently broken(?) downloads.search, now it can't find download if called immediately from downloads.download callback
    */
    checkForDuplicateRetry: function(originalFilename, downloadId){
        if (this.duplicateCheckTry > 5) {return;}
        this.duplicateCheckTry++;
        setTimeout(() => this.checkForDuplicate(originalFilename, downloadId), 50);
    }
};

const filenameTools = {
    /*
    * If the path is not empty then trims leading/trailing slashes/backslashes
    * and adds a single slash to the end for concating with filename.
    * Doesn't matter which slashes are used in save path, WebExt API recognizes both.
    */
    prepareSavePath: function(rawPath, pageInfo){
        const savePath = this.replacePlaceholders(rawPath, pageInfo);
        return savePath && (savePath.replace(/^\\+|^\/+|\\+$|\/+$/, '') + '/');
    },

    replacePlaceholders: function(string, pageInfo){
        let pathPart = string;
        const placeholders = {
            '::domain::'            : () => this.trimForbiddenWinChars(pageInfo.domain),
            '::title::'             : () => this.trimForbiddenWinChars(pageInfo.title),
            '::thread_number::'     : () => this.trimForbiddenWinChars(pageInfo.threadNum),
            '::board_name::'        : () => this.trimForbiddenWinChars(pageInfo.boardName),
            '::date::'              : this.getDatetimeString,
            '::time::'              : this.getTimestamp,
            '::filename::'          : '',
            '::original_filename::' : '',
        };

        pathPart.includes(':') && Object.entries(placeholders).forEach(([placeholder, replacement]) => {
            pathPart = pathPart.replace(placeholder, replacement);
        });

        return pathPart;
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
        return (string || '').replace(/[/\\:*?"<>|\x09]/g, '');
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
        return new Date().toISOString().replace('T', '_').replace(/\..+/g, '').replace(/[^\d_]/g, '');
    },

    getTimestamp: function(){
        console.log(123123123123);
        return Date.now();
    },
};
