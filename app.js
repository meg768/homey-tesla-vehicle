'use strict';

const Events = require('events');
const Homey = require('homey');
const TeslaAPI = require('./tesla-api.js');
const Vehicle = require('./vehicle.js');
const Timer = require('./timer.js');


class MyApp extends Homey.App {


	async onUninit() {
	}

	async onInit() {
		this.timers = {};
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



		this.addCondition('vehicle-is-near-location');
        this.addCondition('vehicle-is-near-location-with-radius');
		this.addCondition('vehicle-is-charging');
        this.addCondition('vehicle-is-locked');
        this.addCondition('vehicle-is-online');
        this.addCondition('vehicle-is-driving');
        this.addCondition('vehicle-is-at-home');

        this.addAction('vehicle-set-named-location');
		this.addAction('vehicle-wake-up');

        this.addAction('defrost-for-a-while');
        this.addAction('hvac-for-a-while');
        

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

	async trigger(name, args) {
		this.log(`Triggering '${name}' with parameters ${JSON.stringify(args)}`);
		const triggerCard = this.homey.flow.getTriggerCard(name);
		await triggerCard.trigger(args);
	}

	async addAction(name, fn) {
		let action = this.homey.flow.getActionCard(name);

        if (fn == undefined) {
            action.registerRunListener(async (args) => {
                let {device, ...parameters} = args;
                await device.onAction(name, parameters);
            });
    
        }
        else
    		action.registerRunListener(fn);
	}

    async addCondition(name, fn) {
		let condition = this.homey.flow.getConditionCard(name);

        if (fn == undefined) {
            condition.registerRunListener(async (args) => {
                let {device, ...parameters} = args;
                return await device.onCondition(name, parameters);
            });
    
        }
        else {
            condition.registerRunListener(fn);

        }

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
