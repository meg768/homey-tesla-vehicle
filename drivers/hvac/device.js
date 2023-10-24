'use strict';

const { Device } = require('homey');

class MyDevice extends Device {

    async onUninit() {
        await this.homey.app.unregisterDevice(this);
    }

	async onInit() {
		this.vehicle = await this.homey.app.registerDevice(this);


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
				}
			} catch (error) {
				this.log(error);
			} finally {
				this.vehicle.getVehicleData();
			}
		});

		await this.setCapabilityValue('onoff', this.state);

		this.vehicle.on('vehicle_data', async (vehicleData) => {
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
		});
	}
}

module.exports = MyDevice;
