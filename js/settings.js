'use strict';

const settingsDefaults = {
	savePath: 	'',
	minSize: 	256,
	exclusions: 'de-video-thumb de-ytube de-file-img html5-main-video vjs-tech',
	icon:		browser.extension.getURL('bestgirl.png')
};
const elem = {};

function loadOptions(){
	browser.storage.local.get(settingsDefaults).then(function(result){
		Object.keys(settingsDefaults).forEach(function(key){
			elem[key].value = result[key];
		});
		showIcon(elem.icon.value);
		saveOptions();
	});
}

function saveOptions(){
	let settings = {};
	Object.keys(settingsDefaults).forEach(function(key){
		settings[key] = elem[key].value;
	});
	browser.storage.local.set(settings);
}

function resetOptions(){
	browser.storage.local.set(settingsDefaults);
	loadOptions();
}

function showIcon(encodedIcon){
	elem.iconDisplay.style.backgroundImage = 'url("' + encodedIcon + '")';
}

function fileInputListener(){
	let reader = new FileReader();
	reader.readAsDataURL(elem.fileInput.files[0]);
	reader.onload = function(){
		if (reader.result.length > 2097152) {
			console.log(reader.result.length); //TODO add proper error message
			return;
		}
		elem.icon.value = reader.result;
		showIcon(reader.result);
	};
}

function initSelectors(){
	let settingsElems = Object.keys(settingsDefaults),
		otherElems = ['save', 'reset', 'iconDisplay', 'fileInput'];

	settingsElems.concat(otherElems).forEach(function(a){
		elem[a] = document.querySelector('#' + a);
	});
}

initSelectors();

elem.fileInput.addEventListener('change', fileInputListener);
elem.save.addEventListener('click', saveOptions);
elem.reset.addEventListener('click', resetOptions);
document.addEventListener('DOMContentLoaded', loadOptions);
