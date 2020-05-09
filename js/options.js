const delaySelectorElement = document.getElementById('delaySelector');
const delayNumberElement = document.getElementById("delayNumber");

delaySelectorElement.addEventListener('change', processDelayChange);

function restoreOptions() {
	document.getElementById("delaySelector").focus();

    chrome.storage.local.get({
		delayValue: 0
    }, function (items) {
		delaySelectorElement.value = items.delayValue;
		delayNumberElement.textContent = items.delayValue +' ms';
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);

function processDelayChange()
{
	document.getElementById("delayNumber").textContent = delaySelectorElement.value + ' ms';
	chrome.runtime.sendMessage({"message" : "processDelayChange", "delayValue": delaySelectorElement.value});
}

