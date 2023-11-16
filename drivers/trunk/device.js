'use strict';

const Device = require('../../device');



module.exports = class MyDevice extends Device {

	async onInit() {
        await super.onInit();

		// Get initial value
		this.locked = !this.vehicle.isTrunkOpen(this.vehicle.vehicleData);
		await this.setCapabilityValue('locked', this.locked);

        this.registerCapabilityListener('locked', async (value, options) => {
            let locked = value ? true : false;

            if (this.locked != locked) {
                await this.vehicle.actuateTrunk();
                await this.vehicle.updateVehicleData(3000);
            }
		});


	}

    async onVehicleData(vehicleData) {
        try {
            let locked = !this.vehicle.isTrunkOpen(vehicleData);

            if (this.locked != locked) {
                this.locked = locked;
                this.log(`Updating trunk lock to ${this.locked ? 'LOCKED' : 'UNLOCKED'}.`);
                this.setCapabilityValue('locked', this.locked);
            }
        } catch (error) {
            this.log(error.stack);
        }

    }
}

