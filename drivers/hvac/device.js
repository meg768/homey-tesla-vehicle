'use strict';

const Device = require('../../device');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = this.vehicle.vehicleData.climate_state.is_climate_on;

		this.registerCapabilityListener('onoff', async (value, options) => {
			try {
				let state = value ? true : false;

				if (this.state != state) {
					this.log(`Setting HVAC state to ${state ? 'ON' : 'OFF'}.`);

					if (state) {
						await this.vehicle.post('command/auto_conditioning_start');
					} else {
						await this.vehicle.post('command/auto_conditioning_stop');
					}
                    
					await this.setCapabilityValue('onoff', state);
				}
			} catch (error) {
				this.log(error);
			} finally {
				this.vehicle.updateVehicleData(1000);
			}
		});
	}

	async onVehicleData(vehicleData) {
		try {
			let state = vehicleData.climate_state.is_climate_on;

			if (this.state != state) {
				this.state = state;
				this.log(`Updating HVAC status to ${this.state ? 'ON' : 'OFF'}.`);
				this.setCapabilityValue('onoff', this.state);
			}
		} catch (error) {
			this.log(error);
		}
	}
};
