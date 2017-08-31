const optionsDefaults = {
	savePath: 	'',
	minSize: 	256,
	exclusions: 'de-video-thumb de-ytube de-file-img html5-main-video vjs-tech'
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
	Object.keys(optionsDefaults).forEach(function(key){
		document.querySelector('#' + key).value = optionsDefaults[key];
	});
}

document.querySelector('#save').addEventListener('click', saveOptions);
document.querySelector('#reset').addEventListener('click', resetOptions);
document.addEventListener('DOMContentLoaded', loadOptions);
