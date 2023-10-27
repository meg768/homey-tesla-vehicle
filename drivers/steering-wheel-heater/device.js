'use strict';

const Device = require('../../device');

class MyDevice extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = this.vehicle.vehicleData.climate_state.steering_wheel_heater;

		this.registerCapabilityListener('onoff', async (value, options) => {
			let state = value ? true : false;

			if (this.state != state) {
				this.log(`Setting steering wheel heater state to ${state ? 'ON' : 'OFF'}.`);

				await this.vehicle.post('command/remote_steering_wheel_heater_request', { on: state });
				await this.vehicle.updateVehicleData(1000);
			}
		});

		await this.setCapabilityValue('onoff', this.state);
	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let state = vehicleData.climate_state.steering_wheel_heater;

			if (this.state != state) {
				this.state = state;
				this.log(`Updating steering wheel state to ${this.state ? 'ON' : 'OFF'}.`);
				this.setCapabilityValue('onoff', this.state);
			}
		} catch (error) {
			this.log(error);
		}
	}
}

module.exports = MyDevice;
