'use strict';

const Device = require('../../src/device');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.temperature = this.vehicle.getOutsideTemperature(this.vehicle.vehicleData);

		await this.setCapabilityValue('measure_temperature', this.temperature);
	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let temperature = this.vehicle.getOutsideTemperature(vehicleData);

			if (this.temperature != temperature) {
				this.temperature = temperature;
				this.log(`Updating outer temperature to ${this.temperature}.`);
				this.setCapabilityValue('measure_temperature', this.temperature);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}
};
