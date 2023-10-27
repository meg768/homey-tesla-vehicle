'use strict';

const Homey = require('homey');
const TeslaAPI = require('../../tesla-api.js');
const Device = require('../../device.js');


class MyDevice extends Device {
	async onSettings({ oldSettings, changedKeys, newSettings }) {
        await this.pollVehicleState(newSettings.pollInterval);
    }

	async onUninit() {
		await super.onUninit();

        // Turn off timers
        this.refreshVehicleData(0);
        this.pollVehicleState(0);

	}

    async pollVehicleState(interval) {

        let loop = async () => {

            if (this.vehicleStateTimer) {
                clearTimeout(this.vehicleStateTimer);
                this.vehicleStateTimer = null;
            }
    
            if (interval > 0) {
                try {
                    await this.vehicle.getVehicleState();
                } catch (error) {
                    this.log(`Failed polling vehicle state. ${error.stack}`);
                }
    
                this.log(`Next vehicle state poll is in ${interval} minute(s).`);
                this.vehicleStateTimer = setTimeout(loop, interval * 60000);
    
            }
            else {
                this.log(`Polling stopped.`);

            }

		};

		loop();

	}

	async refreshVehicleData(delay = 0) {
		if (this.vehicleDataTimer) {
			clearTimeout(this.vehicleDataTimer);
            this.vehicleDataTimer = null;
		}

        if (delay > 0) {
            this.vehicleDataTimer = setTimeout(async () => {
                try {
                    this.log(`Performing refresh on vehicle data.`)
                    await this.vehicle.getVehicleData();
                } catch (error) {
                    this.log(`Failed delayed fetching of vehicle data. ${error.stack}`);
                }
            }, delay * 60000);
    
        }
	}


	async onInit() {
		await super.onInit();

		this.vehicleStateTimer = null;
		this.vehicleDataTimer = null;

		// Get initial value
		this.locked = TeslaAPI.isLocked(this.vehicle.vehicleData);

		// Get initial value
		this.vehicleData = JSON.parse(JSON.stringify(this.vehicle.vehicleData));
        this.vehicleState = 'xxx';

		await this.updateCapabilities(this.vehicle.vehicleData);

		this.registerCapabilityListener('locked', async (value, options) => {
			try {
				let locked = value ? true : false;

				if (this.locked != locked) {
					this.log(`Setting doors to ${locked ? 'LOCKED' : 'UNLOCKED'}.`);

					if (locked) {
						await this.vehicle.post('command/door_lock');
					} else {
						let remoteStartDrivePassword = this.homey.app.getConfig().remoteStartDrivePassword;

						await this.vehicle.post('command/door_unlock');

						if (typeof remoteStartDrivePassword == 'string') {
							await this.vehicle.post(`command/remote_start_drive?password=${remoteStartDrivePassword}`);
						}
					}

					await this.vehicle.post(`command/${locked ? 'door_lock' : 'door_unlock'}`);
					await this.vehicle.updateVehicleData(2000);
				}
			} catch (error) {
				this.log(error);
			}
		});

		this.addCondition('vehicle-is-charging', async (args, state) => {
			return TeslaAPI.isCharging(this.vehicle.vehicleData);
		});

		this.addCondition('vehicle-is-locked', async (args, state) => {
			return TeslaAPI.isLocked(this.vehicle.vehicleData);
		});

		this.addCondition('vehicle-is-online', async (args, state) => {
			return this.vehicleState == 'online';
		});

		this.addCondition('vehicle-is-driving', async (args, state) => {
			return TestaAPI.isDriving(this.vehicle.vehicleData);
		});

		this.addCondition('vehicle-is-at-home', async (args, state) => {
			return this.isAtHome(this.vehicle.vehicleData);
		});

		this.addAction('wake-up', async (args) => {
			this.log(`Waking up...`);
			await this.vehicle.getVehicleData();
		});


        await this.pollVehicleState(this.getSetting('pollInterval'));
	}

	isAtHome(vehicleData) {
		return this.getDistanceFromHomey(vehicleData) < 0.25;
	}

	getDistanceFromHomey(vehicleData) {
		function deg2rad(deg) {
			return deg * (Math.PI / 180);
		}

		function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
			var R = 6371; // Radius of the earth in km
			var dLat = deg2rad(lat2 - lat1); // deg2rad below
			var dLon = deg2rad(lon2 - lon1);
			var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
			var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			var d = R * c; // Distance in km
			return d;
		}

		let distance = 0;
		let homeyLatitude = this.homey.geolocation.getLatitude();
		let homeyLongitude = this.homey.geolocation.getLongitude();
		let vehicleLatitude = vehicleData.drive_state.latitude;
		let vehicleLongitude = vehicleData.drive_state.longitude;

		if (homeyLatitude && homeyLongitude && vehicleLatitude && vehicleLongitude) {
			distance = getDistanceFromLatLonInKm(homeyLatitude, homeyLongitude, vehicleLatitude, vehicleLongitude);
		}

