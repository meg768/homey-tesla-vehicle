'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

class MyDevice extends Device {
	async onSettings({ oldSettings, changedKeys, newSettings }) {
		await this.pollVehicleState(newSettings.pollInterval);
	}

	async onInit() {
		await super.onInit();

		this.vehicleStateTimer = null;
		this.vehicleDataTimer = null;
		this.vehicleLocation = '-';

		// Get initial value
		this.vehicleData = JSON.parse(JSON.stringify(this.vehicle.vehicleData));
		this.vehicleState = 'xxx';

		await this.updateCapabilities(this.vehicle.vehicleData);

		await this.pollVehicleState(this.getSetting('pollInterval'));
	}

	async onUninit() {
		await super.onUninit();

		// Turn off timers
		this.setVehicleDataRefreshInterval(0);
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
			} else {
				this.log(`Polling stopped.`);
			}
		};

		loop();
	}

	async onAction(name, args) {
		switch (name) {
			case 'vehicle-wake-up': {
				await this.vehicle.getVehicleData();
				break;
			}

			case 'vehicle-set-location': {
				let { location } = args;

				let setLocation = async (location) => {
					await this.setCapabilityValue('vehicle_location', location);

					if (this.vehicleLocation != location) {
						this.vehicleLocation = location;
						this.trigger('vehicle-location-changed');
					}
				};

				await setLocation(location);

				/*

				let timer = this.app.getTimer('vehicle-set-location');

				timer.setTimer(60 * 60000, async () => {
 					if (this.isAtHome()) {
						location = 'Hemma';
					} else {
						location = '-';
					}

                    await setLocation(location);
                
                });

                */

				break;
			}
		}
	}

	async onCondition(name, args) {
		switch (name) {
			case 'vehicle-is-at-home': {
				return this.isAtHome();
			}
			case 'vehicle-is-locked': {
				return this.isLocked();
			}
			case 'vehicle-is-online': {
				return this.isOnline();
			}
			case 'vehicle-is-charging': {
				return this.isCharging();
			}
			case 'vehicle-is-near-location': {
				let { latitude, longitude, radius } = args;
				return this.isNearLocation(latitude, longitude, 0.2);
			}
			case 'vehicle-is-near-location-with-radius': {
				let { latitude, longitude, radius } = args;
				return this.isNearLocation(latitude, longitude, radius);
			}
		}

		return false;
	}

	async setVehicleDataRefreshInterval(delay = 0) {
		if (this.vehicleDataTimer) {
			clearTimeout(this.vehicleDataTimer);
			this.vehicleDataTimer = null;
		}

		if (delay > 0) {
			this.vehicleDataTimer = setTimeout(async () => {
				try {
					this.log(`Performing refresh on vehicle data.`);
					await this.vehicle.getVehicleData();
				} catch (error) {
					this.log(`Failed delayed fetching of vehicle data. ${error.stack}`);
				}
			}, delay * 60000);
		}
	}

	async wakeUp() {
		this.log(`Waking up...`);
		await this.vehicle.getVehicleData();
	}

	isNearLocation(latitude, longitude, radius) {
		let distance = this.getDistanceFromLocation(this.vehicle.vehicleData, latitude, longitude);
		return distance < radius;
	}

	isAtHome() {
		return this.isHome(this.vehicle.vehicleData);
	}

	isLocked() {
		return TeslaAPI.isLocked(this.vehicle.vehicleData);
	}

	isOnline() {
		return this.vehicleState == 'online';
	}

	isCharging() {
		return TeslaAPI.isCharging(this.vehicle.vehicleData);
	}

	isDriving() {
		return TestaAPI.isDriving(this.vehicle.vehicleData);
	}

	isHome(vehicleData) {
		return this.getDistanceFromHomey(vehicleData) < 0.2;
	}

	getDistanceFromLocation(vehicleData, latitude, longitude) {
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
		let homeyLatitude = latitude;
		let homeyLongitude = longitude;
		let vehicleLatitude = vehicleData.drive_state.latitude;
		let vehicleLongitude = vehicleData.drive_state.longitude;

		if (homeyLatitude && homeyLongitude && vehicleLatitude && vehicleLongitude) {
			distance = getDistanceFromLatLonInKm(homeyLatitude, homeyLongitude, vehicleLatitude, vehicleLongitude);
		}

		return Math.round(distance * 10) / 10;
	}

	getDistanceFromHomey(vehicleData) {
		let latitude = this.homey.geolocation.getLatitude();
		let longitude = this.homey.geolocation.getLongitude();
		return this.getDistanceFromLocation(vehicleData, latitude, longitude);
	}

	getPosition(vehicleData) {
		return `${vehicleData.drive_state.latitude}, ${vehicleData.drive_state.longitude}`;
	}

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			// Clear delayed fetch
			this.setVehicleDataRefreshInterval(0);

			if (TeslaAPI.isCharging(vehicleData)) {
				this.setVehicleDataRefreshInterval(5);
			}

			if (TeslaAPI.isDriving(vehicleData)) {
				this.setVehicleDataRefreshInterval(1);
			}

			await this.updateCapabilities(vehicleData);
			await this.updateTriggers(vehicleData);

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

	async updateTriggers(vehicleData) {
		if (this.getPosition(this.vehicleData) != this.getPosition(vehicleData)) {
			await this.trigger('vehicle-position-changed');
		}
		if (TeslaAPI.isLocked(this.vehicleData) != TeslaAPI.isLocked(vehicleData)) {
			if (TeslaAPI.isLocked(vehicleData)) {
				await this.trigger('vehicle-locked');
			} else {
				await this.trigger('vehicle-unlocked');
			}
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

		if (this.isHome(this.vehicleData) != this.isHome(vehicleData)) {
			if (this.isHome(vehicleData)) {
				await this.trigger('vehicle-inside-geofence');
			} else {
				await this.trigger('vehicle-outside-geofence');
			}
		}

		if (TeslaAPI.getVehicleSpeed(this.vehicleData) != TeslaAPI.getVehicleSpeed(vehicleData)) {
			await this.trigger('vehicle-speed-changed');
		}

		if (TeslaAPI.getInsideTemperature(this.vehicleData) != TeslaAPI.getInsideTemperature(vehicleData)) {
			this.log(`Inner temperature is now ${TeslaAPI.getInsideTemperature(vehicleData)}`);
			await this.trigger('vehicle-inside-temperature-changed');
		}
		if (TeslaAPI.getOutsideTemperature(this.vehicleData) != TeslaAPI.getOutsideTemperature(vehicleData)) {
			this.log(`Outer temperature is now ${TeslaAPI.getOutsideTemperature(vehicleData)}`);
			await this.trigger('vehicle-outside-temperature-changed');
		}
	}

	getOdometer(vehicleData) {
		let odometer = TeslaAPI.getOdometer(vehicleData);
	}

	getVehicleState(vehicleData) {
		switch (vehicleData.state) {
			case 'online': {
				return 'Online';
			}
		}

		return 'Offline';
	}

	getChargingState(vehicleData) {
		switch (vehicleData.charge_state.charging_state) {
			case 'Disconnected': {
				return 'Urkopplad';
			}
			case 'Connected': {
				return 'Laddar';
			}
		}

		return vehicleData.charge_state.charging_state;
	}

	getChargePower(vehicleData) {
		return Math.round(vehicleData.charge_state.charge_rate * vehicleData.charge_state.charger_voltage);
	}

	getBatteryRange(vehicleData) {
		return Math.round(vehicleData.charge_state.battery_range * 1.609344);
	}

	getOdometer(vehicleData) {
		return Math.round(vehicleData.vehicle_state.odometer * 1.609344);
	}

	getVehicleSpeed(vehicleData) {
		if (typeof vehicleData.drive_state.speed == 'number') {
			return Math.round(vehicleData.drive_state.speed * 1.609344);
		}

		return 0;
	}
	getInsideTemperature(vehicleData) {
		return vehicleData.climate_state.inside_temp;
	}

	getOutsideTemperature(vehicleData) {
		return vehicleData.climate_state.outside_temp;
	}

	async updateCapabilities(vehicleData) {
		function formatNumber(number) {
			if (typeof number != 'number') {
				number = parseFloat(number);
			}
			return new Intl.NumberFormat().format(number);
		}

		await this.setCapabilityValue('measure_battery', TeslaAPI.getBatteryLevel(vehicleData));

		await this.setCapabilityValue('vehicle_inside_temperature', this.getInsideTemperature(vehicleData));
		await this.setCapabilityValue('vehicle_outside_temperature', this.getOutsideTemperature(vehicleData));
		await this.setCapabilityValue('vehicle_battery_range', this.getBatteryRange(vehicleData));
		await this.setCapabilityValue('vehicle_charging_state', this.getChargingState(vehicleData));
		await this.setCapabilityValue('vehicle_odometer', this.getOdometer(vehicleData));
		await this.setCapabilityValue('vehicle_distance_from_homey', this.getDistanceFromHomey(vehicleData));
		await this.setCapabilityValue('vehicle_state', this.getVehicleState(vehicleData));
		await this.setCapabilityValue('vehicle_charge_power', this.getChargePower(vehicleData));
		await this.setCapabilityValue('vehicle_speed', this.getVehicleSpeed(vehicleData));
		await this.setCapabilityValue('vehicle_location', this.vehicleLocation);
	}
}

module.exports = MyDevice;
