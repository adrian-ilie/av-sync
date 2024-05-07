class Synchronizer {
  constructor(syncValue, acceptablePrecisionInMs) {
    this.syncValue = syncValue;
    this.acceptablePrecisionInMs = acceptablePrecisionInMs;
    this.getVideoElement = () => {
      return window.document.getElementsByTagName('video')[0]
    };
    this.getAudioElement = () => {
      return window.document.getElementById('syncAudio')
    };
    this.getPrecisionElement = () => {
      return window.document.getElementById("precision")
    };
    this.isValidChromeRuntime = isValidChromeRuntime();

    if (navigator.userAgent.indexOf("Chrome") != -1) {
      this.adjustment = 0.077;
    } else {
      this.adjustment = 0.09;
    }

    this.isMainLoopRunning = false;
    this.mainLoopId = 0;
  }

  startMainAdjustLagLoop() {
    this.startAdjustLagLoop(100);
    this.isMainLoopRunning = true;
  }

  startSecondaryAdjustLagLoop() //less frequent than main loop, currently only used for Chrome
  {
    this.startAdjustLagLoop(1000);
  }

  startAdjustLagLoop(interval) {
    this.clearMainAdjustLagLoop(this.mainLoopId);
    this.mainLoopId = setInterval(
      function () {
        synchronizer.adjustLag();
      }, interval);
  }

  clearSyncLoop() {
    clearInterval(this.mainLoopId);
  }

  clearMainAdjustLagLoop(mainLoopId) {
    clearInterval(mainLoopId);
    this.isMainLoopRunning = false;
  }

  adjustLag() {
    const videoElement = this.getVideoElement();
    const audioElement = this.getAudioElement();
    const unreliableSystemAcceptableDeviation = 5;
    const playbackRate = videoElement.playbackRate;

    //Disable sync when switching to a live video.
    var youTubeliveButton = getYouTubeLiveButtonElement();
    if (youTubeliveButton !== undefined) {
      pauseSyncAudio();
      this.clearSyncLoop();
      turnVolumeForVideoToAudible(videoElement);
      showLiveVideoMessage();
      return;
    }

    if (videoElement != undefined) {
      //remove audio sync element when video is gone
      if (videoElement.src === "" && audioElement != undefined) {
        audioElement.parentNode.removeChild(audioElement);
      }

      if (audioElement != undefined && videoElement.currentTime != 0 &&
        audioElement.buffered.length > 0) {
        var delayInSeconds = (this.syncValue / 1000) * (-1);

        if (playbackRate != undefined && playbackRate != null) {
          audioElement.playbackRate = playbackRate;
          delayInSeconds *= playbackRate;
        }
        var videocurrentime = videoElement.currentTime;
        var audioCurrentTime = audioElement.currentTime;
        var delay = videocurrentime + delayInSeconds - audioCurrentTime;

        //for debugginhg:
        //console.log(delay);
        var currentAcceptablePrecision = this.acceptablePrecisionInMs;
        if (playbackRate >= 1) {
          currentAcceptablePrecision *= playbackRate;
        }
        if ((isReliableSystem() && Math.abs(delay) > currentAcceptablePrecision) ||
          (!isReliableSystem() && this.isMainLoopRunning && Math.abs(delay) > currentAcceptablePrecision) ||
          (!isReliableSystem() && Math.abs(delay) >= unreliableSystemAcceptableDeviation))
        //outside of the acceptable precision, keep trying
        //In chrome on Windows, we can adjust the sync as it goes, usually once in sync it will stay in sync,
        //For other systems only retry if the delay is more than 5 seconds (this will cover also the skipping in youtube by pressing left/righ arrows.)
        {
          audioElement.muted = true;
          var currentAdjustment = this.adjustment;

          //if the previous difference was of a similar value, give it a kick so that it does'n get stuck
          if (Math.abs(delay) < currentAcceptablePrecision * 6.25) {
            currentAdjustment += delay * (Math.random() * 1.25);
          }

          if (playbackRate != undefined && playbackRate != null) {
            currentAdjustment *= playbackRate;
          }

          audioElement.currentTime += delay + currentAdjustment;

          if (this.isValidChromeRuntime) {
            sendMessage({
              message: "setWaitingBadge"
            });
          }
          else
          {

              document.getElementById("yt-av-sync").removeEventListener('click', toggleAvSyncMenu, true);
              document.getElementById("yt-av-sync").addEventListener('click', toggleReloadPageMessage, true);
              document.getElementById("yt-av-sync-reload-page-close-button").addEventListener('click', toggleReloadPageMessage, true);

          }

          //the first time an unnacceptable deviation is detected from the secondary loop, start the main loop
          if (!this.isMainLoopRunning) {
            this.startMainAdjustLagLoop();
          }
        } else {
          //console.log("found delay: " + delay);
          audioElement.muted = false;

          this.startSecondaryAdjustLagLoop();

          if (!videoElement.paused) {
            audioElement.play();
          }

          if (this.isValidChromeRuntime) {
            sendMessage({
              message: "removeWaitingBadge"
            });
          }
          else
          {

              document.getElementById("yt-av-sync").removeEventListener('click', toggleAvSyncMenu, true);
              document.getElementById("yt-av-sync").addEventListener('click', toggleReloadPageMessage, true);
              document.getElementById("yt-av-sync-reload-page-close-button").addEventListener('click', toggleReloadPageMessage, true);

          }
        }
      }
    }
  }
}

