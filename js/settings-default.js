'use strict';

const settingsDefault = {
    defaultSavePath         : '',
    minSize                 : 256,
    exclusions              : '.de-video-thumb, .de-ytube, .de-file-img, .html5-main-video',
    icon                    : `url("${chrome.extension.getURL('bestgirl.png')}")`,
    hideButton              : false,
    isCute                  : true,
    position                : 'top-left',
    folders                 : [
        {domain: '', key: ' ', keyCode: 32, modifier: '',        mouseButton: 0, path: '::filename::'},
        {domain: '', key: ' ', keyCode: 32, modifier: 'ctrlKey', mouseButton: 2, path: '::original_filename::'},
    ],
    placeUnderCursor        : false,
    saveOnHover             : false,
    showSaveDialog          : false,
    forbidDuplicateFiles    : true,
    saveFullSized           : true,
    domainExclusions        : '',
    disableSpacebarHotkey   : false,
    styleForSaveMark        : '',
};
