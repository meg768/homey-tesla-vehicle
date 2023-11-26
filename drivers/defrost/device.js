'use strict';

const Device = require('../../src/device');


module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = this.vehicle.isDefrosting(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
			await this.vehicle.setDefrostState(value);
			await this.vehicle.updateVehicleData(2000);
		});

	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let state = this.vehicle.isDefrosting(vehicleData);

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
            case 'defrost_for_a_while': {
                let {minutes} = args;
                let timer = this.app.getTimer('defrost_for_a_while_timer');
        
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
