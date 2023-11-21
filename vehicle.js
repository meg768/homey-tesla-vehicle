'use strict';

const Events = require('events');
const Homey = require('homey');
const TeslaAPI = require('./tesla-api.js');

/*


Hemma, 55.70775364493117, 13.196651572960741
https://www.svgrepo.com/svg/114988/turn-off?edit=true
https://thenounproject.com/browse/icons/term/car-trunk/
*/
class Vehicle extends Events {
	constructor({ homey, api, vehicleID }) {
		super();

		this.api = api;
		this.homey = homey;
		this.log = this.homey.app.log;
		this.debug = this.homey.app.log;
		this.vehicleID = vehicleID;
		this.vehicleData = null;

		this.setMaxListeners(20);
	}

	async onUninit() {}

	getAPI() {
		return this.api;
	}

	async request(method, command, options) {
		return await this.getAPI().request(this.vehicleID, method, command, options);
	}

	async post(command, payload) {
		return await this.request('POST', command, { body: payload });
	}

	async get(command, options) {
		return await this.request('GET', command, options);
	}

	async setClimateState(state) {
		this.log(`Setting HVAC state to ${state ? 'ON' : 'OFF'}.`);

		if (state) {
			await this.post('command/auto_conditioning_start');
		} else {
			await this.post('command/auto_conditioning_stop');
		}
	}

	async setDefrostState(state) {
		this.log(`Setting defrost state to ${state ? 'ON' : 'OFF'}.`);
		await this.post('command/set_preconditioning_max', { on: state });
	}

	async setPreconditioningMaxState(state) {
		this.log(`Setting preconditioning state to ${state ? 'ON' : 'OFF'}.`);
		await this.post('command/set_preconditioning_max', { on: state });
	}

	async actuateFrunk() {
		this.log(`Actuating frunk.`);
		await this.post('command/actuate_trunk', { which_trunk: 'front' });
	}

	async actuateTrunk() {
		this.log(`Actuating trunk.`);
		await this.post('command/actuate_trunk', { which_trunk: 'rear' });
	}

	async setSteeringWheelHeaterState(state) {
		this.log(`Setting steering wheel heater state to ${state ? 'ON' : 'OFF'}.`);
		await this.post('command/remote_steering_wheel_heater_request', { on: state });
	}

	async setVentilationState(state) {
		this.log(`Setting ventilation state to ${state ? 'ON' : 'OFF'}`);

		var payload = {};
		payload.command = state ? 'vent' : 'close';
		payload.lat = 0;
		payload.lon = 0;

		if (payload.command == 'close') {
			let vehicleData = await this.getVehicleData();
			payload.lat = vehicleData.drive_state.latitude;
			payload.lon = vehicleData.drive_state.longitude;
		}

		await this.post('command/window_control', payload);
	}

	async setSteeringWheelHeaterState(state) {
		this.log(`Setting steering wheel heater state to ${state ? 'ON' : 'OFF'}.`);
		await this.post('command/remote_steering_wheel_heater_request', { on: state });
	}

	async poll() {
		let vehicle = await this.getAPI().getVehicle(this.vehicleID);

		if (vehicle && typeof vehicle.state == 'string') {
			this.vehicleData.state = vehicle.state;
			this.log(`Vehicle is ${this.vehicleData.state}`);

			// Freebie?!
			if (vehicle.state == 'online') {
				await this.getVehicleData();
			} else {
				// Emit the data
				this.emit('vehicle_data', this.vehicleData);
			}
		}

		return this.vehiceData;
	}

	async getVehicleData() {
        this.log(`Fetching vehicle data.`);

        let query = {};
        query.endpoints = 'location_data;charge_state;vehicle_state;climate_state';

		this.vehicleData = await this.getAPI().request(this.vehicleID, 'GET', 'vehicle_data', {query:query});

		// Emit the data
		this.emit('vehicle_data', this.vehicleData);

		return this.vehicleData;
	}

	async updateVehicleData(delay = 1000) {
		if (this.timer) {
			clearTimeout(this.timer);
		}

		this.timer = setTimeout(async () => {
			try {
				await this.getVehicleData();
			} catch (error) {
				this.log(error.stack);
			}
		}, delay);
	}

	getVehicleSpeed(vehicleData = this.vehicleData) {
		if (typeof vehicleData.drive_state.speed == 'number') {
			return Math.round(vehicleData.drive_state.speed * 1.609344);
		}

		return 0;
	}