var synchronizer;

const muteVolumeAdjustment = 100000;
const syncAudioElementName = 'syncAudio';
var globalMaxSelectableDelayValue = 0;

function getCssProperty(className, property) {
  let elem = document.getElementsByClassName(className)[0];
  return window.getComputedStyle(elem, null).getPropertyValue(property);
}

function isVolumeForVideoAudible(videoElement) {
  return videoElement.volume * muteVolumeAdjustment > 1;
}

function turnVolumeForVideoToInaudible(videoElement) {
  if (isVolumeForVideoAudible(videoElement)) {
    videoElement.volume /= muteVolumeAdjustment;
  }
}

function turnVolumeForVideoToAudible(videoElement) {
  if (!isVolumeForVideoAudible(videoElement)) {
    videoElement.volume *= muteVolumeAdjustment;
  }
}

function adjustVolumeForSync(event) {
  const videoElement = event.target;
  adjustVolumeForSyncByVideoElement(videoElement);
}

function adjustVolumeForSyncByVideoElement(videoElement) {
  let youTubeliveButton = getYouTubeLiveButtonElement();
  if (youTubeliveButton !== undefined) {
    return;
  }

  const audioElement = window.document.getElementById(syncAudioElementName);

  let leftVolumeBarValue = getCssProperty("ytp-volume-slider-handle", "left").match(/\d+/);

  if (isVolumeForVideoAudible(videoElement)) //not yet adjusted
  {
    videoElement.volume /= muteVolumeAdjustment;

    if (audioElement != null) {
      if (leftVolumeBarValue == 0) {
        audioElement.volume = 0;
      } else {
        audioElement.volume = videoElement.volume * muteVolumeAdjustment;
      }
    }
  } else {
    if (audioElement != null) {
      if (leftVolumeBarValue == 0) {
        audioElement.volume = 0;
      } else {
        audioElement.volume = videoElement.volume * muteVolumeAdjustment;
      }
    }
  }
}

function createSyncAudioElement(url) {
  if (document.contains(document.getElementById(syncAudioElementName))) {
    document.getElementById(syncAudioElementName).remove();
  }

  let syncAudioElement = document.createElement('audio');
  syncAudioElement.setAttribute("id", syncAudioElementName);
  syncAudioElement.src = url;
  syncAudioElement.autoplay = false;
  syncAudioElement.muted = false;
  syncAudioElement.preload = "auto";

  const videoElement = window.document.getElementsByTagName('video')[0];
  if (!videoElement.paused) {
    syncAudioElement.play();
  }

  document.body.append(syncAudioElement)
}

function changeRateAudio(event) {
  const videoElement = event.target;
  const audioElement = window.document.getElementById(syncAudioElementName);

  if (audioElement != undefined) {
    audioElement.playbackRate = videoElement.playbackRate;
  }
}

function playSyncAudio(event) {
  const videoElement = event.target;

  let youTubeliveButton = getYouTubeLiveButtonElement();
  if (youTubeliveButton !== undefined) {
    turnVolumeForVideoToAudible(videoElement);
  } else {
    turnVolumeForVideoToInaudible(videoElement);

    const audioElement = window.document.getElementById(syncAudioElementName);
    if (audioElement != undefined) {
      if (synchronizer != undefined) {
        synchronizer.startMainAdjustLagLoop();
      }

      audioElement.play();
    }
  }
}

