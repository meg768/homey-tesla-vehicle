'use strict';

const Device = require('../../src/device');



module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		await this.setCapabilityValue('onoff', false);

		this.registerCapabilityListener('onoff', async (value, options) => {
			if (value) {
				await this.vehicle.actuateFrunk();

                setTimeout(async () => {
                    await this.setCapabilityValue('onoff', false);
                }, 2000);
			}
		});
	}
};
