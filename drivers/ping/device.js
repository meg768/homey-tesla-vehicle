'use strict';

const { Device } = require('homey');

class MyDevice extends Device {

    async onSettings({oldSettings, changedKeys, newSettings}) {

        this.debug(`Settings changed.`)
        this.debug(newSettings);

        if (this.timer) {
            this.stopPolling();
            this.startPolling();
        }


    }

    async onUninit() {
        this.stopPolling();

        this.actions.forEach((action) => {
            action.removeAllListeners();
        });

        this.homey.app.unregisterDevice(this);
    }

    async onInit() {

        this.debug = this.log;
        this.state = false;
        this.timer = null;
        this.actions = [];
        this.vehicle = await this.homey.app.registerDevice(this);

		this.registerCapabilityListener('onoff', async (value, options) => {

			if (value === this.state) {
				return;
			}

			this.state = value;
			this.log(`Ping is turned ${this.state ? 'ON' : 'OFF'}.`);

            this.state ? this.startPolling() : this.stopPolling();

		});

        this.addAction('set-ping-interval', async ({interval}) => {
            let settings = this.getSettings();
            settings.interval = interval;

            if (this.timer) {
                this.stopPolling();
                this.startPolling();
            }

            this.log(`Ping interval is now set to ${interval}`);
        });


        await this.setCapabilityValue('onoff', this.state);

    }

    addAction(name, fn) {
		let action = this.homey.flow.getActionCard(name);
		action.registerRunListener(fn);

        this.actions.push(action);
	}




    stopPolling() {
        if (this.timer) {
            this.log(`Ping polling stopped.`);
            clearTimeout(this.timer);
            this.timer = null;
        }

    }

    startPolling() {
        this.log(`Ping polling started.`);

        let loop = async() => {
            clearTimeout(this.timer);
            this.timer = null;

            try {
                await this.vehicle.getVehicleData();
            }
            catch(error) {
                this.log(`Could not fetch vehicle data. ${error}`);
            }

            if (this.state) {
                let interval = this.getSetting('interval');
                this.log(`Next ping in ${interval} minutes.`);
                this.timer = setTimeout(loop, interval * 60000);
            } 
        }
        
        loop();

    }

}

module.exports = MyDevice;
