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
					await this.vehicle.poll();
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

	async onVehicleData(vehicleData) {
		await super.onVehicleData(vehicleData);

		try {
			// Clear delayed fetch
			this.setVehicleDataRefreshInterval(0);

			if (this.vehicle.isCharging(vehicleData)) {
				this.setVehicleDataRefreshInterval(5);
			}

			if (this.vehicle.isDriving(vehicleData)) {
				this.setVehicleDataRefreshInterval(1);
			}

			await this.updateCapabilities(vehicleData);
			await this.updateTriggers(vehicleData);

			this.vehicleData = JSON.parse(JSON.stringify(vehicleData));
		} catch (error) {
			this.log(error.stack);
		}
	}

    

	async updateTriggers(vehicleData) {
		if (this.vehicleData.state != vehicleData.state) {
			this.trigger('vehicle-state-changed');

			if (vehicleData.state == 'online') {
				this.trigger('vehicle-online');
			} else {
				this.trigger('vehicle-offline');
			}
		}

		if (this.vehicle.getPosition(this.vehicleData) != this.vehicle.getPosition(vehicleData)) {
			await this.trigger('vehicle-position-changed');
		}

		if (this.vehicle.isLocked(this.vehicleData) != this.vehicle.isLocked(vehicleData)) {
			if (this.vehicle.isLocked(vehicleData)) {
				await this.trigger('vehicle-locked');
			} else {
				await this.trigger('vehicle-unlocked');
			}
		}

		if (this.vehicle.isCharging(this.vehicleData) != this.vehicle.isCharging(vehicleData)) {
			if (this.vehicle.isCharging(vehicleData)) {
				await this.trigger('vehicle-charging-started');
			} else {
				await this.trigger('vehicle-charging-stopped');
			}
		}

		if (this.vehicle.isDriving(this.vehicleData) != this.vehicle.isDriving(vehicleData)) {
			this.log(`Vehicle driving state is ${this.vehicle.isDriving(vehicleData) ? 'TRUE' : 'FALSE'}`);
			if (this.vehicle.isDriving(vehicleData)) {
				await this.trigger('vehicle-started-driving');
			} else {
				await this.trigger('vehicle-stopped-driving');
			}
		}

		if (this.vehicle.isAtHome(this.vehicleData) != this.vehicle.isAtHome(vehicleData)) {
			if (this.vehicle.isAtHome(vehicleData)) {
				await this.trigger('vehicle-inside-geofence');
			} else {
				await this.trigger('vehicle-outside-geofence');
			}
		}

		if (this.vehicle.getVehicleSpeed(this.vehicleData) != this.vehicle.getVehicleSpeed(vehicleData)) {
			this.log(`Vehicle speed is now ${this.vehicle.getVehicleSpeed(vehicleData)}`);
			await this.trigger('vehicle-speed-changed');
		}

		if (this.vehicle.getInsideTemperature(this.vehicleData) != this.vehicle.getInsideTemperature(vehicleData)) {
			this.log(`Inside temperature is now ${this.vehicle.getInsideTemperature(vehicleData)}`);
			await this.trigger('vehicle-inside-temperature-changed');
		}
		if (this.vehicle.getOutsideTemperature(this.vehicleData) != this.vehicle.getOutsideTemperature(vehicleData)) {
			this.log(`Outside temperature is now ${this.vehicle.getOutsideTemperature(vehicleData)}`);
			await this.trigger('vehicle-outside-temperature-changed');
		}
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

	async updateCapabilities(vehicleData) {
		function formatNumber(number) {
			if (typeof number != 'number') {
				number = parseFloat(number);
			}
			return new Intl.NumberFormat().format(number);
		}

		await this.setCapabilityValue('measure_battery', this.vehicle.getBatteryLevel(vehicleData));
		await this.setCapabilityValue('vehicle_inside_temperature', this.vehicle.getInsideTemperature(vehicleData));
		await this.setCapabilityValue('vehicle_outside_temperature', this.vehicle.getOutsideTemperature(vehicleData));
		await this.setCapabilityValue('vehicle_battery_range', this.vehicle.getBatteryRange(vehicleData));
		await this.setCapabilityValue('vehicle_charging_state', this.vehicle.getChargingState(vehicleData));
		await this.setCapabilityValue('vehicle_odometer', this.vehicle.getOdometer(vehicleData));
		await this.setCapabilityValue('vehicle_distance_from_homey', this.vehicle.getDistanceFromHomey(vehicleData));
		await this.setCapabilityValue('vehicle_state', this.vehicle.getState(vehicleData));
		await this.setCapabilityValue('vehicle_charge_power', this.vehicle.getChargePower(vehicleData));
		await this.setCapabilityValue('vehicle_speed', this.vehicle.getVehicleSpeed(vehicleData));


        await this.setCapabilityValue('vehicle_location', this.vehicleLocation);
	}
}

module.exports = MyDevice;
