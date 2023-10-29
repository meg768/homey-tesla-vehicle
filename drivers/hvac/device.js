'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = TeslaAPI.isClimateOn(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
            await this.vehicle.setClimateState(value);
            await this.vehicle.updateVehicleData(2000);
		});
	}

	async onVehicleData(vehicleData) {
		try {
			let state = TeslaAPI.isClimateOn(vehicleData);

			if (this.state != state) {
				this.state = state;
				this.log(`Updating HVAC status to ${this.state ? 'ON' : 'OFF'}.`);
				this.setCapabilityValue('onoff', this.state);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}
};
