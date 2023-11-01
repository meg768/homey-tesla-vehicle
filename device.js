'use strict';
const Homey = require('homey');


module.exports = class extends Homey.Device {


    async onVehicleData(vehicleData) {
    }

    async onVehicleState(vehicleState) {
    }

	async onInit() {
        
        this.debug = this.log;
        this.vehicle = await this.homey.app.registerDevice(this);

		this.vehicle.on('vehicle_data', async (vehicleData) => {
            await this.onVehicleData(vehicleData);
		});

		this.vehicle.on('vehicle_state', async (vehicleState) => {
            await this.onVehicleState(vehicleState);
		});
	}

    async onUninit() {
		await this.homey.app.unregisterDevice(this);
    }

	async trigger(name, args) {
		if (args) {
			this.log(`Triggering '${name}' with parameters ${JSON.stringify(args)}`);
		} else {
			this.log(`Triggering '${name}'}`);
		}
		const triggerCard = this.homey.flow.getDeviceTriggerCard(name);
		await triggerCard.trigger(this, args);
	}
}

