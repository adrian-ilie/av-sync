const delaySelectorElement = document.getElementById('delaySelector');
const delayNumberElement = document.getElementById("delayNumber");

delaySelectorElement.addEventListener('change', processDelayChange);

function restoreOptions() {
    chrome.storage.local.get({
		delayValue: 0
    }, function (items) {
		delaySelectorElement.value = items.delayValue;
		delayNumberElement.innerHTML = items.delayValue;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);

function processDelayChange()
{
	document.getElementById("delayNumber").innerHTML = delaySelectorElement.value;
	chrome.runtime.sendMessage({"message" : "processDelayChange", "delayValue": delaySelectorElement.value});	
}

