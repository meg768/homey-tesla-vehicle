'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = !this.vehicle.isLocked(this.vehicle.vehicleData);
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
			try {
				let state = value ? true : false;

				if (this.state != state) {
					this.log(`Setting doors state to ${state ? 'UNLOCKED' : 'LOCKED'}.`);

					if (state) {
						await this.vehicle.post('command/door_unlock');
						let remoteStartDrivePassword = this.getSetting('remoteStartDrivePassword');

						if (typeof remoteStartDrivePassword == 'string' && remoteStartDrivePassword != '') {
							try {
								await this.vehicle.post(`command/remote_start_drive?password=${remoteStartDrivePassword}`);
							} catch (error) {}
						}
					} else {
						await this.vehicle.post('command/door_lock');
					}

					await this.vehicle.updateVehicleData(2000);
				}
			} catch (error) {
				this.log(error.stack);
			}
		});
	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			let state = !this.vehicle.isLocked(vehicleData);

			if (this.state != state) {
				this.state = state;
				this.log(`Updating doors state to ${this.state ? 'UNLOCKED' : 'LOCKED'}.`);
				this.setCapabilityValue('onoff', this.state);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}
};
