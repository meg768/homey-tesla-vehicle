'use strict';

const Homey = require('homey');
const TeslaAPI = require('../../tesla-api');

class MyDevice extends Homey.Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = TeslaAPI.isSteeringWheelHeaterOn(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
            await this.vehicle.setSteeringWheelHeaterState(value);
            await this.vehicle.updateVehicleData(1000);
		});

	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let state = TeslaAPI.isSteeringWheelHeaterOn(vehicleData);

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
