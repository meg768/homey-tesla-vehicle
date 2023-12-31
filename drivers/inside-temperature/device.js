'use strict';

const Device = require('../../src/device');


module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.temperature = this.vehicle.getInsideTemperature(this.vehicle.vehicleData);
		await this.setCapabilityValue('measure_temperature', this.temperature);
	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let temperature = this.vehicle.getInsideTemperature(vehicleData);

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
