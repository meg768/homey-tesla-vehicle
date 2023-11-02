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



		this.addCondition('vehicle-is-near-location', async (args, state) => {
			let { device, latitude, longitude, radius } = args;
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

        this.addAction('defrost-for-a-while', async () => {
            let {device, minutes} = args;
            let timer = this.getTimer('defrost-for-a-while-timer');

            await device.vehicle.setDefrostState(true);
            await device.vehicle.updateVehicleData(2000);

            timer.setTimer(minutes * 60000, async () => {
                await device.vehicle.setDefrostState(false);
                await device.vehicle.updateVehicleData(2000);
            });

        });
        
        this.addAction('hvac-for-a-while', async () => {
            let {device, minutes} = args;
            let timer = this.getTimer('hvac-for-a-while-timer');

            await device.vehicle.setClimateState(true);
            await device.vehicle.updateVehicleData(2000);

            timer.setTimer(minutes * 60000, async () => {
                await device.vehicle.setClimateState(false);
                await device.vehicle.updateVehicleData(2000);
            });

        });

        this.addAction('vehicle-set-location', async (args) => {
            let {device, location} = args;

            this.log(`${JSON.stringify(device.getData())}`);
            await device.setCapabilityValue('vehicle_location', location);

        });

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
