'use strict';
const Homey = require('homey');


module.exports = class extends Homey.Device {


    async onVehicleData(vehicleData) {
    }

    async onVehicleState(vehicleState) {
    }

	async onInit() {
        
		this.conditions = [];
		this.actions = [];
        this.debug = this.log;
        this.vehicle = await this.homey.app.registerDevice(this);

		this.vehicle.on('vehicle_data', async (vehicleData) => {
            await this.onVehicleData(vehicleData);
		});

		this.vehicle.on('vehicle_state', async (vehicleState) => {
            await this.onVehicleState(vehicleState);
		});
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

		await this.homey.app.unregisterDevice(this);
    }


	async addCondition(name, fn) {
		let condition = this.homey.flow.getConditionCard(name);
		condition.registerRunListener(fn);

		this.conditions.push(condition);
	}

	async addAction(name, fn) {
		let action = this.homey.flow.getActionCard(name);
		action.registerRunListener(fn);

		this.actions.push(action);
	}

	async trigger(name, args) {
		if (args) {
			this.log(`Triggering '${name}' with parameters ${JSON.stringify(args)}`);
		} else {
			this.log(`Triggering '${name}'}`);
		}
		const triggerCard = this.homey.flow.getDeviceTriggerCard(name);
		await triggerCard.trigger(this, args);
	}
}

