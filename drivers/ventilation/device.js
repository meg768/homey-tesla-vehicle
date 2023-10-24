'use strict';

const { Device } = require('homey');

class MyDevice extends Device {

    async onUninit() {
        await this.homey.app.unregisterDevice(this);
    }

	async onInit() {
		this.vehicle = await this.homey.app.registerDevice(this);


		// Get initial value
		this.state = this.vehicle.vehicleData.vehicle_state.fd_window != 0;

		this.registerCapabilityListener('onoff', async (value, options) => {
			if (this.state != value) {
                this.state = value;
                this.log(`Ventilation is set to ${this.state ? 'ON' : 'OFF'}`);

                var payload = {};
                payload.command = value ? 'vent' : 'close';
                payload.lat = 0;
                payload.lon = 0;

                if (payload.command == 'close') {
                    let vehicleData = await this.vehicle.getVehicleData();
                    payload.lat = vehicleData.drive_state.latitude;
                    payload.lon = vehicleData.drive_state.longitude;
                }

                await this.vehicle.post('command/window_control', payload);
			}
		});


		await this.setCapabilityValue('onoff', this.state);

		this.vehicle.on('vehicle_data', async (vehicleData) => {
			try {
				let state = vehicleData.vehicle_state.fd_window != 0;

				if (this.state != state) {
					this.state = state;
					this.log(`Updating ventilation state to ${this.state ? 'ON' : 'OFF'}`);
					this.setCapabilityValue('onoff', this.state);
				}
			} catch (error) {
				this.log(error);
			}
		});
	}
}

module.exports = MyDevice;
