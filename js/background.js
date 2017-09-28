'use strict';

let isCute; // used for content scripts enabling/disabling

browser.storage.local.get('isCute').then(items => isCute = items.isCute);
browser.storage.onChanged.addListener(changes => isCute = changes.isCute.newValue);

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
        frameId: frameId
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
function initSettings(){
    let settingsNames = Object.keys(settingsDefault);
    browser.runtime.onInstalled.removeListener(initSettings);
    browser.storage.local.get(settingsNames).then(function(currentSettings){
        settingsNames.forEach(function(settingName){ // god I love callbacks
            if (typeof currentSettings[settingName] === 'undefined') {
                let newSetting = {};
                newSetting[settingName] = settingsDefault[settingName];
                browser.storage.local.set(newSetting);
            }
        });
    });
}

/* Turns on/off content scripts across all tabs */
browser.browserAction.onClicked.addListener(function(){
    let state = isCute ? {text: 'on', color: '#6D6'} : {text: 'off', color: '#D66'};

    browser.browserAction.setBadgeText({text: state.text});
    browser.browserAction.setBadgeBackgroundColor({color: state.color});

    browser.tabs.query({}).then(function(tabs){
        for (let tab of tabs) {
            browser.tabs.sendMessage(tab.id, state.text);
        }
    });
});