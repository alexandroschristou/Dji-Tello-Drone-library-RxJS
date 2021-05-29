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
  function CommandInterface(Tello, Tello_Ports) {
    var _this = this;

    _classCallCheck(this, CommandInterface);

    this.telloClient = Tello;
    this.udpServer = dgram.createSocket('udp4');
    this.udpServer.bind(Tello_Ports.State);
    this.udpClient = dgram.createSocket('udp4');
    this.udpClient.bind(Tello_Ports.Send);
    this.Server = (0, _utils.observableFromSocket)(this.udpServer);
    this.ServerSubscriber = this.Server.subscribe(function (x) {
      return _this.telloClient.StateInterface.parse_state_data(x);
    }, function (err) {
      return console.error('Server got an error: ' + err);
    }, function () {
      return console.log('Server got a complete notification');
    });
    this.Client = (0, _utils.observableFromSocket)(this.udpClient);
    this.ClientSubscriber = this.Client.subscribe(function (x) {
      _this.telloClient.Occupied = false;
      _this.telloClient.response = x;
      console.log("response from drone is:", x);
    }, function (err) {
      return console.error('Client got an error: ' + err);
    }, function () {
      return console.log('Client got a complete notification');
    });
  }

  _createClass(CommandInterface, [{
    key: "send_command",
    value: function send_command(msg, port, ip, callback) {
      this.udpClient.send(msg, port, ip, callback);
    }
  }, {
    key: "close",
    value: function close() {
      this.ServerSubscriber.complete();
      this.udpServer.close();
      this.ClientSubscriber.complete();
      this.udpClient.close();
    }
  }]);

  return CommandInterface;
}();

exports.CommandInterface = CommandInterface;