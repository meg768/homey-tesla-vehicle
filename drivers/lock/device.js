'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.state = this.vehicle.isLocked(this.vehicle.vehicleData);
		await this.setCapabilityValue('locked', this.state);

		this.registerCapabilityListener('locked', async (value, options) => {
			try {
				let state = value ? true : false;

				if (this.state != state) {
					this.log(`Setting lock state to ${state ? 'LOCKED' : 'UNLOCKED'}.`);

					if (state) {
						await this.vehicle.post('command/door_lock');
					} else {

						await this.vehicle.post('command/door_unlock');

                        let remoteStartDrivePassword = this.getSetting('remoteStartDrivePassword');

						if (typeof remoteStartDrivePassword == 'string' && remoteStartDrivePassword != '') {
							await this.vehicle.post(`command/remote_start_drive?password=${remoteStartDrivePassword}`);
						}
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
			let state = this.vehicle.isLocked(vehicleData);

			if (this.state != state) {
				this.state = state;
				this.log(`Updating locked state to ${this.state ? 'ON' : 'OFF'}.`);
				this.setCapabilityValue('locked', this.state);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}
};
