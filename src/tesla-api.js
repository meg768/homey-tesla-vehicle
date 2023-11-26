let Request = require('./request.js');

// https://developer.tesla.com/docs/fleet-api

function isString(arg) {
	return typeof arg == 'string';
}

function isObject(arg) {
	return typeof arg == 'object' && arg != null;
}

function isFunction(arg) {
	return typeof arg === 'function';
}

function isString(arg) {
	return typeof arg === 'string';
}

class TeslaAPI {
	constructor(options) {
		this.token = options.refreshToken || options.token;
		this.api = undefined;
		this.apiInvalidAfter = undefined;
		this.debug = () => {};

		if (!isString(this.token)) {
			throw new Error('A refresh token must be specified.');
		}

		if (options.debug) {
			this.debug = typeof options.debug === 'function' ? options.debug : console.log;
		}
	}

	async getVehicles() {
		let api = await this.getAPI();
		let request = await api.get('vehicles');
		let vehicles = request.body.response;

		return vehicles;
	}

	async getVehicle(vehicleID) {
		var api = await this.getAPI();
		var request = await api.get(`vehicles/${vehicleID}`);

		return request.body.response;
	}

	async wakeUp(vehicleID, timeout = 60000) {
		try {
			let vehicle = await this.getVehicle(vehicleID);

			if (vehicle && vehicle.state == 'online') {
				return;
			}
		} catch (error) {
		}

		let then = new Date();
		let api = await this.getAPI();

		while (true) {
			let now = new Date();

			this.debug(`Sending wakeup to vehicle ${vehicleID}...`);

			try {
				let reply = await api.post(`vehicles/${vehicleID}/wake_up`);
				let response = reply.body.response;

				if (response.state == 'online') {
					this.debug(`Vehicle ${vehicleID} is now online. Took ${Math.round((now - then) / 1000)} seconds to wake up`);
					return response;
				}
			} catch (error) {
            }

			if (now.getTime() - then.getTime() > timeout) {
				throw new Error('Your Tesla cannot be reached within timeout period.');
			}

			await this.pause(3000);
		}
	}

	pause(ms) {
		return new Promise((resolve, reject) => {
			setTimeout(resolve, ms);
		});
	}

	async request(vehicleID, method, command, options) {
		var api = await this.getAPI();

		var path = `vehicles/${vehicleID}/${command}`;
		var response = await api.request(method, path, options);

		switch (response.statusCode) {
			case 200: {
				break;
			}

			default: {
				this.debug(`${response.statusMessage} (${response.statusCode}).`);

				// Invalidate current API
				this.api = undefined;

				// Get a new API.
				api = await this.getAPI();

				// Wake up
				await this.wakeUp(vehicleID);

				// And try again
				response = await api.request(method, path, options);
				break;
			}
		}

		if (!response) {
			throw new Error(`Tesla request failed - NULL.`);
		}

		if (!response.body) {
			throw new Error(`Tesla request failed - Body missing.`);
		}
		if (!response.body.response) {
			throw new Error(`Tesla request failed - Response missing.`);
		}

		response = response.body.response;

		if (isObject(response) && isString(response.reason) && response.result === false) {
			throw new Error(`Tesla request failed - ${response.reason}.`);
		}

		return response;
	}

	async getAPI() {
		var now = new Date();

		if (this.api && this.apiInvalidAfter && now.getTime() < this.apiInvalidAfter.getTime()) {
			return this.api;
		}

		if (!this.api) {
			this.debug(`Fetching new access token.`);
		} else {
			this.debug(`Too long since access token was generated. Generating a new one.`);
		}

		var getAccessToken = async () => {
			var options = {
				headers: {
					'content-type': 'application/json; charset=utf-8',
				},
				body: {
					'grant_type': 'refresh_token',
					'refresh_token': this.token,
					'client_id': 'ownerapi',
				},
			};

			var request = new Request('https://auth.tesla.com');
			var reply = await request.post('oauth2/v3/token', options);

			if (!reply || !reply.body) {
				throw new Error(`Jibberish from Tesla when trying to get an access token.`);
			}

			if (reply.body.expires_in == undefined) {
				throw new Error(`Invalid response from Tesla. Maybe the refresh token is wrong. Try again with another token.`);
			}

			return reply.body;
		};

		var token = await getAccessToken();

		var options = {
			headers: {
				'content-type': `application/json; charset=utf-8`,
				'authorization': `Bearer ${token.access_token}`,
			},
		};

		// Create new API with the specifies access token
		this.api = new Request('https://owner-api.teslamotors.com/api/1', options);

		// Make sure we create a new API within a week or so
		this.apiInvalidAfter = new Date();
		this.apiInvalidAfter.setTime(this.apiInvalidAfter.getTime() + 1000 * token.expires_in);

		this.debug(`This access token will expire ${this.apiInvalidAfter}.`);

		return this.api;
	}
}

module.exports = TeslaAPI;
