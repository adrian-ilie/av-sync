const delayInput = document.getElementById('delayInput');
const delayInputDescription = document.getElementById('delayInputDescription');
const delaySelectorElement = document.getElementById('delaySelector');
const delayNumberElement = document.getElementById("delayNumber");
const maxSelectableDelayElement = document.getElementById('maxSelectableDelay');
const maxAcceptableDelayElement = document.getElementById('maxAcceptableDelay');
const autoToggleAudioDeviceElement = document.getElementById('autoToggleAudioDevice');
const audioDeviceLabelElement = document.getElementById('audioDeviceLabel');
const testDelayButtonElement = document.getElementById('testDelayButton');
const captureDelayButtonElement = document.getElementById('captureDelayButton');
const countdownAudioElement = document.getElementById('countdownAudio');

delayInput.addEventListener("input", processDelayInputChange);
delaySelectorElement.addEventListener('change', processSyncChange);
maxSelectableDelayElement.addEventListener("input", processMaxSelectableDelay);
maxAcceptableDelayElement.addEventListener("input", processMaxAcceptableDelay);
autoToggleAudioDeviceElement.addEventListener("change", processAutoToggleAudioDevice);
testDelayButtonElement.addEventListener("mousedown", processTestDelay);
captureDelayButtonElement.addEventListener("mousedown", captureTestDelay);

