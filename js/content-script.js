class Synchronizer
{	
	constructor(delayValue, acceptablePrecisionInMs){
		this.delayValue = delayValue;
		this.acceptablePrecisionInMs = acceptablePrecisionInMs;
		this.getVideoElement = () => { return window.document.getElementsByTagName('video')[0] };
		this.getAudioElement = () => { return window.document.getElementById('syncAudio') };
		this.getPrecisionElement = () => { return window.document.getElementById("precision") };
		this.isValidChromeRuntime = isValidChromeRuntime();

		if(navigator.userAgent.indexOf("Chrome") != -1)
		{
			this.adjustment = 0.077;
		}
		else
		{
			this.adjustment = 0.09;
		}
		
		this.isMainLoopRunning = false;
		this.mainLoopId = 0;
	}
	
	startMainAdjustLagLoop()
	{
		this.startAdjustLagLoop(100);
		this.isMainLoopRunning = true;
	}
	
	startSecondaryAdjustLagLoop() //less frequent than main loop, currently only used for Chrome
	{
		this.startAdjustLagLoop(1000);
	}

	startAdjustLagLoop(interval)
	{
		this.clearMainAdjustLagLoop(this.mainLoopId);
		this.mainLoopId = setInterval( 
			function(){ 
				synchronizer.adjustLag(); 
			}, interval);
	}
	
	clearSyncLoop()
	{
		clearInterval(this.mainLoopId);
	}

	clearMainAdjustLagLoop(mainLoopId)
	{
		clearInterval(mainLoopId);
		this.isMainLoopRunning = false;
	}

	adjustLag(){
		const videoElement = this.getVideoElement();
		const audioElement = this.getAudioElement();
		const precisionElement = this.getPrecisionElement();
		const unreliableSystemAcceptableDeviation = 5;
		const playbackRate = videoElement.playbackRate;		
					
		//Disable sync when switching to a live video.
		var youTubeliveButton = getYouTubeLiveButtonElement();
		if(youTubeliveButton !==  undefined)
		{
			pauseSyncAudio();
			this.clearSyncLoop();
			turnVolumeForVideoToAudible(videoElement);
			removeDelayControls();
			return;
		}
		
		if(videoElement != undefined)
		{
			//remove audio sync element when video is gone
			if(videoElement.src === "" && audioElement != undefined)
			{
				audioElement.parentNode.removeChild(audioElement);
			}	
		
			if(audioElement != undefined && videoElement.currentTime != 0 &&
			   audioElement.buffered.length > 0)
			{
				if(playbackRate != undefined && playbackRate != null)
				{
					audioElement.playbackRate = playbackRate;
				}
				var delayInSeconds = (this.delayValue/1000);
				var videocurrentime = videoElement.currentTime;
				var audioCurrentTime=  audioElement.currentTime;
				var delay = videocurrentime + delayInSeconds - audioCurrentTime;
				
				//for debugginhg:
				//console.log(delay);
				var currentAcceptablePrecision = this.acceptablePrecisionInMs;
				if(playbackRate >= 1)
				{
					currentAcceptablePrecision *= playbackRate;
				}
				if((isReliableSystem() && Math.abs(delay) > currentAcceptablePrecision) || 
				   (!isReliableSystem() && this.isMainLoopRunning && Math.abs(delay) > currentAcceptablePrecision) ||
				   (!isReliableSystem() && Math.abs(delay) >= unreliableSystemAcceptableDeviation))
				   //outside of the acceptable precision, keep trying
				   //In chrome on Windows, we can adjust the sync as it goes, usually once in sync it will stay in sync, 
				   //For other systems only retry if the delay is more than 5 seconds (this will cover also the skipping in youtube by pressing left/righ arrows.)			
				{										
					audioElement.muted = true;
					var currentAdjustment = this.adjustment;
					
					//if the previous difference was of a similar value, give it a kick so that it does'n get stuck					
					if(Math.abs(delay) < currentAcceptablePrecision * 6.25)
					{
						currentAdjustment += delay * (Math.random() * 1.25 );
					}
					
					if(playbackRate != undefined && playbackRate != null)
					{
						currentAdjustment *= playbackRate;
					}

					audioElement.currentTime += delay + currentAdjustment;
					
					if(this.isValidChromeRuntime)
					{
						chrome.runtime.sendMessage({message: "setWaitingBadge"});
					}
													
					//the first time an unnacceptable deviation is detected from the secondary loop, start the main loop 
					if(!this.isMainLoopRunning)
					{
						this.startMainAdjustLagLoop();
					}
				}			
				else
				{										
					//console.log("found delay: " + delay);
					audioElement.muted = false;
					
					this.startSecondaryAdjustLagLoop();

					if(!videoElement.paused) { audioElement.play(); }
					
					if(this.isValidChromeRuntime)
					{
						chrome.runtime.sendMessage({message: "removeWaitingBadge"});
					}
				}
			}		
		}
	}
}

