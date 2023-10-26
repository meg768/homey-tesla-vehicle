'use strict';

const Homey = require('homey');
const TeslaAPI = require('../../tesla-api.js');

class MyDevice extends Homey.Device {
	async onSettings({ oldSettings, changedKeys, newSettings }) {
		this.stopPolling();
		this.startPolling();
	}

	async onUninit() {
		this.stopPolling();

		// Cleanup conditions
		if (this.conditions) {
			this.conditions.forEach((condition) => {
				condition.removeAllListeners();
			});
		}

		// Cleanup actions
		if (this.actions) {
			this.actions.forEach((action) => {
				action.removeAllListeners();
			});
		}

		await this.homey.app.unregisterDevice(this);
	}

	async onInit() {
		this.vehicle = await this.homey.app.registerDevice(this);
		this.debug = this.log;
		this.conditions = [];

		// Get initial value
		this.locked = this.vehicle.vehicleData.vehicle_state.locked;

		// Get initial value
		this.vehicleData = JSON.parse(JSON.stringify(this.vehicle.vehicleData));
		this.vehicleState = 'wtf'; // this.vehicleData.state;

		let getVehicleSpeed = (vehicleData) => {
			if (typeof vehicleData.drive_state.speed == 'number') {
				return vehicleData.drive_state.speed;
			}

			return 0;
		};

		let getChargingSpeed = (vehicleData) => {
			let chargePower = getChargePower(vehicleData);
			let chargingRate = chargePower / 171;
			return Math.round(chargingRate * 10) / 10;
		};

		let getChargePower = (vehicleData) => {
			return Math.round(vehicleData.charge_state.charge_rate * vehicleData.charge_state.charger_voltage);
		};

		let getBatteryRange = (vehicleData) => {
			return Math.round(vehicleData.charge_state.battery_range * 1.609344);
		};

		let getChargingState = (vehicleData) => {
			let text = vehicleData.charge_state.charging_state;

			switch (vehicleData.charge_state.charging_state) {
				case 'Disconnected': {
					text = this.homey.__('DeviceVehicleDisconnected');
					break;
				}
				case 'Charging': {
					text = this.homey.__('DeviceVehicleCharging');
					break;
				}
				case 'Stopped': {
					text = this.homey.__('DeviceVehicleStopped');
					break;
				}
			}

			return text;
		};

		let isDriving = (vehicleData) => {
			if (!vehicleData.drive_state.shift_state) {
				return false;
			}
			return vehicleData.drive_state.shift_state != 'P';
		};

		let isCharging = (vehicleData) => {
			return vehicleData.charge_state.charging_state == 'Charging';
		};

		let getDistanceFromHomey = (vehicleData) => {
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
		};

		let isAtHome = (vehicleData) => {
			return getDistanceFromHomey(vehicleData) < 0.25;
		};

		await this.setCapabilityValue('inner_temperature', this.vehicleData.climate_state.inside_temp);
		await this.setCapabilityValue('outer_temperature', this.vehicleData.climate_state.outside_temp);
		await this.setCapabilityValue('measure_battery', this.vehicleData.charge_state.battery_level);
		await this.setCapabilityValue('battery_range', getBatteryRange(this.vehicleData));
		await this.setCapabilityValue('charging_state', getChargingState(this.vehicleData));
		await this.setCapabilityValue('locked', this.vehicle.vehicleData.vehicle_state.locked);
		await this.setCapabilityValue('odometer', Math.round(this.vehicle.vehicleData.vehicle_state.odometer * 1.609344));
		await this.setCapabilityValue('distance_from_homey', getDistanceFromHomey(this.vehicleData));
		await this.setCapabilityValue('vehicle_state', '-');
		await this.setCapabilityValue('vehicle_speed', 0);
		await this.setCapabilityValue('charge_power', getChargePower(this.vehicleData));
		await this.setCapabilityValue('vehicle_speed', getVehicleSpeed(this.vehicleData));

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
			return isCharging(this.vehicle.vehicleData);
		});

		this.addCondition('vehicle-is-locked', async (args, state) => {
			return this.vehicle.vehicleData.vehicle_state.locked;
		});

		this.addCondition('vehicle-is-online', async (args, state) => {
			return this.vehicleState == 'online';
		});

		this.addCondition('vehicle-is-driving', async (args, state) => {
			return isDriving(this.vehicle.vehicleData);
		});

		this.addCondition('vehicle-is-at-home', async (args, state) => {
			return isAtHome(this.vehicle.vehicleData);
		});

		this.vehicle.on('vehicle_state', async (vehicleState) => {
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
		});

		this.vehicle.on('vehicle_data', async (vehicleData) => {
			try {
				await this.setCapabilityValue('distance_from_homey', getDistanceFromHomey(vehicleData));

				if (this.locked != vehicleData.vehicle_state.locked) {
					this.locked = vehicleData.vehicle_state.locked;
					this.log(`Updating car doors to ${this.locked ? 'LOCKED' : 'UNLOCKED'}.`);
					this.setCapabilityValue('locked', this.locked);
				}

				if (this.vehicleData.climate_state.inside_temp != vehicleData.climate_state.inside_temp) {
					await this.setCapabilityValue('inner_temperature', vehicleData.climate_state.inside_temp);
				}

				if (this.vehicleData.climate_state.outside_temp != vehicleData.climate_state.outside_temp) {
					await this.setCapabilityValue('outer_temperature', vehicleData.climate_state.outside_temp);
				}

				if (this.vehicleData.charge_state.battery_level != vehicleData.charge_state.battery_level) {
					await this.setCapabilityValue('measure_battery', vehicleData.charge_state.battery_level);
				}

				if (getBatteryRange(this.vehicleData) != getBatteryRange(vehicleData)) {
					await this.setCapabilityValue('battery_range', getBatteryRange(vehicleData));
				}

				if (this.vehicleData.vehicle_state.odometer != vehicleData.vehicle_state.odometer) {
					await this.setCapabilityValue('odometer', Math.round(vehicleData.vehicle_state.odometer * 1.609344));
				}

				if (getChargePower(this.vehicleData) != getChargePower(vehicleData)) {
					await this.setCapabilityValue('charge_power', getChargePower(vehicleData));
				}

				if (getVehicleSpeed(this.vehicleData) != getVehicleSpeed(vehicleData)) {
					await this.setCapabilityValue('vehicle_speed', getVehicleSpeed(vehicleData));
				}

				if (getChargingState(this.vehicleData) != getChargingState(vehicleData)) {
					await this.setCapabilityValue('charging_state', getChargingState(vehicleData));
				}

				if (getChargingSpeed(this.vehicleData) != getChargingSpeed(vehicleData)) {
					await this.setCapabilityValue('charging_speed', getChargingSpeed(vehicleData));
				}

				if (isCharging(this.vehicleData) != isCharging(vehicleData)) {
					if (isCharging(vehicleData)) {
						this.log(`Charging started.`);
						await this.trigger('vehicle-charging-started');
					} else {
						this.log(`Charging stopped.`);
						await this.trigger('vehicle-charging-stopped');
					}
				}

				if (isDriving(this.vehicleData) != isDriving(vehicleData)) {
					if (isDriving(vehicleData)) {
						await this.trigger('vehicle-started-driving');
					} else {
						await this.trigger('vehicle-stopped-driving');
					}
				}

				if (isAtHome(this.vehicleData) != isAtHome(vehicleData)) {
					if (isAtHome(vehicleData)) {
						await this.trigger('vehicle-inside-geofence');
					} else {
						await this.trigger('vehicle-outside-geofence');
					}
				}

				this.vehicleData = JSON.parse(JSON.stringify(vehicleData));
			} catch (error) {
				this.log(error);
			}
		});

		this.startPolling();
	}

	stopPolling() {
		if (this.timer) {
			this.debug(`Vehicle polling stopped.`);
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	startPolling() {
		this.debug(`Vehicle polling started.`);

		let loop = async () => {
			if (this.timer) {
				clearTimeout(this.timer);
			}

			this.timer = null;

			try {
				let vehicle = await this.vehicle.getVehicle();
				if (vehicle.state == 'online') {
					await this.vehicle.getVehicleData();
				}
			} catch (error) {
				this.log(`Could not fetch vehicle state. ${error}`);
			}

			let settings = this.getSettings();

			this.log(`Next poll in ${settings.pollInterval} minute(s).`);
			this.timer = setTimeout(loop, settings.pollInterval * 60000);
		};

		loop();
	}

	addCondition(name, fn) {
		let condition = this.homey.flow.getConditionCard(name);
		condition.registerRunListener(fn);

		this.conditions.push(condition);
	}

	async trigger(name, args) {
		if (args) {
			this.log(`Triggering '${name}' with parameters ${JSON.stringify(args)}`);
		} else {
			this.log(`Triggering '${name}'}`);
		}
		const triggerCard = this.homey.flow.getDeviceTriggerCard(name);
		await triggerCard.trigger(this, args);
	}
}

module.exports = MyDevice;
