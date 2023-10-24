'use strict';

const Homey = require('homey');

module.exports = class extends Homey.Device {
	async onSettings({ oldSettings, changedKeys, newSettings }) {
		let config = newSettings;

		if (config.refreshToken.length == '') {
			throw new Error(this.homey.__('SpecifyAccessToken'));
		}

		try {
			await this.homey.app.initializeVehicles(config.refreshToken);
		} catch (error) {
			throw new Error(this.homey.__('InvalidAccessToken'));
		}

		this.log(config);
		this.homey.app.saveConfig(config);
	}

	async onInit() {
		let config = this.homey.app.getConfig();
		this.setSettings(config);
	}
};
