'use strict';

function download(downloadRequest, tabId){
    downloader.saveFile(downloadRequest, tabId);
}

const downloader = {
    savePath: '',
    filename: '',
    basename: '',

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

    saveFile: function(downloadRequest, tabId){
        this.resetFileName();
        this.savePath = this.prepareSavePath(downloadRequest.path);

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
            const filenameTry = downloadRequest.backupName.match(/[^\s]+\.(jpg|jpeg|png|gif|bmp|webm|mp4|ogg)/i);
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
    * That's why it's important to extract filename manually by looking at last sub-string
    * with pre-known extension located between "/" symbols.
    * WebExt API is incapable of extracting such filenames.
    * Cheers pineapple.
    */
    getFilename: function(originalUrl){
        const url = decodeURI(originalUrl).replace(/^.*https?:\/\/([^/]+)\/+/, '').split(/[?#:]/)[0].replace(/\/{2,}/, '/'),
            filenameTry = url.match(/^([^/]+\/)*([^/]+\.(jpg|jpeg|png|gif|bmp|webm|mp4|ogg))([\/][^.]+)?$/i);

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
        browser.downloads.search({
            id: downloadId
        }).then(downloadItems => {
            if (downloadItems[0].filename.endsWith(originalFilename)) {return;}
            browser.tabs.sendMessage(tabId, 'duplicate_warning');
        });
    },

    prepareWinFilename: function(){
        return decodeURIComponent(this.filename).replace(/[/\\:*?"<>|\x09]/g, '');
    },

    download: function(src, tabId, showSaveDialog){
        const finalFilename = this.prepareWinFilename();
        browser.downloads.download({
            url: src,
            filename: this.savePath + finalFilename,
            saveAs: showSaveDialog,
            conflictAction: 'uniquify'
        }).then(
            downloadId  => this.checkForDuplicate(finalFilename, downloadId, tabId),
            error       => console.log(error.toString()) //TODO maybe emit warning
        );
    },
};
