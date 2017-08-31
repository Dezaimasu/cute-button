'use strict';

const optionsDefaults = {
	savePath: 	'',
	minSize: 	256,
	exclusions: 'de-video-thumb de-ytube de-file-img html5-main-video vjs-tech',
	icon:		browser.extension.getURL('bestgirl.png')
};
const elem = {};

function loadOptions(){
	browser.storage.local.get(optionsDefaults).then(function(result){
		Object.keys(optionsDefaults).forEach(function(key){
			elem[key].value = result[key];
		});
		showIcon(elem.icon.value);
		saveOptions();
	});
}

function saveOptions(){
	let options = {};
	Object.keys(optionsDefaults).forEach(function(key){
		options[key] = elem[key].value;
	});
	browser.storage.local.set(options);
}

function resetOptions(){
	browser.storage.local.set(optionsDefaults);
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
	let optionsElems = Object.keys(optionsDefaults),
		otherElems = ['save', 'reset', 'iconDisplay', 'fileInput'];

	optionsElems.concat(otherElems).forEach(function(a){
		elem[a] = document.querySelector('#' + a);
	});
}

initSelectors();

elem.fileInput.addEventListener('change', fileInputListener);
elem.save.addEventListener('click', saveOptions);
elem.reset.addEventListener('click', resetOptions);
document.addEventListener('DOMContentLoaded', loadOptions);