function pauseSyncAudio() {
  const audioElement = window.document.getElementById(syncAudioElementName);
  audioElement.pause();

  if (isValidChromeRuntime()) {
    sendMessage({
      message: "removeWaitingBadge"
    });
  }
  else
  {

      document.getElementById("yt-av-sync").removeEventListener('click', toggleAvSyncMenu, true);
      document.getElementById("yt-av-sync").addEventListener('click', toggleReloadPageMessage, true);
      document.getElementById("yt-av-sync-reload-page-close-button").addEventListener('click', toggleReloadPageMessage, true);

  }
  if (synchronizer != undefined) {
    synchronizer.clearSyncLoop();
  }
}

function makeSetAudioURL(videoElement, url) {
  /*
  let audioElement = document.getElementById(syncAudioElementName);
  //This is needed to avoid hearing the audio from a previous video
  if(url !== '' && videoElement.src !== url && document.contains(audioElement) && audioElement.src !== url)
  {
    console.log("aaaaaaaaaaaaaa");
    createSyncAudioElement(url);
  }*/

  function setAudioURL() {
    if (url === '' || videoElement.src === url) {
      return;
    }

    addAvSyncControlls();

    if (synchronizer != undefined) {
      synchronizer.clearSyncLoop();
    }

    turnVolumeForVideoToInaudible(videoElement); //is this needed?

    if (isValidChromeRuntime()) {

      chrome.storage.local.get({
        syncValue: 0,
        maxSelectableDelayValue: 5000,
        is_extension_disabled: true,
        maxAcceptableDelayValue: 25
      }, (values) => {

        globalMaxSelectableDelayValue = values.maxSelectableDelayValue;

        addAvSyncButton();

        if (values.is_extension_disabled === false) {
          if (synchronizer == undefined) {
            synchronizer = new Synchronizer(values.syncValue, values.maxAcceptableDelayValue / 1000);
            synchronizer.startMainAdjustLagLoop();
          }

          //addDelayControls();
          processPlayerDelayChange(values.syncValue);
        }
    });
  }
  else {
    document.getElementById("yt-av-sync").removeEventListener('click', toggleAvSyncMenu, true);
    document.getElementById("yt-av-sync").addEventListener('click', toggleReloadPageMessage, true);
    document.getElementById("yt-av-sync-reload-page-close-button").addEventListener('click', toggleReloadPageMessage, true);
  }

    createSyncAudioElement(url);

    videoElement.addEventListener('volumechange', adjustVolumeForSync);
    videoElement.addEventListener('play', playSyncAudio);
    videoElement.addEventListener('pause', pauseSyncAudio);
    videoElement.addEventListener('ratechange', changeRateAudio);
    adjustVolumeForSyncByVideoElement(videoElement);
  }

  return setAudioURL;
}

function addAvSyncControlls() {
  if(isValidChromeRuntime())
  {
    chrome.storage.local.get({
      syncValue: 0,
      maxSelectableDelayValue: 5000,
      is_extension_disabled: false
    }, (values) => {
      globalMaxSelectableDelayValue = values.maxSelectableDelayValue;
      addAvSyncButton(values.syncValue, values.is_extension_disabled);
      adjustMenuForLiveVideos();
    });
    addMediaDeviceManagerIframe();
  }
  else {
    document.getElementById("yt-av-sync").removeEventListener('click', toggleAvSyncMenu, true);
    document.getElementById("yt-av-sync").addEventListener('click', toggleReloadPageMessage, true);
    document.getElementById("yt-av-sync-reload-page-close-button").addEventListener('click', toggleReloadPageMessage, true);
  }
}

function addMediaDeviceManagerIframe() {
  if(document.getElementById("mediaDeviceManagerIframe") === null)
  {
    let iframe = document.createElement("IFRAME");
    iframe.setAttribute("id", "mediaDeviceManagerIframe");
    iframe.setAttribute("name", "mediaDeviceManagerIframe");
    iframe.setAttribute("src", getURL("html/mediaDeviceManager.html"));
    iframe.setAttribute("allow", "microphone");
    iframe.hidden = true
    document.body.appendChild(iframe);
  }
}

