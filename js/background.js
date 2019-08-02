'use strict';

/* Listens for messages from content script */
chrome.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender.tab.id;
    switch (message.type) {
        case 'download'     : {download(tabId, message); break;}
        case 'button_style' : {addButtonStyles(tabId); break;}
        case 'page_style'   : {switchPageStyles(tabId, message.style, message.turnOn); break;}
    }
});

/* To override "user" originated css rules form other extensions */
function addButtonStyles(tabId){
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

function switchPageStyles(tabId, style, turnOn){
    const action = turnOn ? 'insertCSS' : 'removeCSS';
    chrome.tabs[action](tabId, {
        allFrames   : true,
        cssOrigin   : 'user',
        code        : style,
    });
}

/* For options initialization after installation */
chrome.runtime.onInstalled.addListener(initSettings);
function initSettings(details){
    chrome.runtime.onInstalled.removeListener(initSettings);
    chrome.storage.local.get(null, currentSettings => {
        const actualSettingsNames = Object.keys(settingsDefault),
            currentSettingsNames = Object.keys(currentSettings),
            newSettings = {},
            newSettingsList = arrayDiff(actualSettingsNames, currentSettingsNames),
            obsoleteSettingsList = arrayDiff(currentSettingsNames, actualSettingsNames);

        function arrayDiff(arr1, arr2){
            return arr1.filter(x => arr2.indexOf(x) === -1);
        }

        newSettingsList.forEach(
            settingName => newSettings[settingName] = settingsDefault[settingName]
        );

        /* START for converting old settings TODO: remove later */
        if (details.reason === 'update') {
            const previousVersion = Number(details.previousVersion.replace(/\./g, '')),
                previousExclusions = currentSettings['exclusions'];

            if (previousVersion < 62 && !/[.#]/.test(previousExclusions)) {
                newSettings['exclusions'] = previousExclusions.split(' ').map(x => `.${x}`).join(', ');
            }
            if (previousVersion < 65) {
            	newSettings['folders'] = [];
            }
        }
        /* END TODO: remove later */

        chrome.storage.local.set(newSettings);
        chrome.storage.local.remove(obsoleteSettingsList);
    });
}

/* Turns on/off content script across all tabs */
function setCuteState(state){
    const stateProps = state ? {text: 'on', color: '#6D6'} : {text: 'off', color: '#D66'};

    chrome.browserAction.setBadgeText({text: stateProps.text});
    chrome.browserAction.setBadgeBackgroundColor({color: stateProps.color});
}

chrome.browserAction.onClicked.addListener(() => {
    chrome.storage.local.get('isCute', items => chrome.storage.local.set({'isCute': !items.isCute}));
});

chrome.storage.onChanged.addListener(changes => {
    if (typeof changes.isCute === 'undefined') {return;}
    setCuteState(changes.isCute.newValue);
});
chrome.storage.local.get('isCute', items => setCuteState(items.isCute));
