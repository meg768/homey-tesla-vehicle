'use strict';

const Device = require('../../src/device');


class MyDevice extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = this.vehicle.isAnyWindowOpen(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
			this.vehicle.setVentilationState(value);
			this.vehicle.updateVehicleData(3000);
		});
	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let state = this.vehicle.isAnyWindowOpen(vehicleData);

			if (this.state != state) {
				this.state = state;
				this.log(`Updating ventilation state to ${this.state ? 'ON' : 'OFF'}`);
				this.setCapabilityValue('onoff', this.state);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}
}

module.exports = MyDevice;
