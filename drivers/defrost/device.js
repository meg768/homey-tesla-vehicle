'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = TeslaAPI.isDefrosting(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
			await this.vehicle.setDefrostState(value);
			await this.vehicle.updateVehicleData(2000);
		});

	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let state = TeslaAPI.isDefrosting(vehicleData);

			if (this.state != state) {
				this.state = state;
				this.log(`Updating defrost state to ${this.state ? 'ON' : 'OFF'}.`);
				this.setCapabilityValue('onoff', this.state);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}

    async onAction(name, args) {
        switch(name) {
            case 'defrost-for-a-while': {
                let {minutes} = args;
                let timer = this.app.getTimer('defrost-for-a-while-timer');
        
                await this.vehicle.setDefrostState(true);
                await this.vehicle.updateVehicleData(2000);
        
                timer.setTimer(minutes * 60000, async () => {
                    await this.vehicle.setDefrostState(false);
                    await this.vehicle.updateVehicleData(2000);
                });
        
            };
        }
    }
        
};
