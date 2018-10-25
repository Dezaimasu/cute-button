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
        Object.keys(settingsDefault).forEach(optionName => setValue(optionName, result[optionName]));
        refreshIcon();
        refreshFolders(result.folders);
        setPrefixSelector(result.filenamePrefix);
        saveOptions();
        document.querySelectorAll('.path').forEach(pathElem => checkSavePath(pathElem)); // to check previously saved invalid paths; could be removed later
    });
}

function saveOptions(){
    const newSettings = {};
    prepareCurrentFoldersForSave();
    Object.keys(settingsDefault).forEach(optionName => newSettings[optionName] = getValue(optionName));
    newSettings.folders = folders;
    chrome.storage.local.set(newSettings);
    disableSave();
}

function resetOptions(){
    Object.keys(settingsDefault).forEach(optionName => setValue(optionName, settingsDefault[optionName]));
    refreshIcon();
    refreshFolders(settingsDefault.folders);
    setPrefixSelector(settingsDefault.filenamePrefix);
    enableSave();
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
}

function prepareCurrentFoldersForSave(){
    const currentFoldersList = [];
    document.querySelectorAll('.folder').forEach(folderElem => {
        const folderSettings = buildFolderSettings(folderElem);
        if (!folderSettings.key || !folderSettings.keyCode) {return;}
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
    folderElem.querySelector('.key').value      = folderSettings.key;
    folderElem.querySelector('.keyCode').value  = folderSettings.keyCode;
    folderElem.querySelector('.modifier').value = folderSettings.modifier;
    folderElem.querySelector('.path').value     = folderSettings.path;
}

function buildFolderSettings(folderElem){
    const folderSettings = {
        key     : folderElem.querySelector('.key').value,
        keyCode : Number(folderElem.querySelector('.keyCode').value),
        modifier: folderElem.querySelector('.modifier').value,
        path    : folderElem.querySelector('.path').value
    };
    addHotkeyId(folderSettings);

    return folderSettings;
}

function addHotkeyId(folder){
    const pseudoEvent = {keyCode: folder.keyCode};
    pseudoEvent[folder.modifier] = true;
    folder.id = `${pseudoEvent.ctrlKey ? 1 : 0}${pseudoEvent.altKey ? 1 : 0}${pseudoEvent.shiftKey ? 1 : 0}${pseudoEvent.keyCode}`;
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
-------------------- Prefix --------------------
*/

function prefixSelectorListener(){
    if (isTextPrefix(elem['prefix-selector'].value)) {
        setValue('filenamePrefix', '');
        setting['filenamePrefix'].disabled = false;
    } else {
        setValue('filenamePrefix', elem['prefix-selector'].value);
        setting['filenamePrefix'].disabled = true;
    }
}

function setPrefixSelector(prefix){
    if (isTextPrefix(prefix)) {
        elem['prefix-selector'].value = 'text';
        setting['filenamePrefix'].disabled = false;
    } else {
        elem['prefix-selector'].value = prefix;
        setting['filenamePrefix'].disabled = true;
    }
}

function isTextPrefix(value){
    return !['', '::date::', '::time::'].includes(value);
}

/*
-------------------- Initialization --------------------
*/
function initSelectors(){
    const settingsElems = Object.keys(settingsDefault),
        otherElems = ['blank-folder', 'add-folder', 'add-folder-container', 'prefix-selector', 'save', 'reset', 'file-input', 'message', 'de-cute-id'];

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

function init(){
    const messages = {
        success: chrome.i18n.getMessage('settings_messageSuccess'),
        invalidPath: chrome.i18n.getMessage('settings_messageInvalidPath'),
    };

    i18n();
    initSelectors();

    elem['prefix-selector'].addEventListener('change', prefixSelectorListener);
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

    enableInputListeners(document);
    disableSave();
    loadOptions();
}

document.addEventListener('DOMContentLoaded', init);
