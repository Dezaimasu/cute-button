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
  chrome.scripting.insertCSS({
    files : ['css/button.css'],
    origin: 'USER',
    target: {
      tabId     : tabId,
      allFrames : true,
    },
    // runAt : 'document_start', // TODO: v3 replacement?
  }).then(() => {
    if (chrome.runtime.lastError) {return;}
    chrome.tabs.sendMessage(tabId, 'css_injected');
  });
}

function switchPageStyles(tabId, style, turnOn){
  const action = turnOn ? 'insertCSS' : 'removeCSS';
  chrome.scripting[action]({
    css   : style,
    origin: 'USER',
    target: {
      tabId     : tabId,
      allFrames : true,
    },
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

    chrome.storage.local.set(newSettings);
    chrome.storage.local.remove(obsoleteSettingsList);
  });
}

/* Turns on/off content script across all tabs */
function setCuteState(state){
  const stateProps = state ? {text: 'on', color: '#6D6'} : {text: 'off', color: '#D66'};

  chrome.action.setBadgeText({text: stateProps.text});
  chrome.action.setBadgeBackgroundColor({color: stateProps.color});
}

chrome.action.onClicked.addListener(() => {
  chrome.storage.local.get('isCute', items => chrome.storage.local.set({'isCute': !items.isCute}));
});

chrome.storage.onChanged.addListener(changes => {
  if (typeof changes.isCute === 'undefined') {return;}
  setCuteState(changes.isCute.newValue);
});
chrome.storage.local.get('isCute', items => setCuteState(items.isCute));

if (browser !== undefined) {
  browser.runtime.getBrowserInfo().then(info => {
    if (info.name === 'Firefox' && info.version.split('.')[0] >= 70) {
      browser.storage.session.set({'~canUseRefHeader': true});
    }
  });
}
