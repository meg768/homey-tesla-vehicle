'use strict';

const Device = require('../../device');

module.exports = class extends Device {

	async onInit() {
        await super.onInit();

        this.registerCapabilityListener('onoff', async (value, options) => {
            if (value) {
                this.log(`Opening frunk.`);

                await this.vehicle.post('command/actuate_trunk', {which_trunk:'front'});
                setTimeout(async () => {
                    await this.setCapabilityValue('onoff', false);
                }, 1000);
            }
		});

		await this.setCapabilityValue('onoff', false);

	}
}

