const Homey = require('homey');

class Driver extends Homey.Driver {

    

    async onPairListDevices() {
		return await this.homey.app.getPairListDevices();
	}

}

module.exports = Driver;