function restoreOptions() {
	document.getElementById("delaySelector").focus();

    chrome.storage.local.get({
		syncValue: 0,
		maxSelectableDelayValue: 5000,
		maxAcceptableDelayValue: 25,
		autoToggleAudioDevice: false,
		audioDevice: null
    }, function (items) {
		updateDelayElements(items.syncValue);
		updateMaxSelectableDelayElement(items.maxSelectableDelayValue);
		updateMaxAcceptableDelayElement(items.maxAcceptableDelayValue);
		restoreAutoToggleAudioDevice(items.autoToggleAudioDevice, items.audioDevice);		
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);

function processDelayInputChange()
{
	var isValid = delayInput.checkValidity();
	if(isValid)
	{
		delaySelectorElement.value = delayInput.value;
		updateDelaySeletorTooltip(delayInput.value);
		updateDelayInputDescription(delayInput.value);		
		chrome.runtime.sendMessage({"message" : "processSyncChange", "syncValue": delayInput.value});
	}
	else
	{
		delayInput.reportValidity();
	}
}

function processSyncChange()
{
	delayInput.value = delaySelectorElement.value;
	updateDelaySeletorTooltip(delaySelectorElement.value);
	updateDelayInputDescription(delaySelectorElement.value);
	chrome.runtime.sendMessage({"message" : "processSyncChange", "syncValue": delaySelectorElement.value});
}

function updateDelayInputDescription(value)
{
	if(value < 0)
		{ 
			delayInputDescription.innerHTML = "(Audio will be hastened)";
		}
	else if(value > 0)
		{
			delayInputDescription.innerHTML = "(Audio will be delayed)";
		}
	else 
		{
			delayInputDescription.innerHTML = "(No sync)";
		}
}

function processMaxSelectableDelay()
{
	var isValid = maxSelectableDelayElement.checkValidity();
	if(isValid)
	{
		const sign = Math.sign(delaySelectorElement.value);
		if(maxSelectableDelayElement.value < Math.abs(delaySelectorElement.value))
		{
			updateDelayElements(sign * maxSelectableDelayElement.value);
		}
		delaySelectorElement.setAttribute("min", -maxSelectableDelayElement.value);
		delaySelectorElement.setAttribute("max", maxSelectableDelayElement.value);
		delayInput.setAttribute("min", -maxSelectableDelayElement.value);
		delayInput.setAttribute("max", maxSelectableDelayElement.value);

		chrome.runtime.sendMessage({"message" : "processSyncChange", "syncValue": delaySelectorElement.value});
		chrome.runtime.sendMessage({"message" : "maxSelectableDelayChange", "maxSelectableDelayValue": maxSelectableDelayElement.value});
	}
	else
	{
		maxSelectableDelayElement.reportValidity();
	}
}

function processMaxAcceptableDelay()
{
	var isValid = maxAcceptableDelayElement.checkValidity();
	if(isValid)
	{
		chrome.runtime.sendMessage({"message" : "maxAcceptableDelayChange", "maxAcceptableDelayValue": maxAcceptableDelayElement.value});
	}
	else
	{
		maxAcceptableDelayElement.reportValidity();
	}
}

function processAutoToggleAudioDevice()
{
	updateAutoToggleAudioDevice(autoToggleAudioDeviceElement.checked)
}

function updateDelayElements(syncValue)
{
	delayInput.value = syncValue;
	delaySelectorElement.value = syncValue;
	updateDelaySeletorTooltip(syncValue);
	updateDelayInputDescription(syncValue);
}

function updateDelaySeletorTooltip(syncValue)
{
	var syncValueInSeconds = (syncValue / 1000);
	delayNumberElement.textContent = syncValueInSeconds +' s';
}

function updateMaxSelectableDelayElement(maxSelectableDelay)
{
	maxSelectableDelayElement.value = maxSelectableDelay;
	processMaxSelectableDelay();
}

function updateMaxAcceptableDelayElement(maxAcceptableDelay)
{
	maxAcceptableDelayElement.value = maxAcceptableDelay;
	processMaxAcceptableDelay();
}

function restoreAutoToggleAudioDevice(autoToggleAudioDevice, audioDevice)
{	
	autoToggleAudioDeviceElement.checked = autoToggleAudioDevice;
	if(autoToggleAudioDevice && audioDevice !== null)
	{
		audioDeviceLabelElement.value = audioDevice.label;
		audioDeviceLabelElement.hidden = false;
		
		navigator.mediaDevices.getUserMedia({audio: true, video: false})
		.then(function(devices) {
			audioDeviceLabelElement.value = audioDevice.label; //show already saved device
			audioDeviceLabelElement.hidden = false;
		})
		.catch(function(err) {
		  console.log(err);
		  audioDeviceLabelElement.hidden = false;
		  audioDeviceLabelElement.value = "Permission denied. You need to allow access to microphone in order to access the audio output device.";
		  autoToggleAudioDeviceElement.checked = false;
		  chrome.storage.local.set({autoToggleAudioDevice : false});
		});

		
	}
	else if(!autoToggleAudioDevice)
	{
		audioDeviceLabelElement.hidden = true;
	}
}

function updateAutoToggleAudioDevice(autoToggleAudioDevice)
{
	if(autoToggleAudioDevice)
	{
		navigator.mediaDevices.getUserMedia({audio: true, video: false})
		.then(function(stream) {
			navigator.mediaDevices.enumerateDevices()
				.then(function(devices) {
					var defaultAudioDevice = getDefaultAudioDevice(devices);
					audioDeviceLabelElement.value = defaultAudioDevice.label;
				    audioDeviceLabelElement.hidden = false;
					chrome.runtime.sendMessage({message: "performAudioDeviceConnectedActions", audioDevice: defaultAudioDevice});									
				});
		})
		.catch(function(err) {
		  console.log(err);
		  audioDeviceLabelElement.hidden = false;
		  audioDeviceLabelElement.value = "Permission denied. You need to allow access to microphone in order to access the audio output device.";
		  autoToggleAudioDeviceElement.checked = false;
		  chrome.storage.local.set({autoToggleAudioDevice : false});
		});
	}
	else
	{		
		chrome.storage.local.set({autoToggleAudioDevice : false});
		audioDeviceLabelElement.hidden = true;
		chrome.runtime.sendMessage({message: "performAudioDeviceDisconnectedActions"});									
	}	
}

function getDefaultAudioDevice(devices)
{	
	var defaultAudioDevice;
	devices.forEach(function(deviceForDefault) {
		if(deviceForDefault.kind === 'audiooutput' && deviceForDefault.deviceId === 'default')
		{
			const defaultDeviceName = deviceForDefault.label.replace('Default - ', '');
			
			devices.forEach(function(device) {
				if(device.kind === 'audiooutput' && device.label === defaultDeviceName)
				{
					defaultAudioDevice = device;
					return;					
				}
			});
		}
	});
	
	return defaultAudioDevice;
}

function processTestDelay() {
	testDelayButtonElement.hidden = true;
	captureDelayButtonElement.hidden = false;
	countdownAudio.currentTime = 0;
	countdownAudio.play();
}

function captureTestDelay() {
	testDelayButtonElement.hidden = false;
	captureDelayButtonElement.hidden = true;
	delayInput.value = (Math.round(countdownAudioElement.currentTime * 1000) - 3000) * (-1);
	processDelayInputChange();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if(request.message === "processSyncChange")
	{
		updateDelayElements(request.syncValue);
	}
});
