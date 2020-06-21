const muteVolumeAdjustment = 100000;
const syncAudioElementName = 'syncAudio';
var globalDelayValue = 0;
var globalMaxSelectableDelayValue = 0;
var previousDelay = 0;
var mainLoopId;
var isMainLoopRunning = false;

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
	adjustVolumeForSyncByVideoElement(videoElement);
}

function adjustVolumeForSyncByVideoElement(videoElement)
{
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
		startMainAdjustLagLoop(0.008);		
		audioElement.play();
	}
}

function pauseSyncAudio(){
	const audioElement = window.document.getElementById(syncAudioElementName);
	audioElement.pause();
	
	if(isValidChromeRuntime())
	{
		chrome.runtime.sendMessage({message: "removeWaitingBadge"});
	}
	clearMainAdjustLagLoop();
};

function makeSetAudioURL(videoElement, url) {
    function setAudioURL() {
		turnVolumeForVideoToInaudible(videoElement); //is this needed?
		
		chrome.storage.local.get({delayValue: 0,
								  maxSelectableDelayValue: 5000}, (values) => {
			globalDelayValue = values.delayValue;
			globalMaxSelectableDelayValue = values.maxSelectableDelayValue;
			addDelayControls();
		});

        if (url === '' || videoElement.src === url) {
            return;
        }

		createSyncAudioElement(url);
		
		videoElement.addEventListener('volumechange', adjustVolumeForSync);		
		videoElement.addEventListener('play', playSyncAudio);		
		videoElement.addEventListener('pause', pauseSyncAudio);	
		adjustVolumeForSyncByVideoElement(videoElement);
		
		startMainAdjustLagLoop(0.008);		
    }

    return setAudioURL;
}

function addDelayControls()
{
	const delayInPlayerElement = window.document.getElementById("delayInPlayer");
	if(delayInPlayerElement === null)
	{
		const ytpTimeDurationElement = document.getElementsByClassName('ytp-time-duration')[0];
		ytpTimeDurationElement.insertAdjacentHTML('afterend', '<span class="ytp-time-separator">&nbsp;&nbsp;&nbsp;</span> \
			<button id = "decreaseDelayButton" style="width: 24px; border-radius: 50%; outline: none; box-shadow: none;">-</button> \
			<input type="number" id="delayInPlayer" value = ' + globalDelayValue + ' style="width: 38px; text-align: right;" \
				min="-' + globalMaxSelectableDelayValue + '" max="' + globalMaxSelectableDelayValue + '"> \
			<button id = "increaseDelayButton" style="width: 24px; border-radius: 50%; outline: none; box-shadow: none;">+</button>');

		document.getElementById("delayInPlayer").addEventListener('keydown', processDelayInPlayerKeyDown, true);
		document.getElementById("delayInPlayer").addEventListener('input', processDelayInPlayer);
		
		document.getElementById("increaseDelayButton").addEventListener('click', processDelayAdjustButtonClick, true);
		document.getElementById("decreaseDelayButton").addEventListener('click', processDelayAdjustButtonClick, true);
	}
}

function processDelayAdjustButtonClick(event)
{
	var adjustment = 0;
	if(this.id === "increaseDelayButton")
	{
		adjustment = 1;
	}		
	else if(this.id === "decreaseDelayButton")
	{
		adjustment = -1;
	}
	
	const delayInPlayerElement = window.document.getElementById("delayInPlayer");
	var adjustedValue = parseInt(delayInPlayerElement.value) + adjustment;

	processPlayerDelayChange(adjustedValue);
}

function processDelayInPlayerKeyDown(event)
{
	//needed in order to override youtube player keydown events.
	event.stopPropagation();
}

function processDelayInPlayer(event)
{
	processPlayerDelayChange(this.value);
}

function processPlayerDelayChange(adjustedValue)
{
	if(adjustedValue === "")
	{
		adjustedValue = 0;
	}
	
	const delayInPlayerElement = window.document.getElementById("delayInPlayer");
	delayInPlayerElement.value = adjustedValue;

	if (delayInPlayerElement.checkValidity())
	{
		globalDelayValue = adjustedValue;
	}
	else
	{
		delayInPlayerElement.reportValidity();
	}
}

