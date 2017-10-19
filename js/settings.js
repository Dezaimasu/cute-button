'use strict';

const elem = {};
let folders;

/*
-------------------- Generic functions --------------------
*/
function loadOptions(){
    browser.storage.local.get(settingsDefault).then(function(result){
        Object.keys(settingsDefault).forEach(function(key){
            elem[key][elem[key].de_val] = result[key];
        });
        refreshIcon();
        refreshFolders(result.folders);
        saveOptions();
    });
}

function saveOptions(){
    let settings = {};
    prepareCurrentFoldersForSave();
    Object.keys(settingsDefault).forEach(function(key){
        settings[key] = elem[key][elem[key].de_val];
    });
    settings.folders = folders;
    browser.storage.local.set(settings);
    disableSave();
}

function resetOptions(){
    Object.keys(settingsDefault).forEach(function(key){
        elem[key][elem[key].de_val] = settingsDefault[key];
    });
    refreshIcon();
    refreshFolders(settingsDefault.folders);
    enableSave();
}

function disableSave(){
    elem.save.disabled = true;
}

function enableSave(){
    elem.save.disabled = false;
}

/*
-------------------- Icon --------------------
*/
function refreshIcon(){
    elem['de-cute-id'].style.backgroundImage = elem.icon.value;
}

function fileInputListener(){
    let reader = new FileReader();
    reader.readAsDataURL(elem.fileInput.files[0]);
    reader.onload = function(){
        if (reader.result.length > 2097152) {
            console.log(reader.result.length); //TODO add proper error message
            return;
        }
        elem.icon.value = 'url("' + reader.result + '")';
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
    let newFolder = elem.blankFolder.cloneNode(true);

    newFolder.removeAttribute('id');
    newFolder.querySelector('.key').addEventListener('keyup', keyInputListener);
    newFolder.querySelector('.deleteFolder').addEventListener('click', deleteFolder);
    if (folderSettings) {
    	fillFolder(newFolder, folderSettings);
    }
    elem.blankFolder.parentNode.insertBefore(newFolder, elem.addFolderContainer);
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
        otherElems = ['blankFolder', 'addFolder', 'addFolderContainer', 'save', 'reset', 'fileInput', 'de-cute-id'];

    settingsElems.forEach(function(name){
        elem[name] = document.querySelector('#' + name);
        elem[name].de_val = elem[name].type === 'checkbox' ? 'checked' : 'value';
    });
    otherElems.forEach(function(name){
        elem[name] = document.querySelector('#' + name);
    });
}

function init(){
    initSelectors();

    elem.fileInput.addEventListener('change', fileInputListener);
    elem.save.addEventListener('click', saveOptions);
    elem.reset.addEventListener('click', resetOptions);
    elem.addFolder.addEventListener('click', function(event){
        addNewFolder();
        enableSave();
    });
    document.querySelectorAll('select, input').forEach(function(elem){
        elem.addEventListener('input', enableSave);
    });

    disableSave();
    loadOptions();
}

document.addEventListener('DOMContentLoaded', init);