let synchronizer;

const muteVolumeAdjustment = 100000;
const syncAudioElementName = 'syncAudio';
var globalMaxSelectableDelayValue = 0;

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

function turnVolumeForVideoToAudible(videoElement){
	if(!isVolumeForVideoAudible(videoElement))
	{
		videoElement.volume *= muteVolumeAdjustment;
	}
}

function adjustVolumeForSync(event)
{
	const videoElement = event.target;
	adjustVolumeForSyncByVideoElement(videoElement);
}

function adjustVolumeForSyncByVideoElement(videoElement)
{
	var youTubeliveButton = getYouTubeLiveButtonElement();
	if(youTubeliveButton !==  undefined)
	{
		return;
	}
	
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
	syncAudioElement.autoplay = false;
	syncAudioElement.muted = false;
	syncAudioElement.preload = "auto";
	
	const videoElement = window.document.getElementsByTagName('video')[0];
	if(!videoElement.paused) { syncAudioElement.play(); }

	document.getElementById('player').appendChild(syncAudioElement);
}

function changeRateAudio(event){
	const videoElement = event.target;
	const audioElement = window.document.getElementById(syncAudioElementName);
	
	if(audioElement != undefined)
	{
		audioElement.playbackRate = videoElement.playbackRate;
	}
}

function playSyncAudio(event){	
	const videoElement = event.target;

	var youTubeliveButton = getYouTubeLiveButtonElement();
	if(youTubeliveButton !==  undefined)
	{
		turnVolumeForVideoToAudible(videoElement);
	}
	else
	{
		turnVolumeForVideoToInaudible(videoElement);
				
		const audioElement = window.document.getElementById(syncAudioElementName);
		if(audioElement != undefined)
		{
			if(synchronizer != undefined)
			{
				synchronizer.startMainAdjustLagLoop();
			}

			audioElement.play();
		}
	}
}

function pauseSyncAudio(){
	const audioElement = window.document.getElementById(syncAudioElementName);
	audioElement.pause();
	
	if(isValidChromeRuntime())
	{
		chrome.runtime.sendMessage({message: "removeWaitingBadge"});
	}	
	if(synchronizer != undefined)
	{
		synchronizer.clearSyncLoop();
	}
};

function makeSetAudioURL(videoElement, url) {
    function setAudioURL() {		
		if (url === '' || videoElement.src === url) {
            return;
        }
		
		
		if(synchronizer != undefined)
		{
			synchronizer.clearSyncLoop();
		}
		
		turnVolumeForVideoToInaudible(videoElement); //is this needed?
		
		chrome.storage.local.get({delayValue: 0,
								  maxSelectableDelayValue: 5000,
								  delayControlsInPlayerValue: true,
								  maxAcceptableDelayValue: 25}, (values) => {
			
			globalMaxSelectableDelayValue = values.maxSelectableDelayValue;
			
			if(values.delayControlsInPlayerValue)
			{
				if(synchronizer == undefined)
				{
					synchronizer = new Synchronizer(values.delayValue, values.maxAcceptableDelayValue/1000);
					synchronizer.startMainAdjustLagLoop();
				}
				addDelayControls();
				processPlayerDelayChange(values.delayValue);
			}
			
		});



		createSyncAudioElement(url);
		
		videoElement.addEventListener('volumechange', adjustVolumeForSync);		
		videoElement.addEventListener('play', playSyncAudio);		
		videoElement.addEventListener('pause', pauseSyncAudio);	
		videoElement.addEventListener('ratechange', changeRateAudio);	
		adjustVolumeForSyncByVideoElement(videoElement);
	}

    return setAudioURL;
}

