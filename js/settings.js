'use strict';

const setting = {}, elem = {};
let folders;

/*
-------------------- Generic functions --------------------
*/
function loadOptions(){
    browser.storage.local.get(settingsDefault).then(function(result){
        Object.keys(settingsDefault).forEach(optionName => setValue(optionName, result[optionName]));
        refreshIcon();
        refreshFolders(result.folders);
        saveOptions();
        document.querySelectorAll('.path').forEach(pathElem => checkSavePath(pathElem)); // to check previously saved invalid paths; could be removed later
    });
}

function saveOptions(){
    let newSettings = {};
    prepareCurrentFoldersForSave();
    Object.keys(settingsDefault).forEach(optionName => newSettings[optionName] = getValue(optionName));
    newSettings.folders = folders;
    browser.storage.local.set(newSettings);
    disableSave();
}

function resetOptions(){
    Object.keys(settingsDefault).forEach(optionName => setValue(optionName, settingsDefault[optionName]));
    refreshIcon();
    refreshFolders(settingsDefault.folders);
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
    setTimeout(function(){
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
    let reader = new FileReader();
    reader.readAsDataURL(elem['file-input'].files[0]);
    reader.onload = function(){
        if (reader.result.length > 2097152) {
            showMessage('File is too big (~2MB maximum).', 'error');
            return;
        }
        setting['icon'].value = 'url("' + reader.result + '")';
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
    let currentFoldersList = [];
    document.querySelectorAll('.folder').forEach(function(folderElem){
        let folderSettings = buildFolderSettings(folderElem);
        if (!folderSettings.key || !folderSettings.keyCode) {return;}
        currentFoldersList.push(folderSettings);
    });
    folders = currentFoldersList;
}

function addNewFolder(folderSettings = null){
    let newFolder = elem['blank-folder'].cloneNode(true);

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
    return {
        key     : folderElem.querySelector('.key').value,
        keyCode : Number(folderElem.querySelector('.keyCode').value),
        modifier: folderElem.querySelector('.modifier').value,
        path    : folderElem.querySelector('.path').value
    };
}

/*
-------------------- Save path --------------------
*/

function allSavePathsAreValid(){
    return !document.querySelector('.invalid-path');
}

function checkSavePath(pathElem){
    let isValid = isValidPath(pathElem.value);
    pathElem.classList.toggle('invalid-path', !isValid);
    return isValid;
}

function isValidPath(path){
    return !/^(\s*([A-Z]:)|(\\)|(\/))/i.test(path);
}

/*
-------------------- Initialization --------------------
*/
function initSelectors(){
    let settingsElems = Object.keys(settingsDefault),
        otherElems = ['blank-folder', 'add-folder', 'add-folder-container', 'save', 'reset', 'file-input', 'message', 'de-cute-id'];

    settingsElems.forEach(function(name){
        setting[name] = document.querySelector('#' + name);
        setting[name].dataset.valueLocation = setting[name].type === 'checkbox' ? 'checked' : 'value';
    });
    otherElems.forEach(function(name){
        elem[name] = document.querySelector('#' + name);
    });
}

function enableInputListeners(inputsContainer){
    inputsContainer.querySelectorAll('select, input').forEach(function(editableElem){
        editableElem.addEventListener('input', function(event){
            enableSave();
            if (!event.target.classList.contains('path')) {return;}
            checkSavePath(event.target);
        });
    });
}

function init(){
    initSelectors();

    elem['file-input'].addEventListener('change', fileInputListener);
    elem['reset'].addEventListener('click', resetOptions);
    elem['save'].addEventListener('click', function(){
        if (allSavePathsAreValid()) {
            saveOptions();
            showMessage('Settings saved.');
        } else {
            disableSave();
            showMessage('Absolute path is not allowed. Read the rules above.', 'error');
        }
    });
    elem['add-folder'].addEventListener('click', function(event){
        addNewFolder();
        enableSave();
    });

    enableInputListeners(document);
    disableSave();
    loadOptions();
}

document.addEventListener('DOMContentLoaded', init);