function getAvSyncMenuHtml(isExtensionDisabled) {
  const saveButtonSvg = '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"' +
    '	 viewBox="0 0 469.336 469.336" xml:space="preserve">' +
    '	<g>' +
    '		<g>' +
    '			<g>' +
    '				<path d="M266.668,149.336h42.667c5.896,0,10.667-4.771,10.667-10.667V32.002c0-5.896-4.771-10.667-10.667-10.667h-42.667' +
    '					c-5.896,0-10.667,4.771-10.667,10.667v106.667C256.001,144.565,260.772,149.336,266.668,149.336z"/>' +
    '				<path d="M466.21,88.461L380.876,3.127c-3.042-3.052-7.646-3.969-11.625-2.313c-3.979,1.646-6.583,5.542-6.583,9.854v138.667' +
    '					c0,23.531-19.146,42.667-42.667,42.667h-192c-23.521,0-42.667-19.135-42.667-42.667V10.669c0-5.896-4.771-10.667-10.667-10.667' +
    '				h-32c-23.521,0-42.667,19.135-42.667,42.667v384c0,23.531,19.146,42.667,42.667,42.667h384c23.521,0,42.667-19.135,42.667-42.667' +
    '				V96.002C469.335,93.169,468.21,90.461,466.21,88.461z M405.335,437.336c0,5.896-4.771,10.667-10.667,10.667h-320' +
    '				c-5.896,0-10.667-4.771-10.667-10.667v-192c0-5.896,4.771-10.667,10.667-10.667h320c5.896,0,10.667,4.771,10.667,10.667V437.336z' +
    '				"/>' +
    '		</g>' +
    '		</g>' +
    '	</g>' +
    '</svg>';

  const menuContent =
    '<div class="ytp-menuitem" role="menuitemcheckbox" aria-checked="' + !(isExtensionDisabled) + '" tabindex="0">' +
    '<div class="ytp-menuitem-icon"></div>' +
    '<div class="ytp-menuitem-label">Audio/Video Sync</div>' +
    '<div class="ytp-menuitem-content">' +
    '<div class="ytp-menuitem-toggle-checkbox" id="toggleExtensionButton"></div>' +
    '</div>' +
    '</div>' +

    '<div class="ytp-menuitem" role="menuitemcheckbox" aria-checked="true" tabindex="0" id="liveVideoMessage" hidden>' +
    '<div class="ytp-menuitem-icon"></div>' +
    '<div class="ytp-menuitem-label">Not possible to adjust in Live videos!</div>' +
    '<div class="ytp-menuitem-content">' +
    '</div>' +
    '</div>' +

    '<div class="ytp-menuitem" role="menuitemcheckbox" aria-checked="true" tabindex="0" id="delayMenuItem">' +
    '<div class="ytp-menuitem-icon"></div>' +
    '<div class="ytp-menuitem-label">' +

    '<span id = "delayControls">' +
    '<button id = "decreaseDelayButton" style="width: 24px; border-radius: 50%; outline: none; box-shadow: none;">-</button> ' +
    '<input type="number" id="delayInPlayer" title = "Delay in milliseconds" style="color: white; background: transparent; border: none; text-align: right;" ' +
    '	min="-' + parseInt(globalMaxSelectableDelayValue) + '" max="' + parseInt(globalMaxSelectableDelayValue) + '"  ' + ' oninput="setCustomValidity(\'\'); checkValidity(); setCustomValidity(validity.valid ? \'\' :\'Restricted to +/-' + globalMaxSelectableDelayValue + '. If you need more, adjust Maximum Selectable Delay in the Options\');" > ' +
    '<span>ms</span> ' +
    '<button id = "increaseDelayButton" style="width: 24px; border-radius: 50%; outline: none; box-shadow: none;">+</button> ' +
    '<span id = "precision"></span> ' +
    '</span>' +

    '</div>' +

    '<div class="ytp-menuitem-content" id="delay-controls-menuitem">' +

    '<button id="saveDelay" title="Save as global delay" style="width: 20px; height: 20px; border: none; background-color: transparent; padding: 0; margin: 5px; cursor:pointer; fill: #eee">' +
    //save button
    saveButtonSvg +
    '</button>' +
    '</div>' +
    '</div>' +

    '<div class="ytp-menuitem" role="menuitemcheckbox" aria-checked="true" tabindex="0">' +
    '<div class="ytp-menuitem-icon"></div>' +
    '<div class="ytp-menuitem-label"><a target="_blank" href="' + getURL("html/options.html") + '">More Options</a></div>' +
    '<div class="ytp-menuitem-content">' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>'
    ;

    return getAvSyncPopupHtml(menuContent, "yt-av-sync-menu");
}

