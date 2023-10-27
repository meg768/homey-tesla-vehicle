'use strict';

const Device = require('../../device');

module.exports = class MyDevice extends Device {

	async onInit() {
        await super.onInit();

		// Get initial value
		this.state = this.vehicle.vehicleData.vehicle_state.rt != 0;

        this.registerCapabilityListener('onoff', async (value, options) => {
            let state = value ? true : false;

            if (this.state != state) {
                this.log(`Setting trunk state to ${state ? 'ON' : 'OFF'}.`);

                await this.vehicle.post('command/actuate_trunk', {which_trunk:'rear'});
                await this.vehicle.updateVehicleData(3000);
            }
		});

		await this.setCapabilityValue('onoff', this.state);

	}

    async onVehicleData(vehicleData) {
        try {
            let state = vehicleData.vehicle_state.rt != 0;

            if (this.state != state) {
                this.state = state;
                this.log(`Updating trunk state to ${this.state ? 'ON' : 'OFF'}.`);
                this.setCapabilityValue('onoff', this.state);
            }
        } catch (error) {
            this.log(error);
        }

    }
}

