const Homey = require('homey');

class Driver extends Homey.Driver {

    

	async onPairListDevices() {
        let app = this.homey.app;
		let token = this.homey.settings.get('token');
        this.log(`getPairListDevices token is ${token}`);

/*        if (typeof token != 'string' || token == '' || !this.api) {
			throw new Error(this.homey.__('app.noAPI'));
		}
*/

		let api = await app.getAPI();
		let vehicles = await api.getVehicles();
		let devices = [];

		function getDeviceName(vehicle) {
			let name = vehicles.length == 1 ? 'Tesla' : vehicle.vin;

			if (typeof vehicle.display_name == 'string' && vehicle.display_name != '') {
				name = vehicle.display_name;
			}

			return name;
		}

        let tiles = ['trunk', 'frunk', 'ping'];

		vehicles.forEach((vehicle) => {

            for (let tile of tiles) {
                let device = {};

				device.name = `${tile} (${getDeviceName(vehicle)})`;

                device.data = {};
                device.data.id = vehicle.id_s;
                device.data.tile = tile;

                devices.push(device);

            }

		});

		return devices;
	}

}

module.exports = Driver;
