"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.log = log;
exports.observableFromSocket = observableFromSocket;
exports.Tello_Ports = exports.Tello_Stream_IP = exports.Tello_IP = void 0;

var _operators = require("rxjs/operators");

var _rxjs = require("rxjs");

var Tello_IP = '192.168.10.1',
    Tello_Stream_IP = '0.0.0.0';
exports.Tello_Stream_IP = Tello_Stream_IP;
exports.Tello_IP = Tello_IP;
var Tello_Ports = {
  State: 8890,
  Send: 8889,
  Stream: 11111
};
exports.Tello_Ports = Tello_Ports;

function log() {
  var description = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  return (0, _operators.tap)({
    next: function next(value) {
      return console.log("%c".concat(description, ": ").concat(value), value);
    },
    error: function error(_error) {
      return console.log("%c".concat(description, " (error)"), _error);
    },
    complete: function complete() {
      return console.log("%c".concat(description, " (complete)"));
    }
  });
}
/* code to make our own observable from a socket */


function observableFromSocket(socket) {
  return new _rxjs.Observable(function subscribe(subscriber) {
    socket.on('message', function (msg, info) {
      subscriber.next([msg.toString(), info]);
    });
    socket.on("error", function (err) {
      subscriber.error(err);
    });
    socket.on("close", function () {
      subscriber.complete();
    });
  });
}

;