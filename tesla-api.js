var Events = require('events');

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



function Request() {

	var Path = require('path');
	var URL = require('url');
	var self = this;

	function debug() {
	};

	function constructor() {

		var options = {protocol:'https:'};



        var url = new URL.parse(arguments[0]);

        if (url.protocol != undefined)
            options.protocol = url.protocol;

        if (url.port != undefined)
            options.port = url.port;

        if (url.hostname != undefined)
            options.hostname = url.hostname;

        if (url.path != undefined)
            options.path = url.path;

        if (isObject(arguments[1]))
            Object.assign(options, arguments[1]);


		if (options.debug) {
            debug = isFunction(options.debug) ? options.debug : console.log;
        }

		self.defaultOptions = Object.assign({}, options);

		debug('Default options', self.defaultOptions);
	}

	this.get = function() {
		return self.request.apply(self, ['GET'].concat(Array.prototype.slice.call(arguments)));
	}

	this.delete = function() {
		return self.request.apply(self, ['DELETE'].concat(Array.prototype.slice.call(arguments)));
	}

	this.post = function() {
		return self.request.apply(self, ['POST'].concat(Array.prototype.slice.call(arguments)));
	}

	this.put = function() {
		return self.request.apply(self, ['PUT'].concat(Array.prototype.slice.call(arguments)));
	}

	this.request = function(method, path, options = {}) {

		debug('Request arguments:', arguments);

		var self    = this;
		var https   = require('https');
		var http    = require('http');

        options = {method:method, path:path, ...options};

        
		debug('Request options:', options);
		
	    return new Promise(function(resolve, reject) {
			var data = isObject(options.body) ? JSON.stringify(options.body) : options.body;
			var headers = {};

			if (self.defaultOptions.headers != undefined) {
				for (var key in self.defaultOptions.headers) {
					headers[key.toLowerCase()] = self.defaultOptions.headers[key];
				}

			}

			if (options.headers != undefined) {
				for (var key in options.headers) {
					headers[key.toLowerCase()] = options.headers[key];
				}

			}

			// If default options includes a path, join the two
			if (isString(self.defaultOptions.path) && isString(options.path)) {
				options.path = Path.join(self.defaultOptions.path, options.path);
			}

			headers['content-length'] = data == undefined ? 0 : Buffer.from(data).length;

			if (isObject(options.body)) 
				headers['content-type'] = 'application/json;charset=utf-8';

			var params = {};
			Object.assign(params, self.defaultOptions, options, {headers:headers});

			var iface = params.protocol === "https:" ? https : http;

			debug('Request params:', params);

            params.timeout = 100;

	        var request = iface.request(params, function(response) {

				response.setEncoding('utf8');				

				var body = [];

				response.on('data', function(chunk) {
					body.push(chunk);
				});

	            response.on('end', function() {
	                body = body.join('');

					var contentType = '';

					if (response.headers && isString(response.headers['content-type'])) {
						contentType = response.headers['content-type'];
					}

					if (contentType.match("application/json")) {
						try {
							body = JSON.parse(body);
		                }
						catch (error) {
		                }
					}

	                var reply = {
	                    statusCode     : response.statusCode,
	                    statusMessage  : response.statusMessage,
	                    headers        : response.headers,
	                    body           : body
	                };

	                resolve(reply);
	            })
	        });

	        if (data) {
	            request.write(data);
	        }

			request.on('error', function(error) {
				reject(error);
			});

	        request.end();
	    })
	};


	constructor.apply(self, arguments);
}



