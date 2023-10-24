'use strict';

const Homey = require('homey');

module.exports = class extends Homey.Device {

    async onUninit() {
        await this.homey.app.unregisterDevice(this);
    }

	async onInit() {
		this.vehicle = await this.homey.app.registerDevice(this);

        
		this.registerCapabilityListener('onoff', async (value, options) => {

            if (value) {
                try {
                    await this.vehicle.getVehicleData();
                }
                catch (error) {
                    this.log(`Pong failed. ${error.stack}`);
                }

                setTimeout(async () => {
                    await this.setCapabilityValue('onoff', false);
                }, 1000);
            }

		});



        await this.setCapabilityValue('onoff', false);

    }


}
