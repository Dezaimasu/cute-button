'use strict';

const settingsDefault = {
	savePath: 	'',
	minSize: 	256,
	exclusions: 'de-video-thumb de-ytube de-file-img html5-main-video vjs-tech',
	icon:		wrapIconForBgImage(browser.extension.getURL('bestgirl.png'))
};
const elem = {};

function loadOptions(){
	browser.storage.local.get(settingsDefault).then(function(result){
		Object.keys(settingsDefault).forEach(function(key){
			elem[key].value = result[key];
		});
		refreshIcon();
		saveOptions();
	});
}

function saveOptions(){
	let settings = {};
	Object.keys(settingsDefault).forEach(function(key){
		settings[key] = elem[key].value;
	});
	browser.storage.local.set(settings);
}

function resetOptions(){
	Object.keys(settingsDefault).forEach(function(key){
		elem[key].value = settingsDefault[key];
	});
	refreshIcon();
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

function initSelectors(){
	let settingsElems = Object.keys(settingsDefault),
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