function addDelayControls()
{
	var youTubeliveButton = getYouTubeLiveButtonElement();
	if(youTubeliveButton !==  undefined)
	{
		return;
	}
	
	const delayInPlayerElement = window.document.getElementById("delayInPlayer");
	if(delayInPlayerElement === null)
	{
		const ytpTimeDurationElement = document.getElementsByClassName('ytp-time-duration')[0];
		
		ytpTimeDurationElement.insertAdjacentHTML('afterend', '<span id = "delayControls"> \
				<span class="ytp-time-separator">&nbsp;&nbsp;&nbsp;</span> \
				<button id = "decreaseDelayButton" style="width: 24px; border-radius: 50%; outline: none; box-shadow: none;">-</button> \
				<input type="number" id="delayInPlayer" title = "Delay in milliseconds" style="color: white; background: transparent; border: none; text-align: right;" \
					min="-' + parseInt(globalMaxSelectableDelayValue) + '" max="' + parseInt(globalMaxSelectableDelayValue) + '"> \
				<span>ms</span> \
				<button id = "increaseDelayButton" style="width: 24px; border-radius: 50%; outline: none; box-shadow: none;">+</button> \
				<span id = "precision"></span> \
				</span>');

		document.getElementById("delayInPlayer").addEventListener('keydown', processDelayInPlayerKeyDown, true);
		document.getElementById("delayInPlayer").addEventListener('input', processDelayInPlayer);
		
		document.getElementById("increaseDelayButton").addEventListener('click', processDelayAdjustButtonClick, true);
		document.getElementById("decreaseDelayButton").addEventListener('click', processDelayAdjustButtonClick, true);
	}
}

function removeDelayControls()
{
	if(document.getElementById("delayControls") != null)
	{
		document.getElementById("delayControls").remove();
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
	delayInPlayerElement.style.width = ((delayInPlayerElement.value.length) * 8) + 'px';

	if (delayInPlayerElement.checkValidity() && synchronizer != undefined)
	{
		if(adjustedValue != undefined)
		{
			synchronizer.delayValue = adjustedValue;
		}
		synchronizer.startMainAdjustLagLoop();
	}
	else
	{
		delayInPlayerElement.reportValidity();
	}
}

window.addEventListener('DOMContentLoaded', (event) => {	
	//needed for a smooth transition to the next video in a playlist.
	if(synchronizer !== undefined)
	{
		synchronizer.clearSyncLoop();
	}
	
	const videoElement = window.document.getElementsByTagName('video')[0];
		
    if(videoElement != undefined && isValidChromeRuntime())
	{		
		var youTubeliveButton = getYouTubeLiveButtonElement();
		if(youTubeliveButton !==  undefined)
		{
			removeDelayControls();
		}
		
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

function isReliableSystem()
{
	return (navigator.appVersion.indexOf("Win") != -1 && navigator.userAgent.indexOf("Chrome") != -1);
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

function getYouTubeLiveButtonElement()
{
	return document.getElementsByClassName("ytp-live")[0];
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	const videoElements = window.document.getElementsByTagName('video');
	const videoElement = videoElements[0];		
		
	var youTubeliveButton = getYouTubeLiveButtonElement();
	if(youTubeliveButton !==  undefined)
	{
		turnVolumeForVideoToAudible(videoElement);
	}
	else if(request.url != undefined)
	{
		const url = request.url;		
		
		if (typeof videoElement == 'undefined') {
			return;
		}
		
		videoElement.onloadeddata = makeSetAudioURL(videoElement, url);			
	}
	
	if(request.message === "delayChanged")
	{
		synchronizer.delayValue = request.delayValue;
		if(document.getElementById("delayControls") != null)
		{
			processPlayerDelayChange(request.delayValue);
		}
	}
	
	if(request.message === "maxSelectableDelayChanged")
	{
		globalMaxSelectableDelayValue = request.maxSelectableDelayValue;
	    if(document.getElementById("delayControls") != null)
		{
			window.document.getElementById("delayInPlayer").setAttribute("min", -globalMaxSelectableDelayValue);
			window.document.getElementById("delayInPlayer").setAttribute("max", globalMaxSelectableDelayValue);		
		}
	}
	
	if(request.message === "maxAcceptableDelayChanged")
	{
		var maxAcceptableDelayValue = request.maxAcceptableDelayValue;
	    if(document.getElementById("delayControls") != null)
		{
			synchronizer.acceptablePrecisionInMs = 	maxAcceptableDelayValue/1000;
		}
	}
	
	if(request.message === "delayControlsInPlayerChanged")
	{
		var showDelayControls = request.delayControlsInPlayerValue;
		if(showDelayControls)
		{
			addDelayControls();
			processPlayerDelayChange(synchronizer.delayValue);
		}
		else
		{
			removeDelayControls();
		}
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

