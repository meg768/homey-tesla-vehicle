'use strict';

const { Device } = require('homey');

class MyDevice extends Device {

    async onUninit() {
        await this.homey.app.unregisterDevice(this);
    }

	async onInit() {
		this.vehicle = await this.homey.app.registerDevice(this);

		// Get initial value
		this.state = this.vehicle.vehicleData.climate_state.defrost_mode != 0;

        this.registerCapabilityListener('onoff', async (value, options) => {

            let state = value ? true : false;

            if (this.state != state) {
                this.log(`Setting defrost mode to ${state ? 'ON' : 'OFF'}.`);

                await this.vehicle.post('command/set_preconditioning_max', {on:state});
                await this.vehicle.updateVehicleData(2000);
            }
		});

		await this.setCapabilityValue('onoff', this.state);

		this.vehicle.on('vehicle_data', async (vehicleData) => {
			try {
				let state = vehicleData.climate_state.defrost_mode != 0;

				if (this.state != state) {
					this.state = state;

                    this.log(`Updating defrost mode to ${this.state ? 'ON' : 'OFF'}.`);
					this.setCapabilityValue('onoff', this.state);
				}
			} catch (error) {
				this.log(error);
			}
		});
	}
}

module.exports = MyDevice;
