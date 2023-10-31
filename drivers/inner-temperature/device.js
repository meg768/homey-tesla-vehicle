'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.temperature = TeslaAPI.getInsideTemperature(this.vehicle.vehicleData);
		await this.setCapabilityValue('measure_temperature', this.temperature);
	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let temperature = TeslaAPI.getInsideTemperature(vehicleData);

			if (this.temperature != temperature) {
				this.temperature = temperature;
				this.log(`Updating inside temperature to ${this.temperature}.`);
				this.setCapabilityValue('measure_temperature', this.temperature);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}
};
