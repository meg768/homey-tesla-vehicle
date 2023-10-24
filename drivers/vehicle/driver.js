'use strict';

const { Driver } = require('homey');

module.exports = class MyDriver extends Driver {

	async onPairListDevices() {
		return await this.homey.app.getPairListDevices();
	}
}
