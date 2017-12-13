'use strict';

let isCute; // used for content scripts enabling/disabling

/* Listens for download request from content script */
browser.runtime.onMessage.addListener(function(message, sender){
    download(message, sender.tab.id);
});

/* For options initialization after installation */
browser.runtime.onInstalled.addListener(initSettings);
function initSettings(){
    browser.runtime.onInstalled.removeListener(initSettings);
    browser.storage.local.get().then(function(currentSettings){
        let actualSettingsNames = Object.keys(settingsDefault),
            currentSettingsNames = Object.keys(currentSettings),
            newSettings = {},
            newSettingsList = arrayDiff(actualSettingsNames, currentSettingsNames),
            obsoleteSettingsList = arrayDiff(currentSettingsNames, actualSettingsNames);

        newSettingsList.forEach(function(settingName){
            newSettings[settingName] = settingsDefault[settingName];
        });

        if (currentSettings.savePath && !currentSettings.defaultSavePath) { //TODO remove this in next version
            newSettings.defaultSavePath = currentSettings.savePath;
        }

        browser.storage.local.set(newSettings);
        browser.storage.local.remove(obsoleteSettingsList);
    });
}

function arrayDiff(arr1, arr2){
    return arr1.filter(x => arr2.indexOf(x) === -1);
}

/* Turns on/off content script across all tabs */
function setCuteState(state){
    let stateProps = state ? {text: 'on', color: '#6D6'} : {text: 'off', color: '#D66'};

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