window.addEventListener('DOMContentLoaded', (event) => {
	const videoElement = window.document.getElementsByTagName('video')[0];
		
    if(videoElement != undefined && isValidChromeRuntime())
	{
		chrome.runtime.sendMessage({message: "getCurrentTimeBeforeToggle"}, function(response) {
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

function startMainAdjustLagLoop(acceptableDeviation) //less frequent than main loop
{	
	startAdjustLagLoop(acceptableDeviation, 100);
	isMainLoopRunning = true;
}

function startSecondaryAdjustLagLoop(acceptableDeviation) //less frequent than main loop
{
	startAdjustLagLoop(acceptableDeviation, 1000);
}

function startAdjustLagLoop(acceptableDeviation, interval)
{
	clearMainAdjustLagLoop();
	mainLoopId = setInterval( function(){ adjustLag(acceptableDeviation); }, interval);
}

function clearMainAdjustLagLoop()
{
	clearInterval(mainLoopId);
	isMainLoopRunning = false;
}

function adjustLag(acceptableDeviation){
	const videoElement = window.document.getElementsByTagName('video')[0];
	const audioElement = window.document.getElementById(syncAudioElementName);

	if(videoElement != undefined )
	{		
		//remove audio sync element when video is gone
		if(videoElement.src === "" && audioElement != undefined)
		{
			audioElement.parentNode.removeChild(audioElement);
		}		

		if(audioElement != undefined && videoElement.currentTime != 0)
		{
			var delay = videoElement.currentTime + (globalDelayValue/1000) - audioElement.currentTime;
			var differenceFromPrevious = delay - previousDelay;
			if(Math.abs(delay) > acceptableDeviation) //outside of the acceptable precision, keep trying
			{
				//console.log("delay: "+delay);
								
				var adjustment //todo: identify dynamic way to retrieve this adjustment depending on the browser
				//Chrome only
				= 0.077; 
				//End Chrome only
				
				//Firefox only
				//= 0.09; 
				//End Firefox only				
				
				audioElement.muted = true;
				
				//if the previous difference was of a similar value, give it a kick so that it does'n get stuck
				if(Math.abs(differenceFromPrevious) < 0.05)
				{
					adjustment += differenceFromPrevious * 1.5;
				}

				audioElement.currentTime += delay + adjustment;
				
				if(isValidChromeRuntime())
				{
					chrome.runtime.sendMessage({message: "setWaitingBadge"});
				}
												
				//the first time an unnacceptable deviation is detected from the secondary loop, start the main loop 
				if(!isMainLoopRunning)
				{
					startMainAdjustLagLoop(acceptableDeviation);
				}
			}			
			else
			{
				//console.log("found delay: " + delay);
				audioElement.muted = false;
				
				//Chrome only
				//In chrome we can adjust the sync as it goes, usually once in sync it will stay in sync.
				startSecondaryAdjustLagLoop(acceptableDeviation);
				//End chrome only

				//Firefox only:
				//In Firefox we do not want to stop and resync because it goes too easily out of sync.
				//Todo: Implement option to be able to chose how often it should resync
				//clearInterval(mainLoopId);
				//End Firefox only:

				if(!videoElement.paused) { audioElement.play(); }
				
				if(isValidChromeRuntime())
				{
					chrome.runtime.sendMessage({message: "removeWaitingBadge"});
				}
			}
		}		
	}
}

//When updating the chrome extension, the existing content scripts will be disconnected. This check helps with avoiding error "Extension context invalidated"
function isValidChromeRuntime() {
	try
	{
		return chrome.runtime && !!chrome.runtime.getManifest();
	}
	catch(error)
	{
		//todo inform the user and ask to give consent for reloading the page. When consented, call: location.reload();
		return false;
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
		window.document.getElementById("delayInPlayer").value = request.delayValue;		
	}
	
	if(request.message === "maxSelectableDelayChanged")
	{
		globalMaxSelectableDelayValue = request.maxSelectableDelayValue;
		window.document.getElementById("delayInPlayer").setAttribute("min", -globalMaxSelectableDelayValue);
		window.document.getElementById("delayInPlayer").setAttribute("max", globalMaxSelectableDelayValue);		
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

