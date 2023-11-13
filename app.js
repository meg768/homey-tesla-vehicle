'use strict';

const Events = require('events');
const Homey = require('homey');
const TeslaAPI = require('./tesla-api.js');
const Vehicle = require('./vehicle.js');
const Timer = require('./timer.js');

class MyApp extends Homey.App {
	async onUninit() {}

	async onInit() {
		this.timers = {};
		this.api = null;
		this.vehicles = null;
		this.debug = this.log;

		this.homey.on('foo', (key) => {
			this.log(`FOO ${key}`);
		});

		this.homey.settings.on('set', async (key) => {
			if (key == 'token') {
				try {
					this.api = null;
					this.vehicles = null;
					this.log(`Token changed. Creating a new Tesla API.`);
					await this.setToken();
				} catch (error) {
					this.log(`Invalid token. ${error.stack}`);
				}
			}
			this.homey.emit('meg768', { data: 32 });
		});

		try {
			await this.setToken();
		} catch (error) {
			this.log(error.stack);
		}

		this.addAction('log-to-console', async (args) => {
			const { message } = args;
			this.log(message);
		});

		this.addCondition('is_near_location');
		this.addCondition('is_near_location_with_radius');
		this.addCondition('is_charging');
		this.addCondition('is_locked');
		this.addCondition('is_online');
		this.addCondition('is_driving');
		this.addCondition('is_at_home');

		this.addAction('set_location');
		this.addAction('wake_up');
		this.addAction('defrost_for_a_while');
		this.addAction('hvac_for_a_while');
	}

	getTimer(id) {
		let timer = this.timers[id];

		if (timer == undefined) {
			this.timers[id] = new Timer();
		}
		return this.timers[id];
	}

	async registerDevice(device) {
		this.debug(`Registering device ${device.getName()}.`);

		let vehicles = await this.getVehicles();
		let vehicleID = device.getData().id;
		let vehicle = vehicles[vehicleID];

		return vehicle;
	}

	async unregisterDevice(device) {
		this.debug(`Unregistering device ${device.getName()}.`);
	}

	async getAPI() {
		if (!this.api) {
			let token = this.homey.settings.get('token');
			let api = new TeslaAPI({ debug: this.log, log: this.log, token: token });

			this.api = api;
		}

		return this.api;
	}

	async setToken() {
		this.api = null;
		this.vehicles = null;
		await this.getVehicles();
	}

	async getVehicles() {
		if (!this.vehicles) {
			let api = await this.getAPI();
			let vehicles = await api.getVehicles();
			let instances = {};

			for (let vehicle of vehicles) {
				let instance = new Vehicle({ homey: this.homey, api: api, vehicleID: vehicle.id_s });
				let vehicleData = await instance.getVehicleData();

				this.log(JSON.stringify(vehicleData));

				instances[vehicle.id_s] = instance;
			}

			this.vehicles = instances;
		}

		return this.vehicles;
	}

	async getVehicle(vehicleID) {
		let vehicles = await this.getVehicles();
		return vehicles[vehicleID];
	}

	async trigger(name, args) {
		this.log(`Triggering '${name}' with parameters ${JSON.stringify(args)}`);
		const triggerCard = this.homey.flow.getTriggerCard(name);
		await triggerCard.trigger(args);
	}

	async addAction(name, fn) {
		let action = this.homey.flow.getActionCard(name);

		if (fn == undefined) {
			action.registerRunListener(async (args) => {
				let { device, ...parameters } = args;
				await device.onAction(name, parameters);
			});
		} else action.registerRunListener(fn);
	}

	async addCondition(name, fn) {
		let condition = this.homey.flow.getConditionCard(name);

		if (fn == undefined) {
			condition.registerRunListener(async (args) => {
				let { device, ...parameters } = args;
				return await device.onCondition(name, parameters);
			});
		} else {
			condition.registerRunListener(fn);
		}
	}

	async getPairListDevices(description) {
		let token = this.homey.settings.get('token');

		if (!this.api) {
			throw new Error(this.homey.__('NoAPI'));
		}

		let api = await this.getAPI();
		let vehicles = await api.getVehicles();
		let devices = [];

		function getDeviceName(vehicle) {
			let name = vehicles.length == 1 ? 'Tesla' : vehicle.vin;

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
