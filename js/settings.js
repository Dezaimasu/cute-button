'use strict';

const settingsElems = {}, miscElems = {};
let folders;

/*
-------------------- Localization --------------------
*/
function i18n(){
  document.querySelectorAll('i18n').forEach(
    elem => elem.textContent = chrome.i18n.getMessage(elem.textContent)
  );
  document.querySelectorAll('*[data-i18n]').forEach(
    elem => elem.textContent = chrome.i18n.getMessage(elem.dataset.i18n)
  );
  document.querySelectorAll('*[data-i18n-placeholder]').forEach(
    elem => elem.placeholder = chrome.i18n.getMessage(elem.dataset.i18nPlaceholder)
  );
}

/*
-------------------- Generic functions --------------------
*/
function loadOptions(){
  chrome.storage.local.get(defaultSettings).then(result => {
    setOptionsValues(result);
    additionalOptionsProcessing(result);
    saveOptions();
  });
}

function saveOptions(){
  const newSettings = {};
  prepareCurrentFoldersForSave();
  prepareCss();
  Object.keys(defaultSettings).forEach(optionName => newSettings[optionName] = getValue(optionName));
  newSettings.folders = folders;
  chrome.storage.local.set(newSettings);
  resetIconInput();
  disableSave();
}

function resetOptions(){
  setOptionsValues(defaultSettings);
  additionalOptionsProcessing(defaultSettings);
  enableSave();
}

function setOptionsValues(optionsValues){
  Object.keys(defaultSettings).forEach(optionName => setValue(optionName, optionsValues[optionName]));
}

function getValue(optionName){
  return settingsElems[optionName][settingsElems[optionName].dataset.valueLocation];
}

function setValue(optionName, optionValue){
  settingsElems[optionName][settingsElems[optionName].dataset.valueLocation] = optionValue;
}

function disableSave(){
  miscElems['save'].disabled = true;
}

function enableSave(){
  miscElems['save'].disabled = false;
}

function showMessage(message, type){
  miscElems['message'].textContent = message;
  miscElems['message'].classList.add(type);
  setTimeout(() => {
    miscElems['message'].textContent = '';
    miscElems['message'].classList.remove(type);
  }, 3000);
}

function additionalOptionsProcessing(options){
  refreshIcon();
  refreshFolders(options.folders);
}

function show(elemName){
  miscElems[elemName].classList.remove('hidden-block');
}
function hide(elemName){
  miscElems[elemName].classList.add('hidden-block');
}
function toggle(elem){
  elem.classList.toggle('hidden-block');
}

/*
-------------------- Icon --------------------
*/
function refreshIcon(){
  miscElems['de-cute-id'].style.backgroundImage = getValue('icon');
  miscElems['reset-icon'].disabled = getValue('icon') === defaultSettings.icon;
}

function fileInputListener(){
  const reader = new FileReader();
  reader.onload = function(){
    if (reader.result.length > 2097152) {
      showMessage('File is too big (~2MB maximum).', 'error');
      return;
    }
    setValue('icon', `url("${reader.result}")`);
    refreshIcon();
  };
  reader.readAsDataURL(miscElems['file-input'].files[0]);
}

function resetIcon(){
  setValue('icon', defaultSettings.icon);
  refreshIcon();
  enableSave();
}

function resetIconInput(){
  miscElems['file-input'].value = null;
}

/*
-------------------- Custom Directories --------------------
*/
function refreshFolders(foldersSettings){
  document.querySelectorAll('.folder').forEach(folderElem => folderElem.remove());
  folders = foldersSettings;
  folders.forEach(addNewFolder);
  if (folders.length > 0) {
    show('folders-table-headers');
  }
}

function prepareCurrentFoldersForSave(){
  const currentFoldersList = [];
  document.querySelectorAll('.folder').forEach(folderElem => {
    const folderSettings = buildFolderSettings(folderElem);
    if ((!folderSettings.key || !folderSettings.keyCode) && !folderSettings.mouseButton && !folderSettings.domain) {return;}
    currentFoldersList.push(folderSettings);
  });
  folders = currentFoldersList;
}

function addNewFolder(folderSettings = null){
  const newFolder = miscElems['blank-folder'].cloneNode(true);

  newFolder.removeAttribute('id');
  newFolder.querySelector('.key').addEventListener('keyup', keyInputListener);
  newFolder.querySelector('.delete-folder').addEventListener('click', deleteFolder);
  enableInputListeners(newFolder);
  if (folderSettings) {
    fillFolder(newFolder, folderSettings);
  }
  miscElems['add-folder-container'].parentNode.insertBefore(newFolder, miscElems['add-folder-container']);
  show('folders-table-headers');
}

function deleteFolder(event){
  event.target.parentNode.parentNode.remove();
  enableSave();
}

function keyInputListener(event){
  if (event.key !== event.target.value) {return;}
  event.target.parentNode.querySelector('.keyCode').value = event.keyCode;
}

