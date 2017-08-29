let downloader = {
	savePath: null,

	initSavePath: function(){
		browser.storage.onChanged.addListener(function(changes){
			downloader.setSavePath(changes.savePath.newValue);
		});
		browser.storage.local.get('savePath').then(function(result){
			downloader.setSavePath(result.savePath);
		});
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
		let that = this,
			filename = downloadRequest.originalName || that.getFilename(downloadRequest.src);

		browser.downloads.download({
			url: downloadRequest.src,
			filename: that.savePath + filename,
			conflictAction: 'uniquify'
		}).then(function(downloadId){
			that.checkForDuplicate(downloadId, tabId);
		}, function(error){
			console.log(error.toString()); ///TODO maybe emit warning
		});
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

		return filenameTry ? filenameTry[2] : url.split('/').pop(); //TODO request for MIME type for fallback filename extension
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
	}
};

downloader.initSavePath();
