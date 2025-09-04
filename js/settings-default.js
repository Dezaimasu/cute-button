'use strict';

const defaultSettings = {
  defaultSavePath       : '',
  minSize               : 256,
  exclusions            : '.de-video-thumb, .de-ytube, .de-file-img, .html5-main-video, [alt="Subreddit Icon"], [src^="https://www.google.com/recaptcha/"]',
  icon                  : `url("${chrome.runtime.getURL('bestgirl.png')}")`,
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
