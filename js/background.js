'use strict';

let isCute; // used for content scripts enabling/disabling

/* Listens for messages from content script */
chrome.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender.tab.id;
    switch (message.type) {
        case 'download' : {download(message, tabId); break;}
        case 'style'    : {addStyles(tabId); break;}
    }
});

/* To override "user" originated css rules form other extensions */
function addStyles(tabId){
    chrome.tabs.insertCSS(tabId, {
        allFrames   : true,
        cssOrigin   : 'user',
        runAt       : 'document_start',
        file        : 'css/button.css',
    }, () => {
        if (chrome.extension.lastError) {return;}
        chrome.tabs.sendMessage(tabId, 'css_injected');
    });
}

/* For options initialization after installation */
chrome.runtime.onInstalled.addListener(initSettings);
function initSettings(){
    chrome.runtime.onInstalled.removeListener(initSettings);
    chrome.storage.local.get(null, currentSettings => {
        const actualSettingsNames = Object.keys(settingsDefault),
            currentSettingsNames = Object.keys(currentSettings),
            newSettings = {},
            newSettingsList = arrayDiff(actualSettingsNames, currentSettingsNames),
            obsoleteSettingsList = arrayDiff(currentSettingsNames, actualSettingsNames);

        newSettingsList.forEach(
            settingName => newSettings[settingName] = settingsDefault[settingName]
        );

        chrome.storage.local.set(newSettings);
        chrome.storage.local.remove(obsoleteSettingsList);
    });
}

function arrayDiff(arr1, arr2){
    return arr1.filter(x => arr2.indexOf(x) === -1);
}

/* Turns on/off content script across all tabs */
function setCuteState(state){
    const stateProps = state ? {text: 'on', color: '#6D6'} : {text: 'off', color: '#D66'};

    isCute = state;
    chrome.browserAction.setBadgeText({text: stateProps.text});
    chrome.browserAction.setBadgeBackgroundColor({color: stateProps.color});
}

chrome.browserAction.onClicked.addListener(() => {
    isCute = !isCute;
    chrome.storage.local.set({'isCute': isCute});
});

chrome.storage.onChanged.addListener(changes => {
    if (typeof changes.isCute === 'undefined') {return;}
    setCuteState(changes.isCute.newValue);
});
chrome.storage.local.get('isCute', items => setCuteState(items.isCute));
