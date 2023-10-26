'use strict';

const { Driver } = require('homey');

module.exports = class MyDriver extends Driver {

	async onPairListDevices() {
        let device = {};
        device.name = this.homey.__('DeviceSettingsInstanceName');
        device.data = {}
        device.data.id = 'settings'
	
        return [device];
    }


}
