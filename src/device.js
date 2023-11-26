'use strict';
const Homey = require('homey');


module.exports = class extends Homey.Device {


    async onVehicleData(vehicleData) {
    }



	async onInit() {
        
        this.app = this.homey.app;
        this.debug = this.log;
        this.vehicle = await this.homey.app.registerDevice(this);

		this.vehicle.on('vehicle_data', async (vehicleData) => {
            await this.onVehicleData(vehicleData);
		});


	}

    async onUninit() {
		await this.homey.app.unregisterDevice(this);
    }

	async trigger(name, tokens, state) {
		if (tokens) {
			this.log(`Triggering '${name}' with tokens ${JSON.stringify(tokens)}`);
		} else {
			this.log(`Triggering '${name}'}`);
		}
		const triggerCard = this.homey.flow.getDeviceTriggerCard(name);
		await triggerCard.trigger(this, tokens, state);
	}
}

