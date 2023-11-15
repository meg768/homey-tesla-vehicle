'use strict';

const Device = require('../../device');
const TeslaAPI = require('../../tesla-api');

class MyDevice extends Device {
	async onSettings({ oldSettings, changedKeys, newSettings }) {
		await this.pollVehicleState(newSettings.pollInterval);
	}

	async onInit() {
		await super.onInit();

		this.vehicleLocation = '-';

		// Get initial value
		this.vehicleData = JSON.parse(JSON.stringify(this.vehicle.vehicleData));

		this.registerCapabilityListener('location', async (value, options) => {
			return await this.setLocation(value);
		});

        // Only trigger when location is correct
        if (true) {
            let vehicleArrivedAtLocation = this.homey.flow.getDeviceTriggerCard('arrived_at_location');

            vehicleArrivedAtLocation.registerRunListener(async (args, state) => {
                return args.location == state.location;
            });
    
        }

        await this.updateCapabilities(this.vehicle.vehicleData);
		await this.pollVehicleState(this.getSetting('pollInterval'));
	}

	async setLocation(location) {
		if (this.vehicleLocation != location) {
			this.vehicleLocation = location;
			
            let vehicleArrivedAtLocation = this.homey.flow.getDeviceTriggerCard('arrived_at_location');
            let tokens = { location: this.vehicleLocation };
            let state = { location: this.vehicleLocation };

            vehicleArrivedAtLocation.trigger(this, tokens, state);

		}
	}

	async onUninit() {
		await super.onUninit();

		// Turn off timers
		this.setVehicleDataRefreshInterval(0);
		this.pollVehicleState(0);
	}

	async onAction(name, args) {
		switch (name) {
			case 'wake-up': {
				await this.vehicle.getVehicleData();
				break;
			}

			case 'set_location': {
				let { location } = args;
				await this.setCapabilityValue('location', location);
				await this.setLocation(location);
				break;
			}
		}
	}

	async onCondition(name, args) {
		switch (name) {
			case 'is_at_home': {
				return this.isAtHome();
			}
			case 'is_locked': {
				return this.isLocked();
			}
			case 'is_online': {
				return this.isOnline();
			}
			case 'is_charging': {
				return this.isCharging();
			}
			case 'is_near_location': {
				let { latitude, longitude, radius } = args;
				return this.isNearLocation(latitude, longitude, 0.2);
			}
			case 'is_near_location_with_radius': {
				let { latitude, longitude, radius } = args;
				return this.isNearLocation(latitude, longitude, radius);
			}
		}

		return false;
	}

	async pollVehicleState(interval) {
		let timer = this.app.getTimer('VehiclePollTimer');

		let loop = async () => {
			timer.cancel();

			if (interval > 0) {
				try {
					await this.vehicle.poll();
				} catch (error) {
					this.log(`Failed polling vehicle state. ${error.stack}`);
				}

				this.log(`Next vehicle state poll is in ${interval} minute(s).`);
				timer.setTimer(interval * 60000, loop);
			} else {
				this.log(`Polling stopped.`);
			}
		};

		loop();
	}
	async setVehicleDataRefreshInterval(delay = 0) {
		let timer = this.app.getTimer('VehicleDataFetchTimer');

		timer.cancel();

		if (delay > 0) {
			timer.setTimer(delay * 60000, async () => {
				try {
					this.log(`Performing refresh on vehicle data.`);
					await this.vehicle.getVehicleData();
				} catch (error) {
					this.log(`Failed delayed fetching of vehicle data. ${error.stack}`);
				}
			});
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
			if (vehicleData.state == 'online') {
				this.trigger('online');
			} else {
				this.trigger('offline');
			}
		}

		if (this.vehicle.getPosition(this.vehicleData) != this.vehicle.getPosition(vehicleData)) {
			await this.trigger('position_changed');
		}

		if (this.vehicle.isLocked(this.vehicleData) != this.vehicle.isLocked(vehicleData)) {
			if (this.vehicle.isLocked(vehicleData)) {
				await this.trigger('locked');
			} else {
				await this.trigger('unlocked');
			}
		}

		if (this.vehicle.isCharging(this.vehicleData) != this.vehicle.isCharging(vehicleData)) {
			if (this.vehicle.isCharging(vehicleData)) {
				await this.trigger('started_charging');
			} else {
				await this.trigger('stopped_charging');
			}
		}

		if (this.vehicle.isDriving(this.vehicleData) != this.vehicle.isDriving(vehicleData)) {
			if (this.vehicle.isDriving(vehicleData)) {
				await this.trigger('started_driving');
			} else {
				await this.trigger('stopped_driving');
			}
		}

		if (this.vehicle.isAtHome(this.vehicleData) != this.vehicle.isAtHome(vehicleData)) {
			if (this.vehicle.isAtHome(vehicleData)) {
				await this.trigger('inside_geofence');
			} else {
				await this.trigger('outside_geofence');
			}
		}
	}

	async updateCapabilities(vehicleData) {
		function formatNumber(number) {
			if (typeof number != 'number') {
				number = parseFloat(number);
			}
			return new Intl.NumberFormat().format(number);
		}

		await this.setCapabilityValue('measure_battery', this.vehicle.getBatteryLevel(vehicleData));
		await this.setCapabilityValue('measure_inside_temperature', this.vehicle.getInsideTemperature(vehicleData));
		await this.setCapabilityValue('measure_outside_temperature', this.vehicle.getOutsideTemperature(vehicleData));
		await this.setCapabilityValue('measure_speed', this.vehicle.getVehicleSpeed(vehicleData));

		await this.setCapabilityValue('measure_odometer', this.vehicle.getOdometer(vehicleData));

		await this.setCapabilityValue('state', this.vehicle.getLocalizedState(vehicleData));
		await this.setCapabilityValue('charging_state', this.vehicle.getLocalizedChargingState(vehicleData));

		await this.setCapabilityValue('measure_battery_range', this.vehicle.getBatteryRange(vehicleData));
		await this.setCapabilityValue('measure_distance_from_homey', this.vehicle.getDistanceFromHomey(vehicleData));
		await this.setCapabilityValue('measure_charge_power', this.vehicle.getChargePower(vehicleData));
		await this.setCapabilityValue('location', this.vehicleLocation);

		await this.setCapabilityValue('measure_charging_speed', this.vehicle.getChargingSpeed(vehicleData));
                
	}
}

module.exports = MyDevice;
