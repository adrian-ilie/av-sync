document.addEventListener('DOMContentLoaded', contedLoadedActions);
function contedLoadedActions() {
	navigator.mediaDevices.ondevicechange = function(event) {
		processMediaDevices();
	}
}

function processMediaDevices() {
	chrome.storage.local.get({autoToggleAudioDevice: false} , function (items) {	

	if(items.autoToggleAudioDevice === true)
	{
		navigator.mediaDevices.enumerateDevices()
		.then(function(devices) {		  
			chrome.storage.local.get({audioDevice: {}}, 
				(values) => {								
								const currentDefaultAudioDevice = getDefaultAudioDevice(devices);
								
								if(currentDefaultAudioDevice !== null && 
									currentDefaultAudioDevice !== undefined &&
									currentDefaultAudioDevice.deviceId === values.audioDevice.deviceId)
								{
									chrome.runtime.sendMessage({message: "performAudioDeviceConnectedActions", audioDevice: currentDefaultAudioDevice});
								}
								else
								{
									chrome.runtime.sendMessage({message: "performAudioDeviceDisconnectedActions"});
								}							
							});
		});
	}
  });
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