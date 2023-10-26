'use strict';

const Homey = require('homey');


class MyDevice extends Homey.Device {

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

	async onInit() {
		this.conditions = [];
		this.actions = [];
	}


	addCondition(name, fn) {
		let condition = this.homey.flow.getConditionCard(name);
		condition.registerRunListener(fn);

		this.conditions.push(condition);
	}

	addAction(name, fn) {
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

module.exports = MyDevice;
