'use strict';

const optionsDefaults = {
	savePath: 	'',
	minSize: 	256,
	exclusions: 'de-video-thumb de-ytube de-file-img html5-main-video vjs-tech',
	icon:		null
};

function loadOptions(){
	browser.storage.local.get(optionsDefaults).then(function(result){
		Object.keys(optionsDefaults).forEach(function(key){
			document.querySelector('#' + key).value = result[key];
		});
		saveOptions();
	});
}

function saveOptions(){
	let options = {};
	Object.keys(optionsDefaults).forEach(function(key){
		options[key] = document.querySelector('#' + key).value;
	});
	browser.storage.local.set(options);
}

function resetOptions(){
	browser.storage.local.set(optionsDefaults);
	loadOptions();
}

let fileInput = document.querySelector('#file-input');
fileInput.addEventListener('change', function(){
	let reader = new FileReader();
	reader.readAsDataURL(fileInput.files[0]);
	reader.onload = function(){
		if (reader.result.length > 1048576) {return;} //TODO find out max allowed option length, add error message
		document.querySelector('#icon').value = reader.result;
		document.querySelector('#icon-display').style.background = 'url("' + reader.result + '") center/100px no-repeat';
	};
});
document.querySelector('#save').addEventListener('click', saveOptions);
document.querySelector('#reset').addEventListener('click', resetOptions);
document.addEventListener('DOMContentLoaded', loadOptions);
