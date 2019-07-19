'use strict';

const settingsDefault = {
    minSize                 : 256,
    exclusions              : '.de-video-thumb, .de-ytube, .de-file-img, .html5-main-video',
    icon                    : `url("${chrome.extension.getURL('bestgirl.png')}")`,
    hideButton              : false,
    isCute                  : true,
    position                : 'top-left',
    placeUnderCursor        : false,
    saveOnHover             : false,
    showSaveDialog          : false,
    forbidDuplicateFiles    : true,
    saveFullSized           : true,
    domainExclusions        : '',
    styleForSaveMark        : '',

    advancedMoe             : false,

    // settings for advanced mo(d)e only
    folders                 : [],

    // settings for regular mo(d)e only
    defaultSavePath         : '',
    disableSpacebarHotkey   : false,
};
