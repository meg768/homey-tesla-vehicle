'use strict';

const Device = require('../../src/device');


module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = this.vehicle.isClimateOn(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
			await this.vehicle.setClimateState(value);
			await this.vehicle.updateVehicleData(2000);
		});
	}

	async onVehicleData(vehicleData) {
		try {
			let state = this.vehicle.isClimateOn(vehicleData);

			if (this.state != state) {
				this.state = state;
				this.log(`Updating HVAC status to ${this.state ? 'ON' : 'OFF'}.`);
				this.setCapabilityValue('onoff', this.state);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}

	async onAction(name, args) {
		switch (name) {
			case 'hvac_for_a_while': {
				let { minutes } = args;
				let timer = this.app.getTimer('hvac_for_a_while_timer');

				await this.vehicle.setClimateState(true);
				await this.vehicle.updateVehicleData(2000);

				timer.setTimer(minutes * 60000, async () => {
					await this.vehicle.setClimateState(false);
					await this.vehicle.updateVehicleData(2000);
				});
			}
		}
	}
};
