'use strict';

const settings = {}, elems = {};
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
    return settings[optionName][settings[optionName].dataset.valueLocation];
}

function setValue(optionName, optionValue){
    settings[optionName][settings[optionName].dataset.valueLocation] = optionValue;
}

function disableSave(){
    elems['save'].disabled = true;
}

function enableSave(){
    elems['save'].disabled = false;
}

function showMessage(message, type){
    elems['message'].textContent = message;
    elems['message'].classList.add(type);
    setTimeout(() => {
        elems['message'].textContent = '';
        elems['message'].classList.remove(type);
    }, 3000);
}

function additionalOptionsProcessing(options){
    refreshIcon();
    refreshFolders(options.folders);
}

function show(elemName){
    elems[elemName].classList.remove('hidden-block');
}
function hide(elemName){
    elems[elemName].classList.add('hidden-block');
}
function toggle(elem){
    elem.classList.toggle('hidden-block');
}

/*
-------------------- Icon --------------------
*/
function refreshIcon(){
    elems['de-cute-id'].style.backgroundImage = settings['icon'].value;
}

function fileInputListener(){
    const reader = new FileReader();
    reader.readAsDataURL(elems['file-input'].files[0]);
    reader.onload = function(){
        if (reader.result.length > 2097152) {
            showMessage('File is too big (~2MB maximum).', 'error');
            return;
        }
        settings['icon'].value = `url("${reader.result}")`;
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
    const newFolder = elems['blank-folder'].cloneNode(true);

    newFolder.removeAttribute('id');
    newFolder.querySelector('.key').addEventListener('keyup', keyInputListener);
    newFolder.querySelector('.delete-folder').addEventListener('click', deleteFolder);
    enableInputListeners(newFolder);
    if (folderSettings) {
        fillFolder(newFolder, folderSettings);
    }
    elems['add-folder-container'].parentNode.insertBefore(newFolder, elems['add-folder-container']);
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
    const settingsElems = Object.keys(settingsDefault),
        otherElems = [
            'blank-folder',
            'add-folder',
            'add-folder-container',
            'folders-table',
            'save',
            'reset',
            'file-input',
            'message',
            'save-mark-example',
            'de-cute-id',
        ];

    settingsElems.forEach(name => {
        settings[name] = document.querySelector(`#${name}`);
        settings[name].dataset.valueLocation = settings[name].type === 'checkbox' ? 'checked' : 'value';
    });
    otherElems.forEach(name => {
        elems[name] = document.querySelector(`#${name}`);
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

    elems['save-mark-example'].addEventListener('click', setExampleCss);
    elems['file-input'].addEventListener('change', fileInputListener);
    elems['reset'].addEventListener('click', resetOptions);
    elems['save'].addEventListener('click', event => {
        if (allSavePathsAreValid()) {
            saveOptions();
            showMessage(messages.success);
        } else {
            disableSave();
            showMessage(messages.invalidPath, 'error');
        }
    });
    elems['add-folder'].addEventListener('click', event => {
        addNewFolder();
        enableSave();
    });

    enableToggles();
    enableInputListeners(document);
    disableSave();
    loadOptions();
}

document.addEventListener('DOMContentLoaded', init);
