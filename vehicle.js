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
		this.log(`Fetching vehicle state.`);

		let vehicle = await this.getAPI().getVehicle(this.vehicleID);

		if (vehicle && typeof vehicle.state == 'string') {
            this.vehicleData.state = vehicle.state;
            this.log(`Vehicle is ${this.vehicleData.state}`);

            // Freebie?!
			if (vehicle.state == 'online') {
				await this.getVehicleData();
			}
            else {
                // Emit the data
                this.emit('vehicle_data', this.vehicleData);

            }

		}

        return this.vehiceData;

	}

	async getVehicleData() {
		this.vehicleData = await this.getAPI().request(this.vehicleID, 'GET', 'vehicle_data');

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
}


module.exports = Vehicle;
