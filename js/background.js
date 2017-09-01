'use strict';
/*
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
	download(message, sender.tab.id);
});
/* For options initialization after installation */
browser.runtime.onInstalled.addListener(initSettings);
function initSettings(details){
	browser.runtime.onInstalled.removeListener(initSettings);
	// if (details.reason !== 'install') {return;} //TODO uncomment this for next releases
	browser.runtime.openOptionsPage();
}
