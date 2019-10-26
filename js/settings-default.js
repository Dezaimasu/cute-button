'use strict';

const settingsDefault = {
    defaultSavePath         : '',
    minSize                 : 256,
    exclusions              : '.de-video-thumb, .de-ytube, .de-file-img, .html5-main-video',
    icon                    : `url("${chrome.extension.getURL('bestgirl.png')}")`,
    originalNameByDefault   : false,
    hideButton              : false,
    isCute                  : true,
    position                : 'top-left',
    folders                 : [],
    placeUnderCursor        : false, // TODO: change behavior, show button in the corner closest to the cursor
    saveOnHover             : false,
    showSaveDialog          : false,
    forbidDuplicateFiles    : false,
    saveFullSized           : true,
    domainExclusions        : '',
    disableSpacebarHotkey   : false,
    styleForSaveMark        : '',
    checkByRealImageSize    : true,
};
