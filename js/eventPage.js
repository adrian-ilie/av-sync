chrome.runtime.onInstalled.addListener(function (details) {
	if(details.reason === "install")
	{
		chrome.storage.local.set({ is_extension_disabled: false });
		chrome.storage.local.set({ "delayValue": 1220 });		
	}
});