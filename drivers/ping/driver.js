'use strict';

const { Driver } = require('homey');

module.exports = class MyDriver extends Driver {


    async onInit() {


    }
	async onPairListDevices() {
		return await this.homey.app.getPairListDevices(this.homey.__('driver.ping.name'));
	}
}
