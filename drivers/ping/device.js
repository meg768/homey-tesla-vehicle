'use strict';

const Device = require('../../device');

class MyDevice extends Device {

    
	async onInit() {
		await super.onInit();

		this.state = false;
		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
			if (value != this.state) {
                this.state = value;
                this.log(`Ping is turned ${this.state ? 'ON' : 'OFF'}.`);
                await this.ping();
            }
		});

	}

    async ping() {
        if (this.state) {
            try {
                this.log(`Ping!`);
                await this.vehicle.getVehicleData();
            }
            catch(error) {
                this.log(`Ping failed. ${error.stack}`);
            }
        }

    }

    async onVehicleState(vehicleState) {
		await super.onVehicleState(vehicleState);

		if (vehicleState != 'online') {
            this.ping();
		}
	}


}

module.exports = MyDevice;
