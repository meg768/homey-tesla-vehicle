'use strict';

const Device = require('../../device');

module.exports = class extends Device {

    
	async onInit() {
        await super.onInit();

		// Get initial value
		this.temperature = this.vehicle.vehicleData.climate_state.outside_temp;

		await this.setCapabilityValue('measure_temperature', this.temperature);

	}

    async onVehicleData(vehicleData) {
        await super.onVehicleData(vehicleData);

        try {
            let temperature = vehicleData.climate_state.outside_temp;

            if (this.temperature != temperature) {
                this.temperature = temperature;
                this.log(`Updating outer temperature to ${this.temperature}.`);
                this.setCapabilityValue('measure_temperature', this.temperature);
            }
        } catch (error) {
            this.log(error);
        }

    }
}

module.exports = MyDevice;
