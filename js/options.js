const delayInput = document.getElementById('delayInput');
const delaySelectorElement = document.getElementById('delaySelector');
const delayNumberElement = document.getElementById("delayNumber");
const maxSelectableDelayElement = document.getElementById('maxSelectableDelay');
const maxAcceptableDelayElement = document.getElementById('maxAcceptableDelay');
const delayControlsInPlayerElement = document.getElementById('delayControlsInPlayerCheckbox');

delayInput.addEventListener("input", processDelayInputChange);
delaySelectorElement.addEventListener('change', processDelayChange);
maxSelectableDelayElement.addEventListener("input", processMaxSelectableDelay);
maxAcceptableDelayElement.addEventListener("input", processMaxAcceptableDelay);
delayControlsInPlayerElement.addEventListener('change', processDelayControlsInPlayerChange);

function restoreOptions() {
	document.getElementById("delaySelector").focus();

    chrome.storage.local.get({
		delayValue: 0,
		maxSelectableDelayValue: 5000,
		maxAcceptableDelayValue: 25,
		delayControlsInPlayerValue: true
    }, function (items) {
		updateDelayElements(items.delayValue);
		updateMaxSelectableDelayElement(items.maxSelectableDelayValue);
		updateMaxAcceptableDelayElement(items.maxAcceptableDelayValue);
		updateDelayControlsInPlayer(items.delayControlsInPlayerValue);
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
		chrome.runtime.sendMessage({"message" : "processDelayChange", "delayValue": delayInput.value});
	}
	else
	{
		delayInput.reportValidity();
	}
}

function processDelayChange()
{
	delayInput.value = delaySelectorElement.value;
	updateDelaySeletorTooltip(delaySelectorElement.value);
	chrome.runtime.sendMessage({"message" : "processDelayChange", "delayValue": delaySelectorElement.value});
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
		
		chrome.runtime.sendMessage({"message" : "processDelayChange", "delayValue": delaySelectorElement.value});
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

function processDelayControlsInPlayerChange()
{
	chrome.runtime.sendMessage({"message" : "delayControlsInPlayerChange", "delayControlsInPlayerValue": this.checked});
}

function updateDelayElements(delayValue)
{
	delayInput.value = delayValue;
	delaySelectorElement.value = delayValue;
	updateDelaySeletorTooltip(delayValue);
}

function updateDelaySeletorTooltip(delayValue)
{
	var delayValueInSeconds = (delayValue / 1000);
	delayNumberElement.textContent = delayValueInSeconds +' s';
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

function updateDelayControlsInPlayer(showDelayControlsInPlayer)
{
	delayControlsInPlayerElement.checked = showDelayControlsInPlayer;
}
