'use strict';

const Events = require('events');
const Homey = require('homey');
const TeslaAPI = require('./tesla-api.js');

/*
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
	}

	async onUninit() {


    }



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

	async getVehicle() {
		this.log(`Fetching vehicle state.`);
		let vehicle = await this.getAPI().getVehicle(this.vehicleID);

		if (vehicle && typeof vehicle.state == 'string') {
			this.emit('vehicle_state', vehicle.state);
		}

		return vehicle;
	}

	async getVehicleData() {
		this.vehicleData = await this.getAPI().request(this.vehicleID, 'GET', 'vehicle_data');

		this.emit('vehicle_data', this.vehicleData);

		if (this.vehicleData && typeof this.vehicleData.state == 'string') {
			this.emit('vehicle_state', this.vehicleData.state);
		}

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
				this.log(error);
			}
		}, delay);
	}

	/*
		this.debug('----------------------------');
		this.debug(JSON.stringify(this.vehicleData));
		this.debug('----------------------------');
        */
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
                
                await instance.getVehicle();
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
		// Cleanup conditions
		if (this.conditions) {
			this.conditions.forEach((condition) => {
				condition.removeAllListeners();
			});
		}

		// Cleanup actions
		if (this.actions) {
			this.actions.forEach((action) => {
				action.removeAllListeners();
			});
		}

    }
	async onInit() {
		this.timer = null;
		this.api = null;
		this.vehicles = null;
		this.debug = this.log;
        this.conditions = [];
        this.actions = [];

		let config = this.getConfig();

		if (config && config.refreshToken && config.refreshToken != '') {
            try {
                await this.initializeVehicles(config.refreshToken);
            } catch (error) {
                this.log(`Invalid refresh token. ${error}`);
            }
		}

		this.addAction('log-to-console', async (args) => {
			const { message } = args;
			this.log(message);
		});

	}

	async trigger(name, args) {
		this.log(`Triggering '${name}' with parameters ${JSON.stringify(args)}`);
		const triggerCard = this.homey.flow.getTriggerCard(name);
		await triggerCard.trigger(args);
	}

	addAction(name, fn) {
		let action = this.homey.flow.getActionCard(name);
		action.registerRunListener(fn);
        this.actions.push(action);
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
