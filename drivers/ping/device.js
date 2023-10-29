'use strict';

const Device = require('../../device');

class MyDevice extends Device {
	async onSettings({ oldSettings, changedKeys, newSettings }) {
		this.debug(`Settings changed.`);
		this.debug(newSettings);

        this.setTimeout(newSettings.interval);
	}

	async onUninit() {
		await super.onUninit();
		this.clearTimeout();
	}

	async onInit() {
		await super.onInit();

		this.state = false;
		this.timer = null;

		await this.setCapabilityValue('onoff', this.state);

		this.registerCapabilityListener('onoff', async (value, options) => {
			if (value === this.state) {
				return;
			}

			this.state = value;
			this.log(`Ping is turned ${this.state ? 'ON' : 'OFF'}.`);

			if (this.state) {
				await this.vehicle.getVehicleData();
			}
		});

	}

    onVehicleData(vehicleData) {
		super.onVehicleData(vehicleData);
        this.setTimeout();
	}


	clearTimeout() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

    setTimeout(interval) {
        this.clearTimeout();

        if (this.state) {
            if (interval == undefined) {
                interval = this.getSetting('interval') || 8;
            }

            if (interval > 0) {
                this.timer = setTimeout(async () => {
                    await this.vehicle.getVehicleData();
                }, interval * 60000);
            }
    
        }
    }

}

module.exports = MyDevice;
