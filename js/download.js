'use strict';

function download(downloadRequest, tabId){
    downloader.saveFile(downloadRequest, tabId);
}

const downloader = {
    savePath: '',
    filename: '',
    basename: '',
    prefix  : '',

    resetFileName: function(){
        this.filename = '';
        this.basename = '';
    },

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

    saveFile: function(downloadRequest, tabId){
        this.resetFileName();
        this.savePath = this.prepareSavePath(downloadRequest.path);
        this.prefix = this.preparePrefix(downloadRequest.filenamePrefix);

        if (downloadRequest.originalName) {
            this.filename = downloadRequest.originalName;
        } else {
            this.getFilename(downloadRequest.src)
        }

        if (this.filename) {
            this.download(downloadRequest.src, tabId, downloadRequest.showSaveDialog);
        } else {
            this.getHeadersAndDownload(downloadRequest, tabId);
        }
    },

    getHeadersAndDownload: function(downloadRequest, tabId, requestType = 'HEAD'){
        const request = new XMLHttpRequest();
        request.open(requestType, downloadRequest.src);
        request.onload = () => {
            if (requestType === 'HEAD' && request.status === 501) { // HEAD request method is not implemented by server
                this.getHeadersAndDownload(downloadRequest, tabId, 'GET');
                return;
            }
            this.saveFileWithFilenameFromHeaders(downloadRequest.src, tabId, request);
        };
        request.onerror = () => {
            const filenameTry = downloadRequest.backupName.match(/[^\s]+\.(jpg|jpeg|png|gif|bmp|webm|mp4|ogg|mp3)/i);
            this.filename = filenameTry ? filenameTry[0] : downloadRequest.backupName;
            this.download(downloadRequest.src, tabId, downloadRequest.showSaveDialog);
        };
        request.send();
    },

    saveFileWithFilenameFromHeaders: function(src, tabId, request){
        const contentDisposition = request.getResponseHeader('Content-Disposition');
        let tmpFilename;

        if (contentDisposition) {
            tmpFilename = contentDisposition.match(/^.+filename\*?=(.{0,20}')?([^;]*);?$/i);
            if (tmpFilename) {
                this.filename = decodeURI(tmpFilename[2]).replace(/"/g, '');
            }
        }
        if (!this.filename) {
            const contentType = request.getResponseHeader('Content-Type'),
                extension = contentType ? ('.' + contentType.match(/\w+\/(\w+)/)[1].replace('jpeg', 'jpg')) : '';

            this.filename = (this.basename || Date.now()) + extension
        }

        this.download(src, tabId);
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

        if (filenameTry) {
            this.filename = filenameTry[2]
        } else {
            this.basename = url.split('/').pop();
        }
    },

    /*
    * If resulted filename is not the same as the filename, passed to downloads.download function,
    * then it was modified by 'uniquify' conflict action of WebExt API,
    * and user should be warned that he saved already existing file.
    */
    checkForDuplicate: function(originalFilename, downloadId, tabId){
        chrome.downloads.search({
            id: downloadId
        }, downloadItems => {
            if (!downloadItems[0].filename || downloadItems[0].filename.endsWith(originalFilename)) {return;}
            chrome.tabs.sendMessage(tabId, 'duplicate_warning');
        });
    },

    trimForbiddenWinChars: function(string){
        return string.replace(/[/\\:*?"<>|\x09]/g, '');
    },

    prepareFilename: function(){
        const prefix = this.prefix ? `${this.prefix}__` : '';
        return this.trimForbiddenWinChars(prefix + decodeURIComponent(this.filename));
    },

    download: function(src, tabId, showSaveDialog){
        const finalFilename = this.prepareFilename();
        chrome.downloads.download({
            url             : src,
            filename        : this.savePath + finalFilename,
            saveAs          : showSaveDialog,
            conflictAction  : 'uniquify'
        },
            downloadId => this.checkForDuplicate(finalFilename, downloadId, tabId)
        );
    },
};
