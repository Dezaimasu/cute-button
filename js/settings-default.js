'use strict';

const defaultSettings = {
  defaultSavePath       : '',
  minSize               : 256,
  exclusions            : '.de-video-thumb, .de-ytube, .de-file-img, .html5-main-video, [alt="Subreddit Icon"], [src^="https://www.google.com/recaptcha/"]',
  icon                  : undefined,
  originalNameByDefault : false,
  hideButton            : false,
  isCute                : true,
  position              : 'top-left',
  folders               : [],
  placeUnderCursor      : false,
  saveOnHover           : false,
  showSaveDialog        : false,
  forbidDuplicateFiles  : false,
  saveFullSized         : true,
  domainExclusions      : '',
  disableSpacebarHotkey : false,
  styleForSaveMark      : '',
  checkByRealImageSize  : true,
  verticalOffset        : 6,
  horizontalOffset      : 6,
};

(function setDefaultIcon(){
  fetch(chrome.runtime.getURL('bestgirl.png')).then(response => {
    const reader = new FileReader();
    reader.onload = () => {
      defaultSettings.icon = `url("${reader.result}")`;
    };
    response.blob().then(blob => reader.readAsDataURL(blob));
  }).catch(() => {
    defaultSettings.icon = `url("${chrome.runtime.getURL('bestgirl.png')}")`;
  });
})();
