'use strict';

const setting = {}, elem = {};
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
    chrome.storage.local.get(settingsDefault, result => {
        setOptionsValues(result);
        additionalOptionsProcessing(result);
        saveOptions();
    });
}

function saveOptions(){
    const newSettings = {};
    prepareCurrentFoldersForSave();
    prepareCss();
    Object.keys(settingsDefault).forEach(optionName => newSettings[optionName] = getValue(optionName));
    newSettings.folders = folders;
    chrome.storage.local.set(newSettings);
    disableSave();
}

function resetOptions(){
    setOptionsValues(settingsDefault);
    additionalOptionsProcessing(settingsDefault);
    enableSave();
}

function setOptionsValues(optionsValues){
    Object.keys(settingsDefault).forEach(optionName => setValue(optionName, optionsValues[optionName]));
}

function getValue(optionName){
    return setting[optionName][setting[optionName].dataset.valueLocation];
}

function setValue(optionName, optionValue){
    setting[optionName][setting[optionName].dataset.valueLocation] = optionValue;
}

function disableSave(){
    elem['save'].disabled = true;
}

function enableSave(){
    elem['save'].disabled = false;
}

function showMessage(message, type){
    elem['message'].textContent = message;
    elem['message'].classList.add(type);
    setTimeout(() => {
        elem['message'].textContent = '';
        elem['message'].classList.remove(type);
    }, 3000);
}

function additionalOptionsProcessing(options){
    refreshIcon();
    refreshFolders(options.folders);
}

function show(elemName){
    elem[elemName].classList.remove('hidden-block');
}
function hide(elemName){
    elem[elemName].classList.add('hidden-block');
}
function toggle(elemName){
    elem[elemName].classList.toggle('hidden-block');
}

/*
-------------------- Icon --------------------
*/
function refreshIcon(){
    elem['de-cute-id'].style.backgroundImage = setting['icon'].value;
}

function fileInputListener(){
    const reader = new FileReader();
    reader.readAsDataURL(elem['file-input'].files[0]);
    reader.onload = function(){
        if (reader.result.length > 2097152) {
            showMessage('File is too big (~2MB maximum).', 'error');
            return;
        }
        setting['icon'].value = `url("${reader.result}")`;
        refreshIcon();
    };
}

/*
-------------------- Custom Directories --------------------
*/
function refreshFolders(foldersSettings){
    document.querySelectorAll('.folder').forEach(folderElem => folderElem.remove());
    folders = foldersSettings;
    folders.forEach(addNewFolder);
    if (folders.length > 0) {
        show('folders-table');
        hide('toggle-folders');
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
    const newFolder = elem['blank-folder'].cloneNode(true);

    newFolder.removeAttribute('id');
    newFolder.querySelector('.key').addEventListener('keyup', keyInputListener);
    newFolder.querySelector('.delete-folder').addEventListener('click', deleteFolder);
    enableInputListeners(newFolder);
    if (folderSettings) {
        fillFolder(newFolder, folderSettings);
    }
    elem['add-folder-container'].parentNode.insertBefore(newFolder, elem['add-folder-container']);
}

function deleteFolder(event){
    event.target.parentNode.parentNode.remove();
    enableSave();
}

function keyInputListener(event){
    if (event.keyCode === 32) {event.target.value = ''; return;}
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
    const settingsElems = Object.keys(settingsDefault),
        otherElems = [
            'blank-folder',
            'add-folder',
            'add-folder-container',
            'toggle-folders',
            'folders-table',
            'toggle-folders-rules',
            'folders-rules',
            'toggle-basic-rules',
            'basic-rules',
            'save',
            'reset',
            'file-input',
            'message',
            'save-mark-example',
            'de-cute-id',
        ];

    settingsElems.forEach(name => {
        setting[name] = document.querySelector(`#${name}`);
        setting[name].dataset.valueLocation = setting[name].type === 'checkbox' ? 'checked' : 'value';
    });
    otherElems.forEach(name => {
        elem[name] = document.querySelector(`#${name}`);
    });
}

function enableInputListeners(inputsContainer){
    inputsContainer.querySelectorAll('select, input').forEach(editableElem => {
        editableElem.addEventListener('input', event => {
            enableSave();
            if (!event.target.classList.contains('path')) {return;}
            checkSavePath(event.target);
        });
    });
}

function enableToggles(){
    const toggles = {
        'toggle-basic-rules'    : 'basic-rules',
        'toggle-folders-rules'  : 'folders-rules',
        'toggle-folders'        : 'folders-table',
    };
    Object.entries(toggles).forEach(([toggleName, togglableElemName]) => {
        elem[toggleName].addEventListener('click', () => toggle(togglableElemName));
    });
}

function init(){
    const messages = {
        success: chrome.i18n.getMessage('settings_messageSuccess'),
        invalidPath: chrome.i18n.getMessage('settings_messageInvalidPath'),
    };

    i18n();
    initSelectors();

    elem['save-mark-example'].addEventListener('click', setExampleCss);
    elem['file-input'].addEventListener('change', fileInputListener);
    elem['reset'].addEventListener('click', resetOptions);
    elem['save'].addEventListener('click', event => {
        if (allSavePathsAreValid()) {
            saveOptions();
            showMessage(messages.success);
        } else {
            disableSave();
            showMessage(messages.invalidPath, 'error');
        }
    });
    elem['add-folder'].addEventListener('click', event => {
        addNewFolder();
        enableSave();
    });

    enableToggles();
    enableInputListeners(document);
    disableSave();
    loadOptions();
}

document.addEventListener('DOMContentLoaded', init);
