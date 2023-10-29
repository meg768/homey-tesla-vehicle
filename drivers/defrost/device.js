'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = TeslaAPI.isDefrosting(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
			await this.vehicle.setDefrostState(value);
			await this.vehicle.updateVehicleData(2000);
		});

	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let state = TeslaAPI.isDefrosting(vehicleData);

			if (this.state != state) {
				this.state = state;
				this.log(`Updating defrost state to ${this.state ? 'ON' : 'OFF'}.`);
				this.setCapabilityValue('onoff', this.state);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}
};
