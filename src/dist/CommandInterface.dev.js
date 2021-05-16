"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CommandInterface = void 0;

var _utils = require("./utils");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var dgram = require('dgram');

var CommandInterface =
/*#__PURE__*/
function () {
  function CommandInterface(Tello) {
    var _this = this;

    _classCallCheck(this, CommandInterface);

    this.telloClient = Tello;
    this.udpServer = dgram.createSocket('udp4');
    this.udpServer.bind(_utils.Tello_Ports.State);
    this.udpClient = dgram.createSocket('udp4');
    this.udpClient.bind(_utils.Tello_Ports.Send);
    var Server = (0, _utils.observableFromSocket)(this.udpServer);
    var observer = {
      next: function next(x) {
        return _this.telloClient.StateInterface.parse_state_data(x);
      },
      error: function error(err) {
        return console.error('Observerrr got an error: ' + err);
      },
      complete: function complete() {
        return console.log('Observer got a complete notification');
      }
    };
    Server.subscribe(observer);
    this.Client = (0, _utils.observableFromSocket)(this.udpClient);
    this.Client.subscribe(function (x) {
      Tello.Occupied = false;
      console.log("respone from drone is:", x);
    }, function (err) {
      return console.error('Observer2 got an error: ' + err);
    }, function () {
      return console.log('Observer got a complete notification');
    });
  }

  _createClass(CommandInterface, [{
    key: "send_command",
    value: function send_command(msg, port, ip, callback) {
      this.udpClient.send(msg, port, ip, callback);
    }
  }]);

  return CommandInterface;
}();

exports.CommandInterface = CommandInterface;