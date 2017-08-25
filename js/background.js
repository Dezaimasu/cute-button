/*
* TODO remove extension id from manifest.json before release
* TODO base64 in background-image, blob, etc.
* TODO Windows filepath max length restrictions
*/

/*
* Content scripts and styles injection
* tabs.onUpdated used only for images/videos in separate tabs.
* It still will try to inject script (almost) everywhere.
* webNavigation.onDOMContentLoaded used for everything else because it triggers earlier.
* It's the only thing that catches iframes state changing.
* These two injections WILL overlap each other, second injection will try
* to redeclare content script variables and will end with error.
*/
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tabInfo){
	if (changeInfo.status !== 'complete' || changeInfo.url) {return;}
	penetrate(tabId);
});
browser.webNavigation.onDOMContentLoaded.addListener(function(details){
	penetrate(details.tabId, details.frameId);
}, {
	url: [{schemes: ['http', 'https']}]
});
function penetrate(tabId, frameId = 0){
	browser.tabs.executeScript(tabId, {
		file: 'js/content-script.js',
		runAt: 'document_start',
		frameId: frameId
	}).catch(exceptionHandler);
	browser.tabs.insertCSS(tabId, {
		file: 'css/button.css',
		runAt: 'document_start',
		frameId: frameId,
		cssOrigin: 'user'
	}).catch(exceptionHandler);
}
/*
* For supressing errors about trying to re-delcare variable on injections overlapping,
* and about trying to inject scripts into forbidden tabs
*/
function exceptionHandler(e){}

/* Listens for download request from content script */
browser.runtime.onMessage.addListener(function(message, sender){
	downloader.saveFile(message, sender.tab.id);
});
/* For options initialization after installation */
browser.runtime.onInstalled.addListener(function(){
	browser.runtime.openOptionsPage();
});

/*
* Files downloader
* Extracts filename from url, prepares filepath considering savePath option.
* Sends message about duplicated files to content script.
*/
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
	getFilename: function(url){
		return decodeURI(url).split('?')[0].match(/\/([^/]+\.[\w\d]{3,4})(\/[^.]+)?$/)[1];
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