function getAvSyncPopupHtml(menuContent, menuId) {
  return '<div class="ytp-popup ytp-settings-menu" data-layer="100" id="'+ menuId +'" style="width: 251px; height: 200px; display: none;">' +
    '<div class="ytp-panel" style="min-width: 250px; width: 251px; height: 200px;">' +
    '<div class="ytp-panel-menu" role="menu" style="height: 200px;">' +

    '<div class="ytp-menuitem" role="menuitemcheckbox" aria-checked="true" tabindex="0">' +
    '<div class="ytp-menuitem-icon"></div>' +
    '<div class="ytp-menuitem-label"></div>' +
    '<div class="ytp-menuitem-content">' +
    '<button id="'+ menuId +'-close-button" style="width: 20px; height: 20px; border: none; background-color: transparent; padding: 0; cursor:pointer; color: white; ">x</button>' +
    '</div>' +
    '</div>' +
    menuContent +
    '</div>';
}

function getAvSyncReloadTabMessageHtml() {
  const reloadMessage = '<div class="ytp-menuitem style-scope ytd-player" tabindex="0"><div class="ytp-menuitem-icon style-scope ytd-player"></div><div class="ytp-menuitem-label style-scope ytd-player"><p>Youtube Audio/Video Sync Extension updated recently. You need to reload this page!</p></div><div class="ytp-menuitem-content style-scope ytd-player"></div></div>';
  return getAvSyncPopupHtml(reloadMessage, "yt-av-sync-reload-page");
}

function getAvSyncButtonHtml() {
  return '<button id="yt-av-sync" class="ytp-button" aria-haspopup="true" aria-owns="yt-av-sync" data-tooltip-target-id="yt-av-sync-button" aria-label="Audio/Video Sync" title="Audio/Video Sync">' +
  '<svg viewBox="0 0 26 26" version="1.1" id="svg2" sodipodi:docname="bx-slider-alt-white.svg" inkscape:version="1.3 (0e150ed6c4, 2023-07-21)" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" height="100%">' +
  '<defs id="defs2"></defs>' +
  '<sodipodi:namedview id="namedview2" pagecolor="#ffffff" bordercolor="#000000" borderopacity="0.25" inkscape:showpageshadow="2" inkscape:pageopacity="0.0" inkscape:pagecheckerboard="0" inkscape:deskcolor="#d1d1d1" inkscape:zoom="31.291667" inkscape:cx="11.984021" inkscape:cy="12" inkscape:window-width="1920" inkscape:window-height="986" inkscape:window-x="-11" inkscape:window-y="-11" inkscape:window-maximized="1" inkscape:current-layer="svg2"></sodipodi:namedview>' +
  '<path d="M7.5 14.5c-1.58 0-2.903 1.06-3.337 2.5H2v2h2.163c.434 1.44 1.757 2.5 3.337 2.5s2.903-1.06 3.337-2.5H22v-2H10.837c-.434-1.44-1.757-2.5-3.337-2.5zm0 5c-.827 0-1.5-.673-1.5-1.5s.673-1.5 1.5-1.5S9 17.173 9 18s-.673 1.5-1.5 1.5zm9-11c-1.58 0-2.903 1.06-3.337 2.5H2v2h11.163c.434 1.44 1.757 2.5 3.337 2.5s2.903-1.06 3.337-2.5H22v-2h-2.163c-.434-1.44-1.757-2.5-3.337-2.5zm0 5c-.827 0-1.5-.673-1.5-1.5s.673-1.5 1.5-1.5 1.5.673 1.5 1.5-.673 1.5-1.5 1.5z" id="path1" style="fill:#ffffff;fill-opacity:1"></path>' +
  '<path d="M12.837 5C12.403 3.56 11.08 2.5 9.5 2.5S6.597 3.56 6.163 5H2v2h4.163C6.597 8.44 7.92 9.5 9.5 9.5s2.903-1.06 3.337-2.5h9.288V5h-9.288zM9.5 7.5C8.673 7.5 8 6.827 8 6s.673-1.5 1.5-1.5S11 5.173 11 6s-.673 1.5-1.5 1.5z" id="path2" style="fill:#ffffff;fill-opacity:1"></path>' +
'</svg><button>';
}

