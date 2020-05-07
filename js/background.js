class Background {
    constructor() {
        this.tabIds = new Map();
        this.removeURLParameters = (url, parameters) => {
            const urlParts = url.split('?');
            if (urlParts.length < 2)
                return;
            let currentParameters = urlParts[1].split(/[&;]/g);
            const encodedParameters = parameters.map((para) => `${encodeURIComponent(para)}=`);
            const filteredParameters = currentParameters.filter((p) => !encodedParameters.some((enc) => p.startsWith(enc)));
            return `${urlParts[0]}?${filteredParameters.join('&')}`;
        };
		
        this.processRequest = (details) => {
            const { url, tabId } = details;
            if (!url.includes('mime=audio'))
                return;
            if (url.includes('live=1')) {
                this.tabIds.set(tabId, '');
                this.sendMessage(tabId);
                return;
            }
			
            const parametersToBeRemoved = ['range', 'rn', 'rbuf'];
            const audioURL = this.removeURLParameters(url, parametersToBeRemoved);
            if (audioURL && this.tabIds.get(tabId) !== audioURL) {
                this.tabIds.set(tabId, audioURL);
                this.sendMessage(tabId);
            }
        };
		
        this.sendMessage = (tabId) => {
            if (this.tabIds.has(tabId)) {
                chrome.tabs.sendMessage(tabId, {
                    url: this.tabIds.get(tabId),
                });
            }
        };			
					
        this.enableExtension = () => {
            chrome.browserAction.setIcon({
                path: {
                    19: 'img/icon19.png',
                    38: 'img/icon38.png',
                },
            });
			
			chrome.browserAction.setTitle({title: "YouTube AV Sync - Enabled"});
			
            chrome.tabs.onUpdated.addListener(this.sendMessage);
            chrome.webRequest.onBeforeRequest.addListener(this.processRequest, { urls: ['<all_urls>'] });
        };
		
        this.disableExtension = () => {
            chrome.browserAction.setIcon({
                path: {
                    19: 'img/disabled_icon19.png',
                    38: 'img/disabled_icon38.png',
                },
            });
			
			chrome.browserAction.setTitle({title: "YouTube AV Sync - Disabled"});
			
            chrome.tabs.onUpdated.removeListener(this.sendMessage);
            chrome.webRequest.onBeforeRequest.removeListener(this.processRequest);
            this.tabIds.clear();
		};	
		
        this.saveSettings = (disabled) => {
            chrome.storage.local.set({ is_extension_disabled: disabled });
        };
		
        this.tabIds = new Map();
        chrome.storage.local.get('is_extension_disabled', (values) => {
            let disabled = values.is_extension_disabled;
            if (typeof disabled === 'undefined') {
                disabled = false;
                this.saveSettings(disabled);
            }
            if (disabled) {
                this.disableExtension();
            }
            else {
                this.enableExtension();
            }
        });
		
        chrome.browserAction.onClicked.addListener(() => {
            chrome.storage.local.get('is_extension_disabled', (values) => {
                let disabled = values.is_extension_disabled;
                if (disabled) {
                    this.enableExtension();
                }
                else {
                    this.disableExtension();
                }
                disabled = !disabled;
                this.saveSettings(disabled);
            });
            chrome.tabs.query({
                active: true,
                currentWindow: true,
                url: '*://*.youtube.com/*',
            }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.update(tabs[0].id, { url: tabs[0].url });
                }
            });
        });
		
		this.processMessage = (request, sender, sendResponse) => 
		{	
			if(request.message === "processDelayChange")
			{
				const delayValue = request.delayValue;				
				chrome.storage.local.set({ "delayValue": delayValue });				
				chrome.tabs.query({}, function(tabs) {
					var message = {"message": "delayChanged", "delayValue": delayValue};
					for (var i=0; i<tabs.length; ++i) {
						chrome.tabs.sendMessage(tabs[i].id, message);
					}
				});
			}
		};
		
		chrome.runtime.onMessage.addListener(this.processMessage);		
    }
}
const background = new Background();
