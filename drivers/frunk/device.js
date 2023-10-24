'use strict';

const { Device } = require('homey');

class MyDevice extends Device {

    async onUninit() {
        await this.homey.app.unregisterDevice(this);
    }

	async onInit() {
		this.vehicle = await this.homey.app.registerDevice(this);

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

module.exports = MyDevice;
