const showThumbnail = document.getElementById('show-thumbnail');
const tuneBladePort = document.getElementById('tuneBladePort');
const delaySelectorElement = document.getElementById('delaySelector');
const delayNumberElement = document.getElementById("delayNumber");

function saveOptions() {
    chrome.storage.local.set({
        tuneBladePort: tuneBladePort.value,
		airplayDevices : getAirplayDevicesJson()
    });
}

tuneBladePort.addEventListener('change', populateAirplayDevicesAndSave);
delaySelectorElement.addEventListener('change', processDelayChange);

function restoreOptions() {
    chrome.storage.local.get({
        tuneBladePort: "", 
		delayValue: 0
    }, function (items) {
        tuneBladePort.value = items.tuneBladePort;
		delaySelectorElement.value = items.delayValue;
		delayNumberElement.innerHTML = items.delayValue;
		populateAirplayCheckboxes(items.tuneBladePort);		
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);

function processDelayChange()
{
	document.getElementById("delayNumber").innerHTML = delaySelectorElement.value;
	chrome.runtime.sendMessage({"message" : "processDelayChange", "delayValue": delaySelectorElement.value});	
}

function populateAirplayDevicesAndSave()
{
	populateAirplayCheckboxes(tuneBladePort.value);
	saveOptions();
}

function getAirplayDevicesJson()
{
	var airplayDevices = new Array();
	var airplayDevicesCheckboxes = document.getElementsByClassName('airplayDevices');
	for (i=0; i<airplayDevicesCheckboxes.length; i++)
	{
		if(airplayDevicesCheckboxes[i].checked === true)
		{
			var airplayDevice = {id : airplayDevicesCheckboxes[i].id,
			name : airplayDevicesCheckboxes[i].name,
			value : airplayDevicesCheckboxes[i].value};
			airplayDevices.push(airplayDevice);
		}		
	}
	return airplayDevices;
}

function restoreSelectedAirplayDevices()
{		
	chrome.storage.local.get({
        airplayDevices: [{id: 0, name: "Fill in port to connect to TuneBlade", value: 0}]			
    }, function (items) {
        var airplayDevicesCheckboxes = document.getElementsByClassName('airplayDevices');
		for (i=0; i<airplayDevicesCheckboxes.length; i++)
		{
			const airplayDevice = items.airplayDevices.find(element => element.value === airplayDevicesCheckboxes[i].value);
			if(airplayDevice != undefined)
			{
				airplayDevicesCheckboxes[i].checked = true;
			}
		}
    });	
}

function populateAirplayCheckboxes(port) {
	
	document.getElementById('airplayDevicesContainer').innerHTML = "";	
	var tuneBladeURL = "http://localhost:"+port+"/devices/";	
	getJSON(tuneBladeURL,
	function(err, data) {
	  if (err !== null) {
		alert('Something went wrong: ' + err);
	  } else {		 
		data.forEach(createAirplayDeviceCheckbox);
		restoreSelectedAirplayDevices();
	  }
	});
}

function createAirplayDeviceCheckbox(item, index) {
	var div = document.createElement('div');
	div.classList.add("form-check");

	var airplayDeviceCheckbox = document.createElement('input');
	airplayDeviceCheckbox.type = 'checkbox';
	airplayDeviceCheckbox.id = "airplayDevice"+index;
	airplayDeviceCheckbox.classList.add("airplayDevices");
	airplayDeviceCheckbox.classList.add("form-check-input");
	airplayDeviceCheckbox.name = item.Name;
	airplayDeviceCheckbox.value = item.ID;
	
	var airplayDeviceLabel = document.createElement('label');
	airplayDeviceLabel.classList.add("form-check-label");
	airplayDeviceLabel.for = airplayDeviceCheckbox.id;
	airplayDeviceLabel.innerHTML += item.Name;
	
	div.appendChild(airplayDeviceCheckbox);
	div.appendChild(airplayDeviceLabel);
	
	var container = document.getElementById('airplayDevicesContainer');	
	container.appendChild(div);	
	
	document.getElementById(airplayDeviceCheckbox.id).addEventListener("change", function() {
		saveOptions();
	});
}

function getJSON(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
      var status = xhr.status;
      if (status === 200) {
        callback(null, xhr.response);
      } else {
        callback(status, xhr.response);
      }
    };
    xhr.send();
};