		return distance;
	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {

            // Clear delayed fetch
            this.refreshVehicleData(0);

            if (TeslaAPI.isCharging(vehicleData)) { 
                this.refreshVehicleData(2);
            }

            if (TeslaAPI.isDriving(vehicleData)) {
                this.refreshVehicleData(2);
            }

			await this.setCapabilityValue('distance_from_homey', this.getDistanceFromHomey(vehicleData));

			if (this.locked != vehicleData.vehicle_state.locked) {
				this.locked = vehicleData.vehicle_state.locked;
				this.log(`Updating car doors to ${this.locked ? 'LOCKED' : 'UNLOCKED'}.`);
				this.setCapabilityValue('locked', this.locked);
			}

			if (TeslaAPI.getInsideTemperature(this.vehicleData) != TeslaAPI.getInsideTemperature(vehicleData)) {
				await this.setCapabilityValue('inner_temperature', TeslaAPI.getInsideTemperature(vehicleData));
			}

			if (TeslaAPI.getOutsideTemperature(this.vehicleData) != TeslaAPI.getOutsideTemperature(vehicleData)) {
				await this.setCapabilityValue('outer_temperature', TeslaAPI.getOutsideTemperature(vehicleData));
			}

			if (TeslaAPI.getBatteryLevel(this.vehicleData) != TeslaAPI.getBatteryLevel(vehicleData)) {
				await this.setCapabilityValue('measure_battery', TeslaAPI.getBatteryLevel(vehicleData));
			}

			if (TeslaAPI.getBatteryRange(this.vehicleData) != TeslaAPI.getBatteryRange(vehicleData)) {
				await this.setCapabilityValue('battery_range', TeslaAPI.getBatteryRange(vehicleData));
			}

			if (TeslaAPI.getOdometer(this.vehicleData) != TeslaAPI.getOdometer(vehicleData)) {
				await this.setCapabilityValue('odometer', TeslaAPI.getOdometer(vehicleData));
			}

			if (TeslaAPI.getChargePower(this.vehicleData) != TeslaAPI.getChargePower(vehicleData)) {
				await this.setCapabilityValue('charge_power', TeslaAPI.getChargePower(vehicleData));
			}

			if (TeslaAPI.getVehicleSpeed(this.vehicleData) != TeslaAPI.getVehicleSpeed(vehicleData)) {
				await this.setCapabilityValue('vehicle_speed', TeslaAPIgetVehicleSpeed(vehicleData));
                await this.trigger('vehicle-speed-changed');
			}

			if (TeslaAPI.getChargingState(this.vehicleData) != TeslaAPI.getChargingState(vehicleData)) {
				await this.setCapabilityValue('charging_state', TeslaAPI.getChargingState(vehicleData));
			}

			if (TeslaAPI.getChargingSpeed(this.vehicleData) != TeslaAPI.getChargingSpeed(vehicleData)) {
				await this.setCapabilityValue('charging_speed', TeslaAPI.getChargingSpeed(vehicleData));
			}

			if (TeslaAPI.isCharging(this.vehicleData) != TeslaAPI.isCharging(vehicleData)) {
				if (TeslaAPI.isCharging(vehicleData)) {
					await this.trigger('vehicle-charging-started');
				} else {
					await this.trigger('vehicle-charging-stopped');
				}
			}

			if (TeslaAPI.isDriving(this.vehicleData) != TeslaAPI.isDriving(vehicleData)) {
				if (TeslaAPI.isDriving(vehicleData)) {
					await this.trigger('vehicle-started-driving');
				} else {
					await this.trigger('vehicle-stopped-driving');
				}
			}

			if (this.isAtHome(this.vehicleData) != this.isAtHome(vehicleData)) {
				if (this.isAtHome(vehicleData)) {
					await this.trigger('vehicle-inside-geofence');
				} else {
					await this.trigger('vehicle-outside-geofence');
				}
			}

			this.vehicleData = JSON.parse(JSON.stringify(vehicleData));
		} catch (error) {
			this.log(error.stack);
		}
	}

	async onVehicleState(vehicleState) {
		await super.onVehicleState(vehicleState);

		if (this.vehicleState != vehicleState) {
			this.vehicleState = vehicleState;

			if (vehicleState == 'online') {
				await this.setCapabilityValue('vehicle_state', 'Online');
				this.trigger('vehicle-online');
			} else {
				await this.setCapabilityValue('vehicle_state', 'Offline');
				this.trigger('vehicle-offline');
			}

			this.trigger('vehicle-state-changed');
		}
	}

	async updateCapabilities(vehicleData) {
		await this.setCapabilityValue('inner_temperature', TeslaAPI.getInsideTemperature(vehicleData));
		await this.setCapabilityValue('outer_temperature', TeslaAPI.getOutsideTemperature(vehicleData));
		await this.setCapabilityValue('measure_battery', TeslaAPI.getBatteryLevel(vehicleData));
		await this.setCapabilityValue('battery_range', TeslaAPI.getBatteryRange(vehicleData));
		await this.setCapabilityValue('charging_state', TeslaAPI.getChargingState(vehicleData));
		await this.setCapabilityValue('locked', TeslaAPI.isLocked(vehicleData));
		await this.setCapabilityValue('odometer', TeslaAPI.getOdometer(vehicleData));
		await this.setCapabilityValue('distance_from_homey', this.getDistanceFromHomey(vehicleData));
		await this.setCapabilityValue('vehicle_state', TeslaAPI.getState(vehicleData));
		await this.setCapabilityValue('charge_power', TeslaAPI.getChargePower(vehicleData));
		await this.setCapabilityValue('vehicle_speed', TeslaAPI.getVehicleSpeed(vehicleData));
	}



}

module.exports = MyDevice;
