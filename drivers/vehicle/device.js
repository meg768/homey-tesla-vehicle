'use strict';

const Device = require('../../src/device');
let Request = require('../../src/request');

class MyDevice extends Device {
	async onSettings({ oldSettings, changedKeys, newSettings }) {
		await this.pollVehicleState(newSettings.pollInterval);
	}

	async onInit() {
		await super.onInit();

		// Get initial value
		this.vehicleData = JSON.parse(JSON.stringify(this.vehicle.vehicleData));
		this.vehicleLocation = '-';

		this.registerCapabilityListener('locked', async (value, options) => {
			try {
				let locked = value ? true : false;

				if (this.vehicle.isLocked() != locked) {
					this.log(`Setting lock state to ${locked ? 'LOCKED' : 'UNLOCKED'}.`);

					if (locked) {
						await this.vehicle.post('command/door_lock');
					} else {
						await this.vehicle.post('command/door_unlock');

						let remoteStartDrivePassword = this.getSetting('remoteStartDrivePassword');

						if (typeof remoteStartDrivePassword == 'string' && remoteStartDrivePassword != '') {
							await this.vehicle.post(`command/remote_start_drive?password=${remoteStartDrivePassword}`);
						}
					}

					await this.vehicle.updateVehicleData(2000);
				}
			} catch (error) {
				this.log(error.stack);
			}
		});

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

	async lookupPosition(latitude, longitude) {
		try {
			let request = new Request('https://nominatim.openstreetmap.org');

			let query = {
				lat: latitude,
				lon: longitude,
				format: 'geocodejson',
			};

			let headers = {
				'user-agent': `what-ever/${Math.round(Math.random() * 100)}`,
			};

			let response = await request.get('reverse', { headers: headers, query: query });
			let geocode = response.body.features[0].properties.geocoding;

			if (geocode.name && geocode.city) {
				return `${geocode.name}, ${geocode.city}`;
			}

			if (geocode.housenumber && geocode.city && geocode.street) {
				return `${geocode.street} ${geocode.housenumber}, ${geocode.city}`;
			}

			if (geocode.housenumber && geocode.city) {
				return `${geocode.housenumber} ${geocode.city}`;
			}
			if (geocode.street && geocode.city) {
				return `${geocode.street}, ${geocode.city}`;
			}
			if (geocode.district && geocode.city) {
				return `${geocode.district}, ${geocode.city}`;
			}

			console.log(JSON.stringify(geocode, null, '  '));
			return '-';
		} catch (error) {
			console.log(error.stack);
			return '-';
		}
	}

	async onAction(name, args) {
		switch (name) {
			case 'wake_up': {
				await this.vehicle.getVehicleData();
				break;
			}

			case 'set_location': {
				let { location } = args;
				await this.setCapabilityValue('location', location);
				await this.setLocation(location);
				break;
			}

			case 'update_location': {
				let latitude = this.vehicle.getLatitude();
				let longitude = this.vehicle.getLongitude();
				let location = await this.lookupPosition(latitude, longitude);
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
			case 'is_near_position': {
				let { latitude, longitude, radius } = args;
				let distance = this.vehicle.getDistanceFromLocation(this.vehicleData, latitude, longitude);
				return distance <= radius;
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
		} catch (error) {
			this.log(error.stack);
		}

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
			/*
            let triggerCard = this.homey.flow.getDeviceTriggerCard('near_position_within_radius');

            triggerCard.registerRunListener( async (args, state) => {
                let distance = this.vehicle.getDistanceFromLocation(args.latitude, args.longitude, state.latitude, state.longitude);
                return distance <= state.radius;
            });

            let state = {};
            state.latiude = vehicleData.latyitede;
            state.longitude = vehicleData.longitude;
            state.radius = 
            await triggerCard.trigger(this, {}, state);
*/
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
		await this.setCapabilityValue('locked', this.vehicle.isLocked(vehicleData));

		await this.setCapabilityValue('battery', this.vehicle.getBatteryLevel(vehicleData));
		await this.setCapabilityValue('inside_temperature', this.vehicle.getInsideTemperature(vehicleData));
		await this.setCapabilityValue('outside_temperature', this.vehicle.getOutsideTemperature(vehicleData));
		await this.setCapabilityValue('speed', this.vehicle.getVehicleSpeed(vehicleData));
		await this.setCapabilityValue('battery_range', this.vehicle.getBatteryRange(vehicleData));
		await this.setCapabilityValue('distance_from_home', this.vehicle.getDistanceFromHomey(vehicleData));
		await this.setCapabilityValue('odometer', this.vehicle.getOdometer(vehicleData));

		await this.setCapabilityValue('vehicle_state', this.vehicle.getLocalizedState(vehicleData));

		await this.setCapabilityValue('location', this.vehicleLocation);

		await this.setCapabilityValue('charging_power', this.vehicle.getChargePower(vehicleData));
		await this.setCapabilityValue('charging_state', this.vehicle.getLocalizedChargingState(vehicleData));
		await this.setCapabilityValue('charging_speed', this.vehicle.getChargingSpeed(vehicleData));

		await this.setCapabilityValue('latitude', this.vehicle.getLatitude(vehicleData));
		await this.setCapabilityValue('longitude', this.vehicle.getLongitude(vehicleData));
	}
}

module.exports = MyDevice;