function addAvSyncButton(syncValue, isExtensionDisabled) {

  const ytAvSyncElement = window.document.getElementById("yt-av-sync-menu");
  if (ytAvSyncElement === null) {
    const ytpSettingsMenuElement = document.getElementsByClassName('ytp-settings-menu')[0];
    ytpSettingsMenuElement.insertAdjacentHTML('afterend', getAvSyncMenuHtml(isExtensionDisabled));
    ytpSettingsMenuElement.insertAdjacentHTML('afterend', getAvSyncReloadTabMessageHtml());

    document.getElementById("delayInPlayer").addEventListener('keydown', processDelayInPlayerKeyDown, true);
    document.getElementById("delayInPlayer").addEventListener('input', processDelayInPlayer);
    document.getElementById("increaseDelayButton").addEventListener('click', processDelayAdjustButtonClick, true);
    document.getElementById("decreaseDelayButton").addEventListener('click', processDelayAdjustButtonClick, true);
    document.getElementById("yt-av-sync-menu-close-button").addEventListener('click', toggleAvSyncMenu, true);
    document.getElementById("yt-av-sync-reload-page-close-button").addEventListener('click', toggleReloadPageMessage, true);
    document.getElementById("toggleExtensionButton").addEventListener('click', toggleExtension, true);
    document.getElementById("saveDelay").addEventListener('click', saveDelayButtonClick, true);

    const ytpSettingsButtonElements = document.getElementsByClassName('ytp-settings-button');

    for(const settingsButton of ytpSettingsButtonElements)
    {
      if (settingsButton.closest("#ytd-player") !== null) //sometimes there are multiple buttons with this class, we are looking for the one inside the player
      {
        settingsButton.insertAdjacentHTML('afterend', getAvSyncButtonHtml());
      }
    }

    let extraEmptyButton = document.getElementById("yt-av-sync").nextElementSibling;

    if (extraEmptyButton.innerHTML === '') //Extra element needs to be removed since it is breaking the layout.
    {
      extraEmptyButton.remove();
    }

    document.getElementById("yt-av-sync").addEventListener('click', toggleAvSyncMenu, true);

    processPlayerDelayChange(syncValue);
  }
}

function adjustMenuForLiveVideos() {
  let youTubeliveButton = getYouTubeLiveButtonElement();
  if (youTubeliveButton !== undefined) {
    showLiveVideoMessage();
  } else {
    removeLiveVideoMessage();
  }
}

function saveDelayButtonClick(event) {
  let syncValue = document.getElementById("delayInPlayer").value;

  sendMessage({
    message: "processSyncChange",
    syncValue: syncValue
  });
  document.getElementById("saveDelay").style.fill = "#90ee90";
}

function toggleExtension() {
  sendMessage({
    message: "toggleExtension"
  });
}

function addDelayControls() {
  let youTubeliveButton = getYouTubeLiveButtonElement();
  if (youTubeliveButton !== undefined) {
    return;
  }

  const delayInPlayerElement = window.document.getElementById("delayInPlayer");
  if (delayInPlayerElement === null) {
    const ytpTimeDurationElement = document.getElementsByClassName('ytp-time-duration')[0];

    ytpTimeDurationElement.insertAdjacentHTML('afterend', '<span id = "delayControls">' +
      '<span class="ytp-time-separator">&nbsp;&nbsp;&nbsp;</span> ' +
      '<button id = "decreaseDelayButton" style="width: 24px; border-radius: 50%; outline: none; box-shadow: none;">-</button> ' +
      '<input type="number" id="delayInPlayer" title = "Delay in milliseconds" style="color: white; background: transparent; border: none; text-align: right;" ' +
      '	min="-' + parseInt(globalMaxSelectableDelayValue) + '" max="' + parseInt(globalMaxSelectableDelayValue) + '"> ' +
      '<span>ms</span> ' +
      '<button id = "increaseDelayButton" style="width: 24px; border-radius: 50%; outline: none; box-shadow: none;">+</button> ' +
      '<span id = "precision"></span> ' +
      '</span>');

    document.getElementById("delayInPlayer").addEventListener('keydown', processDelayInPlayerKeyDown, true);
    document.getElementById("delayInPlayer").addEventListener('input', processDelayInPlayer);

    document.getElementById("increaseDelayButton").addEventListener('click', processDelayAdjustButtonClick, true);
    document.getElementById("decreaseDelayButton").addEventListener('click', processDelayAdjustButtonClick, true);
  }
}

