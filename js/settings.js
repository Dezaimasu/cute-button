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
    saveCurrentFolders();
    Object.keys(settingsDefault).forEach(function(key){
        settings[key] = elem[key][elem[key].de_val];
    });
    settings.folders = folders; //TODO delet this chthonic abomination
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
    elem.iconDisplay.style.backgroundImage = elem.icon.value;
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
function refreshFolders(foldersSettings = null){
    folders = foldersSettings;
    folders.forEach(function(folder){
        addNewFolder(folder);
    });
}

function saveCurrentFolders(){
    let currentFoldersList = [];
    document.querySelectorAll('.folder').forEach(function(folderElem){
        let folderSettings = buildFolderSettings(folderElem);
        if (!folderSettings.key || !folderSettings.keyCode) {return;}
        currentFoldersList.push(folderSettings);
    });
    folders = currentFoldersList;
}

function addNewFolder(folderSettings = null){
    let newFolder = elem.container.querySelector('tr[data-num="0"]').cloneNode(true); //TODO put hidden blank template elsewhere
    let folders = document.querySelectorAll('.folder');
    let newFolderNum = Number(folders[folders.length - 1].dataset.num) + 1;

    newFolder.querySelector('.key').addEventListener('keyup', function(event){
        if (event.key !== event.target.value) {return;}
        event.target.parentNode.querySelector('.keyCode').value = event.keyCode;
    });
    newFolder.dataset.num = newFolderNum;
    let deleteBtn = newFolder.querySelector('.deleteFolder');
    deleteBtn.dataset.num = newFolderNum;
    deleteBtn.addEventListener('click', deleteFolder);
    newFolder.querySelector('span').innerHTML = '';
    if (folderSettings) {
    	fillFolder(newFolder, folderSettings);
    }
    elem.container.insertBefore(newFolder, elem.addFolderContainer);
}

function fillFolder(folderElem, folderSettings){
    folderElem.querySelector('.key').value      = folderSettings.key;
    folderElem.querySelector('.keyCode').value  = folderSettings.keyCode;
    folderElem.querySelector('.modifier').value = folderSettings.modifier;
    folderElem.querySelector('.path').value     = folderSettings.path;
}

function deleteFolder(event){
    document.querySelector('tr[data-num="' + event.target.dataset.num + '"]').remove();
}
function buildFolderSettings(folderElem){
    return {
        key     : folderElem.querySelector('.key').value,
        keyCode : folderElem.querySelector('.keyCode').value,
        modifier: folderElem.querySelector('.modifier').value,
        path    : folderElem.querySelector('.path').value
    };
}

/*
-------------------- Initialization --------------------
*/
function initSelectors(){
    let settingsElems = Object.keys(settingsDefault),
        otherElems = ['container', 'addFolder', 'addFolderContainer', 'save', 'reset', 'iconDisplay', 'fileInput'];

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
    });
    document.querySelectorAll('select, input').forEach(function(elem){
        elem.addEventListener('input', enableSave);
    });

    disableSave();
    loadOptions();
}

document.addEventListener('DOMContentLoaded', init);
