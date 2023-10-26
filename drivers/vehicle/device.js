'use strict';

const Homey = require('homey');
const TeslaAPI = require('../../tesla-api.js');




class MyDevice extends Homey.Device {
	async onSettings({ oldSettings, changedKeys, newSettings }) {
		if (this.isPolling()) {
			this.startPolling();
		}
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
		this.timer = null;
		this.conditions = [];
		this.actions = [];

		// Get initial value
		this.locked = TeslaAPI.isLocked(this.vehicle.vehicleData);

		// Get initial value
		this.vehicleData = JSON.parse(JSON.stringify(this.vehicle.vehicleData));
		this.vehicleState = 'wtf'; // this.vehicleData.state;


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

		await this.setCapabilityValue('inner_temperature', TeslaAPI.getInsideTemperature(this.vehicle.vehicleData));
		await this.setCapabilityValue('outer_temperature', TeslaAPI.getOutsideTemperature(this.vehicle.vehicleData));
		await this.setCapabilityValue('measure_battery', TeslaAPI.getBatteryLevel(this.vehicle.vehicleData));
		await this.setCapabilityValue('battery_range', TeslaAPI.getBatteryRange(this.vehicle.vehicleData));
		await this.setCapabilityValue('charging_state', TeslaAPI.getChargingState(this.vehicle.vehicleData));
		await this.setCapabilityValue('locked', TeslaAPI.isLocked(this.vehicle.vehicleData));
		await this.setCapabilityValue('odometer', TeslaAPI.getOdometer(this.vehicle.vehicleData));
		await this.setCapabilityValue('distance_from_homey', getDistanceFromHomey(this.vehicle.vehicleData));
		await this.setCapabilityValue('vehicle_state', '-');
		await this.setCapabilityValue('charge_power', TeslaAPI.getChargePower(this.vehicle.vehicleData));
		await this.setCapabilityValue('vehicle_speed', TeslaAPI.getVehicleSpeed(this.vehicle.vehicleData));

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
			return TeslaAPI.isOnline(this.vehicle.vehicleData);
		});

		this.addCondition('vehicle-is-driving', async (args, state) => {
			return TestaAPI.isDriving(this.vehicle.vehicleData);
		});

		this.addCondition('vehicle-is-at-home', async (args, state) => {
			return isAtHome(this.vehicle.vehicleData);
		});

		this.addAction('stop-polling', async (args) => {
			this.stopPolling();
		});

		this.addAction('start-polling', async (args) => {
			let { interval } = args;

			if (!interval) {
				interval = 3;
			}

			let settings = this.getSettings();
			this.setSettings({ ...settings, pollInterval: interval });

			this.log(`Started polling with this ${JSON.stringify(this.getSettings())}`);

			this.startPolling();
		});

		this.addAction('wake-up', async (args) => {
			this.log(`Waking up...`);
			await this.vehicle.getVehicleData();
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
                /*
				if (isCharging(vehicleData)) {
					this.log(`Charging. I will be back soon.`);
					await this.vehicle.updateVehicleData(60000 * 3);
				}
				if (isDriving(vehicleData)) {
					this.log(`Driving. I will be back soon.`);
					await this.vehicle.updateVehicleData(60000 * 1);
				}
                */

				await this.setCapabilityValue('distance_from_homey', getDistanceFromHomey(vehicleData));

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
				}

				if (TeslaAPI.getChargingState(this.vehicleData) != TeslaAPI.getChargingState(vehicleData)) {
					await this.setCapabilityValue('charging_state', TeslaAPI.getChargingState(vehicleData));
				}

				if (TeslaAPI.getChargingSpeed(this.vehicleData) != TeslaAPI.getChargingSpeed(vehicleData)) {
					await this.setCapabilityValue('charging_speed', TeslaAPI.getChargingSpeed(vehicleData));
				}

				if (TeslaAPI.isCharging(this.vehicleData) != TeslaAPI.isCharging(vehicleData)) {
					if (TeslaAPI.isCharging(vehicleData)) {
						this.log(`Charging started.`);
						await this.trigger('vehicle-charging-started');
					} else {
						this.log(`Charging stopped.`);
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

	isPolling() {
		return this.timer ? true : false;
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

				await this.trigger('poll');
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

	addAction(name, fn) {
		let action = this.homey.flow.getActionCard(name);
		action.registerRunListener(fn);

		this.actions.push(action);
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