function toggleAvSyncMenu(event) {
    let ytAvSyncMenu = document.getElementById("yt-av-sync-menu");
    if (ytAvSyncMenu.style.display === "none") {
      ytAvSyncMenu.style.display = "block";
    } else {
      ytAvSyncMenu.style.display = "none";
    }
}

function toggleReloadPageMessage(event) {
  let ytAvReloadPageMessage = document.getElementById("yt-av-sync-reload-page");
  if (ytAvReloadPageMessage.style.display === "none") {
    ytAvReloadPageMessage.style.display = "block";
  } else {
    ytAvReloadPageMessage.style.display = "none";
  }
}

function removeLiveVideoMessage() {
  let delayMenuItem = document.getElementById("delayMenuItem");
  let liveVideoMessage = document.getElementById("liveVideoMessage");

  if (delayMenuItem != null) {
    delayMenuItem.hidden = false;
    liveVideoMessage.hidden = true;
  }
}

function showLiveVideoMessage() {
  let delayMenuItem = document.getElementById("delayMenuItem");
  let liveVideoMessage = document.getElementById("liveVideoMessage");

  if (delayMenuItem != null) {
    delayMenuItem.hidden = true;
    liveVideoMessage.hidden = false;
  }
}

function processDelayAdjustButtonClick(event) {
  document.getElementById("saveDelay").style.fill = "#eee";

  let adjustment = 0;
  if (this.id === "increaseDelayButton") {
    adjustment = 1;
  } else if (this.id === "decreaseDelayButton") {
    adjustment = -1;
  }

  const delayInPlayerElement = window.document.getElementById("delayInPlayer");
  let adjustedValue = parseInt(delayInPlayerElement.value) + adjustment;

  processPlayerDelayChange(adjustedValue);
}

function processDelayInPlayerKeyDown(event) {
  //needed in order to override youtube player keydown events.
  event.stopPropagation();
}

function processDelayInPlayer(event) {
  document.getElementById("saveDelay").style.fill = "#eee";

  processPlayerDelayChange(this.value);
}

function processPlayerDelayChange(adjustedValue) {
  if (adjustedValue === "") {
    adjustedValue = 0;
  }

  const delayInPlayerElement = window.document.getElementById("delayInPlayer");
  delayInPlayerElement.value = adjustedValue;
  delayInPlayerElement.style.width = ((delayInPlayerElement.value.length) * 8) + 'px';

  if (delayInPlayerElement.checkValidity()) {
    if (adjustedValue != undefined) {
      updateDelayInPlayerTitle(adjustedValue);
    }

    if (synchronizer != undefined) {
      if (adjustedValue != undefined) {
        synchronizer.syncValue = adjustedValue;
      }
      synchronizer.startMainAdjustLagLoop();
    }
  } else {
    delayInPlayerElement.reportValidity();
  }
}

function updateDelayInPlayerTitle(value) {
  const delayInPlayerElement = window.document.getElementById("delayInPlayer");
  if (value < 0) {
    delayInPlayerElement.title = "Audio will be hastened";
  } else if (value > 0) {
    delayInPlayerElement.title = "Audio will be delayed";
  } else {
    delayInPlayerElement.title = "No sync";
  }
}

window.addEventListener('DOMContentLoaded', (event) => {

  //needed for a smooth transition to the next video in a playlist.
  if (synchronizer !== undefined) {
    synchronizer.clearSyncLoop();
  }

  const videoElement = window.document.getElementsByTagName('video')[0];
  if (videoElement != undefined && isValidChromeRuntime()) {
    addAvSyncControlls();
    sendMessage({
      message: "getCurrentTimeBeforeToggle"
    }, handleGetCurrentTimeBeforeToggleResponse);
  }
  else
  {

  }
});

