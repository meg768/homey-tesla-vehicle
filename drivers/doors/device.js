'use strict';

const Device = require('../../src/device');

module.exports = class extends Device {
	async onInit() {
		await super.onInit();

		// Get initial value
		this.locked = this.vehicle.isLocked(this.vehicle.vehicleData);
		await this.setCapabilityValue('locked', this.locked);


		this.registerCapabilityListener('locked', async (value, options) => {
			try {
				let locked = value ? true : false;

				if (this.vehicle.isLocked() != locked) {
					this.log(`Setting lock state to ${locked ? 'LOCKED' : 'UNLOCKED'}.`);

					if (locked) {
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
			let locked = this.vehicle.isLocked(vehicleData);

			if (this.locked != locked) {
				this.locked = locked;
				this.log(`Updating doors state to ${this.locked ? 'LOCKED' : 'UNLOCKED'}.`);
				this.setCapabilityValue('locked', this.locked);
			}
		} catch (error) {
			this.log(error.stack);
		}
	}
};
