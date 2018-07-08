'use strict';

let isCute; // used for content scripts enabling/disabling

/* Listens for messages from content script */
browser.runtime.onMessage.addListener(function(message, sender){
    const tabId = sender.tab.id;
    switch (message.type) {
        case 'download' : {download(message, tabId); break;}
        case 'style'    : {addStyles(tabId); break;}
    }
});

/* Adds extension styles */
function addStyles(tabId){
    browser.tabs.insertCSS(tabId, {
        allFrames   : true,
        cssOrigin   : 'user',
        runAt       : 'document_start',
        file        : 'css/button.css',
    });
}

/* For options initialization after installation */
browser.runtime.onInstalled.addListener(initSettings);
function initSettings(){
    browser.runtime.onInstalled.removeListener(initSettings);
    browser.storage.local.get().then(function(currentSettings){
        const actualSettingsNames = Object.keys(settingsDefault),
            currentSettingsNames = Object.keys(currentSettings),
            newSettings = {},
            newSettingsList = arrayDiff(actualSettingsNames, currentSettingsNames),
            obsoleteSettingsList = arrayDiff(currentSettingsNames, actualSettingsNames);

        newSettingsList.forEach(function(settingName){
            newSettings[settingName] = settingsDefault[settingName];
        });

        browser.storage.local.set(newSettings);
        browser.storage.local.remove(obsoleteSettingsList);
    });
}

function arrayDiff(arr1, arr2){
    return arr1.filter(x => arr2.indexOf(x) === -1);
}

/* Turns on/off content script across all tabs */
function setCuteState(state){
    const stateProps = state ? {text: 'on', color: '#6D6'} : {text: 'off', color: '#D66'};

    isCute = state;
    browser.browserAction.setBadgeText({text: stateProps.text});
    browser.browserAction.setBadgeBackgroundColor({color: stateProps.color});
}

browser.browserAction.onClicked.addListener(function(){
    isCute = !isCute;
    browser.storage.local.set({'isCute': isCute});
});

browser.storage.onChanged.addListener(function(changes){
    if (typeof changes.isCute === 'undefined') {return;}
    setCuteState(changes.isCute.newValue);
});
browser.storage.local.get('isCute').then(function(items){
    setCuteState(items.isCute);
});
