'use strict';

const settingsDefault = {
    savePath                : '',
    minSize                 : 256,
    exclusions              : 'de-video-thumb de-ytube de-file-img html5-main-video vjs-tech',
    icon                    : wrapIconForBgImage(browser.extension.getURL('bestgirl.png')),
    originalNameByDefault   : false,
    hideButton              : false,
};
const elem = {};

function loadOptions(){
    browser.storage.local.get(settingsDefault).then(function(result){
        Object.keys(settingsDefault).forEach(function(key){
            elem[key][elem[key].de_val] = result[key];
        });
        refreshIcon();
        saveOptions();
    });
}

function saveOptions(){
    let settings = {};
    Object.keys(settingsDefault).forEach(function(key){
        settings[key] = elem[key][elem[key].de_val];
    });
    browser.storage.local.set(settings);
    disableSave();
}

function resetOptions(){
    Object.keys(settingsDefault).forEach(function(key){
        elem[key][elem[key].de_val] = settingsDefault[key];
    });
    refreshIcon();
    enableSave();
}

function refreshIcon(){
    elem.iconDisplay.style.backgroundImage = elem.icon.value;
}
function wrapIconForBgImage(icon){
    return 'url("' + icon + '")';
}

function fileInputListener(){
    let reader = new FileReader();
    reader.readAsDataURL(elem.fileInput.files[0]);
    reader.onload = function(){
        if (reader.result.length > 2097152) {
            console.log(reader.result.length); //TODO add proper error message
            return;
        }
        elem.icon.value = wrapIconForBgImage(reader.result);
        refreshIcon();
    };
}

function disableSave(){
    elem.save.disabled = true;
}
function enableSave(){
    elem.save.disabled = false;
}

function initSelectors(){
    let settingsElems = Object.keys(settingsDefault),
        otherElems = ['save', 'reset', 'iconDisplay', 'fileInput'];

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
    document.querySelectorAll('input:not([type=hidden])').forEach(function(elem){
        elem.addEventListener('input', enableSave);
    });

    disableSave();
    loadOptions();
}

document.addEventListener('DOMContentLoaded', init);
