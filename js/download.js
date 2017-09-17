'use strict';

function download(downloadRequest, tabId){
    downloader.saveFile(downloadRequest, tabId);
}

const downloader = {
    savePath: '',
    filename: '',
    basename: '',

    initSavePath: function(){
        browser.storage.onChanged.addListener(function(changes){
            downloader.setSavePath(changes.savePath.newValue);
        });
        browser.storage.local.get('savePath').then(function(result){
            downloader.setSavePath(result.savePath);
        });
    },

    resetFileName: function(){
        this.filename = '';
        this.basename = '';
    },

    /*
    * If savePath option is not empty then trims leading/trailing slashes/backslashes
    * and adds a single slash to the end for concating with filename.
    * Doesn't matter which slashes are used in savePath, WebExt API recognizes both.
    */
    setSavePath: function(optionValue){
        this.savePath = optionValue && (optionValue.replace(/^\\+|^\/+|\\+$|\/+$/, '') + '/');
    },

    saveFile: function(downloadRequest, tabId){
        this.resetFileName();

        if (downloadRequest.originalName) {
            this.filename = downloadRequest.originalName;
        } else {
            this.getFilename(downloadRequest.src)
        }

        if (this.filename) {
            this.download(downloadRequest.src, tabId);
        } else {
            let that = this,
                request = new XMLHttpRequest();
            request.open('HEAD', downloadRequest.src);
            request.onload = function(){
                that.saveFileWithFilenameFromHeaders(downloadRequest.src, tabId, request);
            };
            request.onerror = function(){
                that.filename = downloadRequest.backupName;
                that.download(downloadRequest.src, tabId);
            };
            request.send();
        }
    },

    saveFileWithFilenameFromHeaders: function(src, tabId, request){
        let contentDisposition = request.getResponseHeader('Content-Disposition'),
            tmpFilename;

        if (contentDisposition) {
            tmpFilename = contentDisposition.match(/^.+filename\*?=(.{0,20}')?([^;]*);?$/i);
            if (tmpFilename) {
                this.filename = decodeURI(tmpFilename[2]).replace(/"/g, '');
            }
        }
        if (!this.filename) {
            let contentType = request.getResponseHeader('Content-Type'),
                extension = contentType ? ('.' + contentType.split('/').pop().replace('jpeg', 'jpg')) : '';

            this.filename = (this.basename || Date.now()) + extension
        }

        this.download(src, tabId);
    },

    /*
    * Decodes url, cuts possible GET parameters, extracts filename from the url.
    * Usually filename is located at the end, after last "/" symbol, but sometimes
    * it might be somewhere in the middle between "/" symbols.
    * That's why it's important to extract filename manually by looking at last sub-string
    * with extension (dot and 3-4 symbols) located between "/" symbols.
    * WebExt API is incapable of extracting such filenames.
    * Cheers pineapple.
    */
    getFilename: function(originalUrl){
        let url = decodeURI(originalUrl).replace(/^https?:\/\/([^/]+)\//, '').split(/[?#:]/)[0],
            filenameTry = url.match(/^([^/]+\/)*([^/]+\.[\w\d]{3,4})([\/][^.]+)?$/);

        if (filenameTry) {
            this.filename = filenameTry[2]
        } else {
            this.basename = url.split('/').pop();
        }
    },

    /*
    * If there's a number between parentheses before extension of the saved file
    * then it's probably because of 'uniquify' conflict action of WebExt API,
    * and user should be warned that he saved already existing file.
    */
    checkForDuplicate: function(downloadId, tabId){
        browser.downloads.search({
            id: downloadId
        }).then(function(downloadItems){
            if (/\(\d+\)\.[\w\d]{3,4}$/.test(downloadItems[0].filename) === false) {return;}
            browser.tabs.sendMessage(tabId, 'duplicate_warning');
        });
    },

    prepareWinFilename: function(){
        return decodeURIComponent(this.filename).replace(/[/\\:*?"<>|\x09]/g, '');
    },

    download: function(src, tabId){
        let that = this;
        browser.downloads.download({
            url: src,
            filename: that.savePath + that.prepareWinFilename(),
            conflictAction: 'uniquify'
        }).then(function(downloadId){
            that.checkForDuplicate(downloadId, tabId);
        }, function(error){
            console.log(error.toString()); ///TODO maybe emit warning
        });
    }
};

downloader.initSavePath();
