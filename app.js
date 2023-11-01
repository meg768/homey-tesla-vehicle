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

class MyApp extends Homey.App {
	async registerDevice(device) {
		this.debug(`Registering device ${device.getName()}.`);

		let vehicleID = device.getData().id;
		let vehicle = this.vehicles[vehicleID];

		return vehicle;
	}

	async unregisterDevice(device) {
		this.debug(`Unregistering device ${device.getName()}.`);
	}

	async initializeVehicles(token) {
		let api = new TeslaAPI({ debug: this.log, log: this.log, token: token });
		this.api = api;

		if (this.vehicles == null) {
			let vehicles = await api.getVehicles();
			let instances = {};

			for (let vehicle of vehicles) {
				let instance = new Vehicle({ app: this, vehicleID: vehicle.id_s });

				await instance.getVehicleState();
				let vehicleData = await instance.getVehicleData();

				this.log(JSON.stringify(vehicleData));

				instances[vehicle.id_s] = instance;
			}

			this.vehicles = instances;
		}
	}

	getConfig() {
		let config = this.homey.settings.get('config');

		if (typeof config != 'object') {
			config = {};
		}

		return config;
	}

	saveConfig(config) {
		this.homey.settings.set('config', config);
	}

	async onUninit() {
	}

	async onInit() {
		this.timer = null;
		this.api = null;
		this.vehicles = null;
		this.debug = this.log;

		let config = this.getConfig();

		if (config && config.refreshToken && config.refreshToken != '') {
			try {
				await this.initializeVehicles(config.refreshToken);
			} catch (error) {
				this.log(`Invalid refresh token. ${error.stack}`);
			}
		}

		this.addAction('log-to-console', async (args) => {
			const { message } = args;
			this.log(message);
		});



		this.addCondition('vehicle-is-near-location', async (args, state) => {
			let { device, latitude, longitude } = args;
            return device.isNearLocation(latitude, longitude, 0.2);
		});

        this.addCondition('vehicle-is-near-location-with-radius', async (args, state) => {
			let { device, latitude, longitude, radius } = args;
            return device.isNearLocation(latitude, longitude, radius);
		});

		this.addCondition('vehicle-is-charging', async (args, state) => {
            let {device} = args;
            return device.isCharging();
		});

		this.addCondition('vehicle-is-locked', async (args, state) => {
            let {device} = args;
            return device.isLocked();
		});

		this.addCondition('vehicle-is-online', async (args, state) => {
            let {device} = args;
            return device.isOnline();
		});

		this.addCondition('vehicle-is-driving', async (args, state) => {
            let {device} = args;
            return device.isDriving();
			
		});

		this.addCondition('vehicle-is-at-home', async (args, state) => {
            let {device} = args;
            return device.isAtHome();
		});


		this.addAction('wake-up', async (args) => {
            let {device} = args;
			await device.wakeUp();
		});



        
	}

	async trigger(name, args) {
		this.log(`Triggering '${name}' with parameters ${JSON.stringify(args)}`);
		const triggerCard = this.homey.flow.getTriggerCard(name);
		await triggerCard.trigger(args);
	}

	async addAction(name, fn) {
		let action = this.homey.flow.getActionCard(name);
		action.registerRunListener(fn);
	}

    async addCondition(name, fn) {
		let condition = this.homey.flow.getConditionCard(name);
		condition.registerRunListener(fn);

	}

	async getPairListDevices(description) {
		if (!this.api) {
			throw new Error(this.homey.__('NoAPI'));
			return [];
		}

		let vehicles = await this.api.getVehicles();
		let devices = [];

		function getDeviceName(vehicle) {
			let name = vehicle.vin;

			if (typeof vehicle.display_name == 'string' && vehicle.display_name != '') {
				name = vehicle.display_name;
			}

			return name;
		}

		vehicles.forEach((vehicle) => {
			let device = {};

			device.data = { id: vehicle.id_s };

			if (description == undefined) {
				device.name = getDeviceName(vehicle);
			} else {
				if (vehicles.length == 1) {
					device.name = description;
				} else {
					device.name = `${description + getDeviceName(vehicle)}`;
				}
			}

			devices.push(device);
		});

		return devices;
	}
}

module.exports = MyApp;
