
var Timer = module.exports = function() {

	var _this = this;
	var _timer = undefined;

	function cancel() {
		if (_timer != undefined)
			clearTimeout(_timer);

		_timer = undefined;
	}

	function setTimer(delay, fn) {
		if (delay == undefined)
			delay = 3000;

		cancel();

		_timer = setTimeout(function() {
			cancel();
			fn();
		}, delay);
	}

	_this.cancel = cancel;
	_this.setTimer = setTimer;

};
