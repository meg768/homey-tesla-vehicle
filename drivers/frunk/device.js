'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		await this.setCapabilityValue('onoff', false);

		this.registerCapabilityListener('onoff', async (value, options) => {
			if (value) {
				await this.vehicle.actuateFrunk();
			}
		});
	}
};