function fillFolder(folderElem, folderSettings){
  folderElem.querySelector('.domain').value       = folderSettings.domain;
  folderElem.querySelector('.key').value          = folderSettings.key;
  folderElem.querySelector('.keyCode').value      = folderSettings.keyCode;
  folderElem.querySelector('.modifier').value     = folderSettings.modifier;
  folderElem.querySelector('.mouseButton').value  = folderSettings.mouseButton;
  folderElem.querySelector('.path').value         = folderSettings.path;
  folderElem.querySelector('.filename').value     = folderSettings.filename;
}

function buildFolderSettings(folderElem){
  const folderSettings = {
    domain      : folderElem.querySelector('.domain').value,
    key         : folderElem.querySelector('.key').value,
    keyCode     : Number(folderElem.querySelector('.keyCode').value),
    modifier    : folderElem.querySelector('.modifier').value,
    mouseButton : folderElem.querySelector('.mouseButton').value,
    path        : folderElem.querySelector('.path').value,
    filename    : folderElem.querySelector('.filename').value,
  };
  addHotkeyId(folderSettings);

  return folderSettings;
}

function addHotkeyId(folder){
  const pseudoEvent = {keyCode: folder.keyCode};
  pseudoEvent[folder.modifier] = true;
  folder.id = `${pseudoEvent.ctrlKey ? 1 : 0}${pseudoEvent.altKey ? 1 : 0}${pseudoEvent.shiftKey ? 1 : 0}${pseudoEvent.keyCode || '00'}`;
}

/*
-------------------- Save path --------------------
*/

function allSavePathsAreValid(){
  return !document.querySelector('.invalid-path');
}

function checkSavePath(pathElem){
  const isValid = isValidPath(pathElem.value);
  pathElem.classList.toggle('invalid-path', !isValid);
  return isValid;
}

function isValidPath(path){
  return !/^(\s*([A-Z]:)|(\\)|(\/))/i.test(path);
}

/*
-------------------- Custom styles --------------------
*/

function setExampleCss(){
  setValue('styleForSaveMark', 'opacity: 0.4 !important;');
  enableSave();
}

function prepareCss(){
  const cssInputValue = getValue('styleForSaveMark').trim(),
    declarations = cssInputValue && cssInputValue.split(';'),
    preparedDeclarations = [];

  if (!declarations) {return;}
  declarations.forEach(declaration => {
    declaration && preparedDeclarations.push(declaration.replace(/( !important)? *$/, ' !important').trim());
  });

  setValue('styleForSaveMark', preparedDeclarations.join('; '));
}

/*
-------------------- Initialization --------------------
*/
function initSelectors(){
  const settingsElemIds = Object.keys(defaultSettings),
    miscElemIds = [
      'blank-folder',
      'add-folder',
      'add-folder-container',
      'folders-table',
      'folders-table-headers',
      'save',
      'reset',
      'reset-icon',
      'file-input',
      'message',
      'save-mark-example',
      'de-cute-id',
    ];

  settingsElemIds.forEach(name => {
    settingsElems[name] = document.querySelector(`#${name}`);
    settingsElems[name].dataset.valueLocation = settingsElems[name].type === 'checkbox' ? 'checked' : 'value';
  });
  miscElemIds.forEach(name => {
    miscElems[name] = document.querySelector(`#${name}`);
  });
}

function enableInputListeners(inputsContainer){
  inputsContainer.querySelectorAll('select, input, textarea').forEach(editableElem => {
    editableElem.addEventListener('input', event => {
      enableSave();
      if (!event.target.classList.contains('path')) {return;}
      checkSavePath(event.target);
    });
  });
}

function enableToggles(){
  document.querySelectorAll('.toggle').forEach(toggleSwitch => {
    toggleSwitch.addEventListener('click', () => toggle(toggleSwitch.nextElementSibling));
  });
}

function init(){
  const messages = {
    success: chrome.i18n.getMessage('settings_messageSuccess'),
    invalidPath: chrome.i18n.getMessage('settings_messageInvalidPath'),
  };

  i18n();
  initSelectors();

  miscElems['save-mark-example'].addEventListener('click', setExampleCss);
  miscElems['file-input'].addEventListener('change', fileInputListener);
  miscElems['reset-icon'].addEventListener('click', resetIcon);
  miscElems['reset'].addEventListener('click', resetOptions);
  miscElems['save'].addEventListener('click', event => {
    if (allSavePathsAreValid()) {
      saveOptions();
      showMessage(messages.success);
    } else {
      disableSave();
      showMessage(messages.invalidPath, 'error');
    }
  });
  miscElems['add-folder'].addEventListener('click', event => {
    addNewFolder();
    enableSave();
  });

  enableToggles();
  enableInputListeners(document);
  disableSave();
  loadOptions();
}

document.addEventListener('DOMContentLoaded', init);
