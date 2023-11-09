'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

class MyDevice extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = this.vehicle.isSteeringWheelHeaterOn(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
            await this.vehicle.setSteeringWheelHeaterState(value);
            await this.vehicle.updateVehicleData(1000);
		});

	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let state = this.vehicle.isSteeringWheelHeaterOn(vehicleData);

			if (this.state != state) {
				this.state = state;
				this.log(`Updating steering wheel state to ${this.state ? 'ON' : 'OFF'}.`);
				this.setCapabilityValue('onoff', this.state);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}
}

module.exports = MyDevice;
