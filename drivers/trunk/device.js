'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');


module.exports = class MyDevice extends Device {

	async onInit() {
        await super.onInit();

		// Get initial value
		this.state = TeslaAPI.isTrunkOpen(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

        this.registerCapabilityListener('onoff', async (value, options) => {
            let state = value ? true : false;

            if (this.state != state) {
                await this.vehicle.actuateTrunk();
                await this.vehicle.updateVehicleData(3000);
            }
		});


	}

    async onVehicleData(vehicleData) {
        try {
            let state = TeslaAPI.isTrunkOpen(vehicleData);

            if (this.state != state) {
                this.state = state;
                this.log(`Updating trunk state to ${this.state ? 'ON' : 'OFF'}.`);
                this.setCapabilityValue('onoff', this.state);
            }
        } catch (error) {
            this.log(error.stack);
        }

    }
}