function RequestYES() {

	var Path = require('path');
	var URL = require('url');
	var self = this;

	function debug() {
	};

	function constructor() {

		var options = {protocol:'https:'};

		if (isObject(arguments[0])) {
			Object.assign(options, arguments[0]);
		}

		else if (isString(arguments[0])) {
			var url = new URL.parse(arguments[0]);

			if (url.protocol != undefined)
				options.protocol = url.protocol;

			if (url.port != undefined)
				options.port = url.port;

			if (url.hostname != undefined)
				options.hostname = url.hostname;

			if (url.path != undefined)
				options.path = url.path;

			if (isObject(arguments[1]))
				Object.assign(options, arguments[1]);

		}

		if (options.debug) {
            debug = isFunction(options.debug) ? options.debug : console.log;
        }

		self.defaultOptions = Object.assign({}, options);

		debug('Default options', self.defaultOptions);
	}

	this.get = function() {
		return self.request.apply(self, ['GET'].concat(Array.prototype.slice.call(arguments)));
	}

	this.delete = function() {
		return self.request.apply(self, ['DELETE'].concat(Array.prototype.slice.call(arguments)));
	}

	this.post = function() {
		return self.request.apply(self, ['POST'].concat(Array.prototype.slice.call(arguments)));
	}

	this.put = function() {
		return self.request.apply(self, ['PUT'].concat(Array.prototype.slice.call(arguments)));
	}

	this.request = function() {

		debug('Request arguments:', arguments);

		var self    = this;
		var https   = require('https');
		var http    = require('http');
		var options = {};

		if (isString(arguments[0])) {
			if (isString(arguments[1])) {
				options.method = arguments[0];
				options.path   = arguments[1];

				Object.assign(options, arguments[2]);
			}
			else {
				options.method = arguments[0];
				Object.assign(options, arguments[1]);
			}
		}
		else if (isObject(arguments[0])) {
			options = arguments[0];
		}
		else {
			return Promise.reject('Missing options.');
		}

		debug('Request options:', options);
		
	    return new Promise(function(resolve, reject) {
			var data = isObject(options.body) ? JSON.stringify(options.body) : options.body;
			var headers = {};

			if (self.defaultOptions.headers != undefined) {
				for (var key in self.defaultOptions.headers) {
					headers[key.toLowerCase()] = self.defaultOptions.headers[key];
				}

			}

			if (options.headers != undefined) {
				for (var key in options.headers) {
					headers[key.toLowerCase()] = options.headers[key];
				}

			}

			// If default options includes a path, join the two
			if (isString(self.defaultOptions.path) && isString(options.path)) {
				options.path = Path.join(self.defaultOptions.path, options.path);
			}

			headers['content-length'] = data == undefined ? 0 : Buffer.from(data).length;

			if (isObject(options.body)) 
				headers['content-type'] = 'application/json;charset=utf-8';

			var params = {};
			Object.assign(params, self.defaultOptions, options, {headers:headers});

			var iface = params.protocol === "https:" ? https : http;

			debug('Request params:', params);

            params.timeout = 100;

	        var request = iface.request(params, function(response) {

				response.setEncoding('utf8');				

				var body = [];

				response.on('data', function(chunk) {
					body.push(chunk);
				});

	            response.on('end', function() {
	                body = body.join('');

					var contentType = '';

					if (response.headers && isString(response.headers['content-type'])) {
						contentType = response.headers['content-type'];
					}

					if (contentType.match("application/json")) {
						try {
							body = JSON.parse(body);
		                }
						catch (error) {
		                }
					}

	                var reply = {
	                    statusCode     : response.statusCode,
	                    statusMessage  : response.statusMessage,
	                    headers        : response.headers,
	                    body           : body
	                };

	                resolve(reply);
	            })
	        });

	        if (data) {
	            request.write(data);
	        }

			request.on('error', function(error) {
				reject(error);
			});

	        request.end();
	    })
	};


	constructor.apply(self, arguments);
}



class XRequest {
    constructor(url, options = {}) {
        let URL = require('url');
        let parsedURL = new URL.parse(url);

        this.defaultOptions = {...options};

        this.debug = console.log; //isFunction(options.debug) ? options.debug : console.log;
        this.log = isFunction(options.log) ? options.log : () => {};

        if (parsedURL.protocol != undefined) this.defaultOptions.protocol = parsedURL.protocol;
        if (parsedURL.port != undefined) this.defaultOptions.port = parsedURL.port;
        if (parsedURL.hostname != undefined) this.defaultOptions.hostname = parsedURL.hostname;
        if (parsedURL.path != undefined) this.defaultOptions.path = parsedURL.path;


    }

     request(method, path, options = {}) {
        let QueryString = require('querystring');
        let Path = require('path');
        let https = require('https');
        let http = require('http');

        let params = {...this.defaultOptions, ...options};
        let data = isObject(params.body) ? JSON.stringify(params.body) : params.body;

        params.method = method;
        params.path = Path.join(params.path, path);

        if (isObject(options.query)) {
            let queryString = QueryString.stringify(options.query);

			if (queryString.length > 0) {
				params.path = params.path + '?' + queryString;
			}            
        }



        params.headers['content-length'] = data == undefined ? 0 : Buffer.from(data).length;


        if (isObject(params.body))  {
            params.headers['content-type'] = 'application/json;charset=utf-8';
        }

        let iface = params.protocol === "https:" ? https : http;

        this.debug(`------------------${JSON.stringify(params)}`);

        let request = iface.request(params, function (response) {
            response.setEncoding('utf8');

            var body = [];

            response.on('data', function (chunk) {
                body.push(chunk);
            });

            response.on('end', function () {
                body = body.join('');

                var contentType = '';

                if (response.headers && isString(response.headers['content-type'])) {
                    contentType = response.headers['content-type'];
                }

                if (contentType.match('application/json')) {
                    try {
                        body = JSON.parse(body);
                    } catch (error) {}
                }

                var reply = {
                    statusCode: response.statusCode,
                    statusMessage: response.statusMessage,
                    headers: response.headers,
                    body: body,
                };

                resolve(reply);
            });
        });        

    
    }


	get () {
		return this.request.apply(this, ['GET'].concat(Array.prototype.slice.call(arguments)));
	};

	delete () {
		return this.request.apply(this, ['DELETE'].concat(Array.prototype.slice.call(arguments)));
	};

	post () {
		return this.request.apply(this, ['POST'].concat(Array.prototype.slice.call(arguments)));
	};

	put  () {
		return this.request.apply(this, ['PUT'].concat(Array.prototype.slice.call(arguments)));
	};

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
			this.log(error.stack);
		}

		let then = new Date();
		let api = await this.getAPI();

		while (true) {
			let now = new Date();

			this.debug(`Sending wakeup to vehicle ${vehicleID}...`);

			var reply = await api.post(`vehicles/${vehicleID}/wake_up`);
			var response = reply.body.response;

			if (now.getTime() - then.getTime() > timeout) throw new Error('Your Tesla cannot be reached within timeout period.');

			if (response.state == 'online') {
				this.debug(`Vehicle ${vehicleID} is now online.`);
				return response;
			}

			await this.pause(1000);
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