function handleGetCurrentTimeBeforeToggleResponse(response) {
  if (response != "notFound" && response.time > 0 && response.url === window.location.href) {
    const videoElement = window.document.getElementsByTagName('video')[0];
    videoElement.currentTime = response.time;

    //it's now safe to clear this tab's storage.
    sendMessage({
      message: "clearTabStorage"
    });
  }
}

function sendMessage(messageObject, callbackFunction) {
  //if the context was not invalidated such as when an extension is updated
  if (isValidChromeRuntime()) {
    chrome.runtime.sendMessage(messageObject, callbackFunction);
  } else {
    document.getElementById("yt-av-sync").removeEventListener('click', toggleAvSyncMenu, true);
    document.getElementById("yt-av-sync").addEventListener('click', toggleReloadPageMessage, true);
    document.getElementById("yt-av-sync-reload-page-close-button").addEventListener('click', toggleReloadPageMessage, true);
  }
}

function getURL(urlString) {
  if (isValidChromeRuntime()) {
    return chrome.runtime.getURL(urlString);
  } else {
    document.getElementById("yt-av-sync").removeEventListener('click', toggleAvSyncMenu, true);
    document.getElementById("yt-av-sync").addEventListener('click', toggleReloadPageMessage, true);
    document.getElementById("yt-av-sync-reload-page-close-button").addEventListener('click', toggleReloadPageMessage, true);
  }
}

//Youtube video changed
window.addEventListener('yt-page-data-updated', function () {
  if (synchronizer !== undefined) {
    synchronizer.clearSyncLoop();
  }

  let videoElements = window.document.getElementsByTagName('video');
  //console.log(videoElements.length);
  const videoElement = videoElements[0];

  if (videoElement != undefined && isValidChromeRuntime()) {
    addAvSyncControlls();
  }
});

//On browser back button press, stop the sync sound.
window.addEventListener("popstate", () => {
  const audioElement = window.document.getElementById(syncAudioElementName);
  if (audioElement != undefined) {
    audioElement.parentNode.removeChild(audioElement);
  }
});

function isReliableSystem() {
  return (navigator.appVersion.indexOf("Win") != -1 && navigator.userAgent.indexOf("Chrome") != -1);
}

//When updating the chrome extension, the existing content scripts will be disconnected. This check helps with avoiding error "Extension context invalidated"
function isValidChromeRuntime() {
  try {
    return chrome.runtime && !!chrome.runtime.getManifest();
  } catch (error) {
    //todo inform the user and ask to give consent for reloading the page. When consented, call: location.reload();
    return false;
  }
}

function getYouTubeLiveButtonElement() {
  return document.getElementsByClassName("ytp-live")[0];
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const videoElements = window.document.getElementsByTagName('video');
  const videoElement = videoElements[0];

  let youTubeliveButton = getYouTubeLiveButtonElement();
  if (youTubeliveButton !== undefined) {
    turnVolumeForVideoToAudible(videoElement);
  } else if (request.url != undefined) {
    const url = request.url;

    if (typeof videoElement == 'undefined') {
      return;
    }

    videoElement.onloadeddata = makeSetAudioURL(videoElement, url);
    window.addEventListener('yt-page-data-updated', makeSetAudioURL(videoElement, url));
  }

  if (request.message === "syncChanged") {
    synchronizer.syncValue = request.syncValue;
    if (document.getElementById("delayControls") != null) {
      processPlayerDelayChange(request.syncValue);
    }
  }

  if (request.message === "maxSelectableDelayChanged") {
    globalMaxSelectableDelayValue = request.maxSelectableDelayValue;
    if (document.getElementById("delayControls") != null) {
      window.document.getElementById("delayInPlayer").setAttribute("min", -globalMaxSelectableDelayValue);
      window.document.getElementById("delayInPlayer").setAttribute("max", globalMaxSelectableDelayValue);
    }
  }

  if (request.message === "maxAcceptableDelayChanged") {
    let maxAcceptableDelayValue = request.maxAcceptableDelayValue;
    if (document.getElementById("delayControls") != null) {
      synchronizer.acceptablePrecisionInMs = maxAcceptableDelayValue / 1000;
    }
  }

  if (request.message === "getCurrentTime") {
    let currentTime = 0;
    if (typeof videoElement !== 'undefined') {
      currentTime = videoElement.currentTime.toString().split(".")[0];
    }

    sendResponse({
      "currentTime": currentTime
    });
  }
});
