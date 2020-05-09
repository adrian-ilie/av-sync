const muteVolumeAdjustment = 100000;
const syncAudioElementName = 'syncAudio';
var globalDelayValue = 0;

function getCssProperty(className, property){
   var elem = document.getElementsByClassName(className)[0];
   return window.getComputedStyle(elem, null).getPropertyValue(property);
}

function isVolumeForVideoAudible(videoElement)
{
	return videoElement.volume * muteVolumeAdjustment > 1;
}

function turnVolumeForVideoToInaudible(videoElement){
	if(isVolumeForVideoAudible(videoElement))
	{
		videoElement.volume /= muteVolumeAdjustment;
	}
}

function adjustVolumeForSync(event)
{
	const videoElement = event.target;
							
	if(isVolumeForVideoAudible(videoElement)) //not yet adjusted
	{				
		videoElement.volume /= muteVolumeAdjustment;
					
		var leftVolumeBarValue = getCssProperty("ytp-volume-slider-handle", "left").match(/\d+/);
					
		const audioElement = window.document.getElementById(syncAudioElementName);
		
		if(audioElement != null)
		{
			if(leftVolumeBarValue == 0)
			{
				audioElement.volume = 0;
			}
			else
			{
				audioElement.volume = videoElement.volume * muteVolumeAdjustment;
			}
		}
	}
}

function createSyncAudioElement(url)
{	
	if(document.contains(document.getElementById(syncAudioElementName)))
	{
		document.getElementById(syncAudioElementName).remove();
	}

	var syncAudioElement = document.createElement('audio');
	syncAudioElement.setAttribute("id", syncAudioElementName);
	syncAudioElement.src = url;
	syncAudioElement.autoplay = true;
	syncAudioElement.muted = false;
	document.getElementById('player').appendChild(syncAudioElement);
}

function playSyncAudio(event){
	const videoElement = event.target;
	turnVolumeForVideoToInaudible(videoElement);
			
	const audioElement = window.document.getElementById(syncAudioElementName);
	if(audioElement != undefined)
	{
		audioElement.play();
		audioElement.muted = false;			
	}
}

function pauseSyncAudio(){
	const audioElement = window.document.getElementById(syncAudioElementName);
	audioElement.pause();
};

function makeSetAudioURL(videoElement, url) {
    function setAudioURL() {
		turnVolumeForVideoToInaudible(videoElement); //is this needed?
		
		chrome.storage.local.get('delayValue', (values) => {
			globalDelayValue = values.delayValue;
		});

        if (url === '' || videoElement.src === url) {
            return;
        }

		createSyncAudioElement(url);
		
		videoElement.addEventListener('volumechange', adjustVolumeForSync);		
		videoElement.addEventListener('play', playSyncAudio);		
		videoElement.addEventListener('pause', pauseSyncAudio);	
    }

    return setAudioURL;
}

var mainLoopId = setInterval(
	function(){
		adjustLag();
	},
700);

window.addEventListener('DOMContentLoaded', (event) => {
	const videoElement = window.document.getElementsByTagName('video')[0];
		
    if(videoElement != undefined)
	{
		chrome.runtime.sendMessage({message: "getCurrentBeforeToggle"}, function(response) {
			if(response != "notFound" && response.time > 0 && response.url === window.location.href)
				{
					videoElement.currentTime = response.time;	

					//it's now safe to clear this tab's storage.
					chrome.runtime.sendMessage({message: "clearTabStorage"});
				}
			});
	}
});

//On browser back button press, stop the sync sound.
window.addEventListener("popstate", () => {
	const audioElement = window.document.getElementById(syncAudioElementName);
	if(audioElement != undefined)
	{
		audioElement.parentNode.removeChild(audioElement);
	}
});

				
function adjustLag(){
	const videoElement = window.document.getElementsByTagName('video')[0];
	
	if(videoElement != undefined )
	{
		const audioElement = window.document.getElementById(syncAudioElementName);
		
		//remove audio sync element when video is gone
		if(videoElement.src === "" && audioElement != undefined)
		{
			audioElement.parentNode.removeChild(audioElement);
		}		

		if(audioElement != undefined && videoElement.currentTime != 0)
		{	
			const delay = videoElement.currentTime + (globalDelayValue/1000) - audioElement.currentTime;				
						
			if(delay > 0.015 || delay < -0.015)
			{
				audioElement.currentTime += delay +0.07;	
				audioElement.muted = false;
			}
		}		
	}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.url != undefined)
	{
		const url = request.url;		
		const videoElements = window.document.getElementsByTagName('video');
		const videoElement = videoElements[0];
		if (typeof videoElement == 'undefined') {
			return;
		}
		
		videoElement.onloadeddata = makeSetAudioURL(videoElement, url);			
	}
	
	if(request.message === "delayChanged")
	{
		globalDelayValue = request.delayValue;
	}
	
	if(request.message === "getCurrentTime")
	{
		var currentTime = 0;
		const videoElements = window.document.getElementsByTagName('video');
		const videoElement = videoElements[0];
		if (typeof videoElement != undefined) {
			currentTime = videoElement.currentTime.toString().split(".")[0];
		}
			
		sendResponse({ "currentTime": currentTime});
	}
});

