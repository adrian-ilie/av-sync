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
	if(isVolumeForVideoAudible(videoElement)) //If not inaudible already
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
		turnVolumeForVideoToInaudible(videoElement); //is this needed
		
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
				
function adjustLag(){	
	const audioElement = window.document.getElementById(syncAudioElementName);
	const videoElement = window.document.getElementsByTagName('video')[0];
	
	if(videoElement != undefined && audioElement != undefined && videoElement.currentTime != 0)
	{
		chrome.runtime.sendMessage({"message" : "unmuteTab"});

		const delay = videoElement.currentTime + (globalDelayValue/1000) - audioElement.currentTime;				
					
		if(delay > 0.015 || delay < -0.015)
		{
			audioElement.currentTime += delay +0.07;	
			audioElement.muted = false;
		}
	}
}

chrome.runtime.onMessage.addListener((request) => {
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
});

