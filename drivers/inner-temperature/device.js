'use strict';

const { Device } = require('homey');

class MyDevice extends Device {

    async onUninit() {
        await this.homey.app.unregisterDevice(this);
    }
    
	async onInit() {
		this.vehicle = await this.homey.app.registerDevice(this);

		// Get initial value
		this.temperature = this.vehicle.vehicleData.climate_state.inside_temp;

		await this.setCapabilityValue('measure_temperature', this.temperature);

		this.vehicle.on('vehicle_data', async (vehicleData) => {
			try {
				let temperature = vehicleData.climate_state.inside_temp;

				if (this.temperature != temperature) {
					this.temperature = temperature;
					this.log(`Updating inner temperature to ${this.temperature}.`);
					this.setCapabilityValue('measure_temperature', this.temperature);
				}
			} catch (error) {
				this.log(error);
			}
		});
	}
}

module.exports = MyDevice;
