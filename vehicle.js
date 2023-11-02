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
	constructor({ app, vehicleID }) {
		super();

		this.app = app;
		this.log = app.log;
		this.vehicleID = vehicleID;
		this.debug = app.debug;
		this.vehicleData = null;
        this.vehiceState = 'wtf';

        this.setMaxListeners(20);

	}

	async onUninit() {}

	getAPI() {
		return this.app.api;
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

	async getVehicleState() {
		this.log(`Fetching vehicle state.`);
		let vehicle = await this.getAPI().getVehicle(this.vehicleID);

		if (vehicle && typeof vehicle.state == 'string') {
            // If vehicle state changed - notify
            if (this.vehicleState != vehicle.state) {
                this.vehicleState = vehicle.state;
                this.emit('vehicle_state', this.vehicleState);
            }

            // Freebie?!
			if (vehicle.state == 'online') {
				await this.getVehicleData();
			}

			return this.vehicleState;
		}

		return 'unknown';
	}

	async getVehicleData() {
		this.vehicleData = await this.getAPI().request(this.vehicleID, 'GET', 'vehicle_data');

		if (this.vehicleData && typeof this.vehicleData.state == 'string') {

            // Emit vehicle state if changed
            if (this.vehiceState != this.vehicleData.state) {
                this.vehiceState = this.vehicleData.state;
                this.emit('vehicle_state', this.vehicleState);
            }

		}

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