	getOdometer(vehicleData = this.vehicleData) {
		return Math.round(vehicleData.vehicle_state.odometer * 1.609344);
	}

	getChargingState(vehicleData = this.vehicleData) {
		return vehicleData.charge_state.charging_state;
	}

	getLocalizedChargingState(vehicleData) {
		let state = this.getChargingState();

		switch (state) {
			case 'Disconnected': {
				return 'Inte ansluten';
			}
			case 'Connected': {
				return 'Ansluten';
			}
			case 'Charging': {
				return 'Laddar';
			}
			case 'Stopped': {
				return 'Stoppad';
			}
			case 'Complete': {
				return 'Klart';
			}
		}

		return state;
	}

	getBatteryLevel(vehicleData = this.vehicleData) {
		return vehicleData.charge_state.battery_level;
	}

	getInsideTemperature(vehicleData = this.vehicleData) {
		return vehicleData.climate_state.inside_temp;
	}

	getOutsideTemperature(vehicleData = this.vehicleData) {
		return vehicleData.climate_state.outside_temp;
	}

	isLocked(vehicleData = this.vehicleData) {
		return vehicleData.vehicle_state.locked ? true : false;
	}

	isOnline(vehicleData = this.vehicleData) {
		return vehicleData.state == 'online';
	}

	isCharging(vehicleData = this.vehicleData) {
		return vehicleData.charge_state.charging_state == 'Charging';
	}

	isDriving(vehicleData = this.vehicleData) {
		if (!vehicleData.drive_state.shift_state) {
			return false;
		}
		return vehicleData.drive_state.shift_state != 'P';
	}

	getChargePower(vehicleData = this.vehicleData) {
		let W = vehicleData.charge_state.charger_actual_current * vehicleData.charge_state.charger_voltage;
		let kW = W / 1000;
		return Math.round(kW * 10) / 10;
	}

	getBatteryRange(vehicleData = this.vehicleData) {
		return Math.round(vehicleData.charge_state.battery_range * 1.609344);
	}

	isClimateOn(vehicleData = this.vehicleData) {
		return vehicleData.climate_state.is_climate_on ? true : false;
	}

	isSteeringWheelHeaterOn(vehicleData = this.vehicleData) {
		return vehicleData.climate_state.steering_wheel_heater ? true : false;
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

	getPosition(vehicleData = this.vehicleData) {
		return `${vehicleData.drive_state.latitude}, ${vehicleData.drive_state.longitude}`;
	}

	isAtHome(vehicleData = this.vehicleData) {
		return this.getDistanceFromHomey(vehicleData) < 0.2;
	}

	getDistanceFromHomey(vehicleData = this.vehicleData) {
		let latitude = this.homey.geolocation.getLatitude();
		let longitude = this.homey.geolocation.getLongitude();
		return this.getDistanceFromLocation(vehicleData, latitude, longitude);
	}

	getChargingSpeed(vehicleData = this.vehicleData) {
		// kW
		let chargePower = (vehicleData.charge_state.charger_actual_current * vehicleData.charge_state.charger_voltage) / 1000;

		let factor = 0;

		// Battery range in miles (mi)
		factor = vehicleData.charge_state.est_battery_range;

		// mi -> km
		factor = factor * 1.609344;

		// Battery range at 100% (km)
		factor = factor / (vehicleData.charge_state.battery_level / 100);

		// 75 kWh/km
		factor = 75 / factor;

		return Math.round(chargePower / factor);
	}

	isTrunkOpen(vehicleData = this.vehicleData) {
		return vehicleData.vehicle_state.rt != 0;
	}

	isFrunkOpen(vehicleData = this.vehicleData) {
		return vehicleData.vehicle_state.ft != 0;
	}

	isDefrosting(vehicleData = this.vehicleData) {
		return vehicleData.climate_state.defrost_mode != 0;
	}

	isAnyWindowOpen(vehicleData = this.vehicleData) {
		if (vehicleData.vehicle_state.fd_window) {
			return true;
		}

		return false;

		if (vehicleData.vehicle_state.rd_window) {
			return true;
		}

		if (vehicleData.vehicle_state.fp_window) {
			return true;
		}

		if (vehicleData.vehicle_state.rp_window) {
			return true;
		}

		return false;
	}

	getState(vehicleData = this.vehicleData) {
		return vehicleData.state;
	}

	getLocalizedState(vehicleData) {
		let state = this.getState();

		switch (state) {
			case 'online': {
				return 'Online';
			}
		}

		return 'Offline';
	}
}

module.exports = Vehicle;
