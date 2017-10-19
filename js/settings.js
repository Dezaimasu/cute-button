'use strict';

const setting = {}, elem = {};
let folders;

/*
-------------------- Generic functions --------------------
*/
function loadOptions(){
    browser.storage.local.get(settingsDefault).then(function(result){
        Object.keys(settingsDefault).forEach(function(key){
            setting[key][setting[key].dataset.valueLocation] = result[key];
        });
        refreshIcon();
        refreshFolders(result.folders);
        saveOptions();
    });
}

function saveOptions(){
    let newSettings = {};
    prepareCurrentFoldersForSave();
    Object.keys(settingsDefault).forEach(function(key){
        newSettings[key] = setting[key][setting[key].dataset.valueLocation];
    });
    newSettings.folders = folders;
    browser.storage.local.set(newSettings);
    disableSave();
}

function resetOptions(){
    Object.keys(settingsDefault).forEach(function(key){
        setting[key][setting[key].dataset.valueLocation] = settingsDefault[key];
    });
    refreshIcon();
    refreshFolders(settingsDefault.folders);
    enableSave();
}

function disableSave(){
    elem['save'].disabled = true;
}

function enableSave(){
    elem['save'].disabled = false;
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
            console.log(reader.result.length); //TODO add proper error message
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
    newFolder.querySelectorAll('select, input').forEach(function(editableElem){
        editableElem.addEventListener('input', enableSave);
    });
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
-------------------- Initialization --------------------
*/
function initSelectors(){
    let settingsElems = Object.keys(settingsDefault),
        otherElems = ['blank-folder', 'add-folder', 'add-folder-container', 'save', 'reset', 'file-input', 'de-cute-id'];

    settingsElems.forEach(function(name){
        setting[name] = document.querySelector('#' + name);
        setting[name].dataset.valueLocation = setting[name].type === 'checkbox' ? 'checked' : 'value';
    });
    otherElems.forEach(function(name){
        elem[name] = document.querySelector('#' + name);
    });
}

function init(){
    initSelectors();

    elem['file-input'].addEventListener('change', fileInputListener);
    elem['save'].addEventListener('click', saveOptions);
    elem['reset'].addEventListener('click', resetOptions);
    elem['add-folder'].addEventListener('click', function(event){
        addNewFolder();
        enableSave();
    });
    document.querySelectorAll('select, input').forEach(function(editableElem){
        editableElem.addEventListener('input', enableSave);
    });

    disableSave();
    loadOptions();
}

document.addEventListener('DOMContentLoaded', init);
