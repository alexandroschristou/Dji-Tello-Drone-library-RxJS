"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tello = void 0;

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var _utils = require("./utils");

var _StateInterface = require("./StateInterface");

var _CommandInterface = require("./CommandInterface");

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

// A basic http server that we'll access to view the stream
var http = require('http'); // To keep things simple we read the index.html page and send it to the client


var fs = require('fs'); // WebSocket for broadcasting stream to connected clients


var WebSocket = require('ws'); // We'll spawn ffmpeg as a separate process


var spawn = require('child_process').spawn; // For sending SDK commands to Tello
// HTTP and streaming ports


var HTTP_PORT = 3000;
var STREAM_PORT = 3001;

var readline = require("readline");

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
/* 
  4. Send the command and streamon SDK commands to begin the Tello video stream.
  YOU MUST POWER UP AND CONNECT TO TELL BEFORE RUNNING THIS SCRIPT
*/

var Tello =
/*#__PURE__*/
function () {
  function Tello() {
    _classCallCheck(this, Tello);

    this.IS_FLYING = new _rxjs.BehaviorSubject(false);
    this.STREAM_ON = new _rxjs.BehaviorSubject(false);
    this.StateInterface = new _StateInterface.StateInterface(this);
    this.CommandInterface = new _CommandInterface.CommandInterface(this);
    this.rotationLimits = {
      lower: 1,
      upper: 360
    };
    this.moveLimits = {
      lower: 20,
      upper: 500
    };
    this.processes = [];
    this.Occupied = false;
    this.webServer = null;
    this.streamServer = null;
    this.webSocketServer = null;
    this.SendSubject = new _rxjs.Subject();
    this.commandQueue$ = new _rxjs.Subject();
  } //https://github.com/damiafuentes/DJITelloPy/blob/master/djitellopy/tello.py

  /*
  1. Create the web server that the user can access at
  http://localhost:3000/index.html
  */


  _createClass(Tello, [{
    key: "start_web_server",
    value: function start_web_server() {
      var parentObject = this;
      parentObject.webServer = http.createServer(function (request, response) {
        // console.log that an http connection has come through
        console.log('HTTP Connection on ' + HTTP_PORT + ' from: ' + request.socket.remoteAddress + ':' + request.socket.remotePort); // Read file from the local directory and serve to user
        // in this case it will be index.html

        fs.readFile(__dirname + '/www/' + request.url, function (err, data) {
          if (err) {
            response.writeHead(404);
            response.end(JSON.stringify(err));
            return;
          }

          response.writeHead(200);
          response.end(data);
        });
      }).listen(HTTP_PORT); // Listen on port 3000

      /*
      2. Create the stream server where the video stream will be sent
      */

      parentObject.streamServer = http.createServer(function (request, response) {
        // console.log that a stream connection has come through
        console.log('Stream Connection on ' + STREAM_PORT + ' from: ' + request.socket.remoteAddress + ':' + request.socket.remotePort); // When data comes from the stream (FFmpeg) we'll pass this to the web socket

        request.on('data', function (data) {
          // Now that we have data let's pass it to the web socket server
          //console.log(data);
          parentObject.webSocketServer.broadcast(data);
        });
      }).listen(STREAM_PORT); // Listen for streams on port 3001

      /*
        3. Begin web socket server
      */

      parentObject.webSocketServer = new WebSocket.Server({
        server: parentObject.streamServer
      }); // Broadcast the stream via websocket to connected clients

      parentObject.webSocketServer.broadcast = function (data) {
        parentObject.webSocketServer.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(data);
          }
        });
      };
      /*
      5. Begin the ffmpeg stream. You must have Tello connected first
      */
      //Delay for 3 seconds before we start ffmpeg


      setTimeout(function () {
        var args = ["-i", "udp://0.0.0.0:11111", "-r", "30", "-s", "960x720", "-codec:v", "mpeg1video", "-b:v", "800k", "-f", "mpegts", "http://127.0.0.1:3001/stream"]; //Spawn an ffmpeg instance

        var streamer = spawn('ffmpeg', args); //Uncomment if you want to see ffmpeg stream info
        //streamer.stderr.pipe(process.stdout);

        streamer.on("exit", function (code) {
          console.log("Failure", code);
        });
      }, 3000);
    }
  }, {
    key: "init",
    value: function init() {
      var _this = this;

      for (var _i = 0, _Object$entries = Object.entries(this.StateInterface.get_drone_state()); _i < _Object$entries.length; _i++) {
        var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
            key = _Object$entries$_i[0],
            value = _Object$entries$_i[1];

        this.StateInterface.state_data[key] = new _rxjs.BehaviorSubject(null);
      }

      this.SendSubject.subscribe(function (msg) {
        console.log("command received and send:", msg);
        _this.Occupied = true;

        _this.CommandInterface.send_command(msg, _utils.Tello_Ports.Send, _utils.Tello_IP, null);
      }, function (err) {
        return console.error("subject got an error: " + err);
      }, function () {
        return console.log("subject got a complete notification");
      });
      this.commandQueue$.pipe((0, _utils.log)("added to queue >>"), (0, _operators.concatMap)(function (command) {
        return _this.send_command_with_return(command);
      }), (0, _utils.log)("DONE")).subscribe();
    }
  }, {
    key: "send_command_with_return",
    value: function send_command_with_return(msg) {
      var _this2 = this;

      var parentobject = this;
      console.log("Occupied value is: " + this.Occupied);

      if (this.Occupied) {
        return new _rxjs.Observable(function (obs) {
          parentobject.CommandInterface.Client.pipe((0, _operators.distinctUntilChanged)(), (0, _operators.take)(1)).subscribe(function (dataa) {
            obs.next(msg);

            _this2.SendSubject.next(msg);

            obs.complete();
          }, function (err) {
            return console.error("Observer got an error: " + err);
          }, function () {
            return console.log("observer finished with " + msg + "\n");
          });
        }).toPromise();
      } else {
        parentobject.SendSubject.next(msg);
        return _rxjs.EMPTY;
      }
    }
  }, {
    key: "send_simple_command",
    value: function send_simple_command(msg) {
      this.SendSubject.next(msg);
    }
  }, {
    key: "sendCommand",
    value: function sendCommand(command) {
      this.commandQueue$.next(command);
    }
  }, {
    key: "get_state_field",
    value: function get_state_field(key) {
      var state = this.StateInterface.get_drone_state();

      if (state.hasOwnProperty(key)) {
        return state[key];
      } else {
        console.log("error state isn't known, not in state_data");
      }
    }
  }, {
    key: "checkMoveLimits",
    value: function checkMoveLimits(distance) {
      if (distance < this.moveLimits.lower || distance > this.moveLimits.upper) {
        return false;
      } else {
        return true;
      }
    }
  }, {
    key: "checkRotationLimits",
    value: function checkRotationLimits(range) {
      if (range < this.rotationLimits.lower || range > this.rotationLimits.upper) {
        return false;
      } else {
        return true;
      }
    } //#region commands

  }, {
    key: "takeoff",
    value: function takeoff() {
      this.sendCommand("takeoff");
      this.IS_FLYING.next(true);
    }
  }, {
    key: "land",
    value: function land() {
      this.sendCommand("land");
      this.IS_FLYING.next(false);
    }
  }, {
    key: "command",
    value: function command() {
      this.sendCommand("command");
    }
  }, {
    key: "streamon",
    value: function streamon() {
      this.sendCommand("streamon");
      this.STREAM_ON.next(true);
    }
  }, {
    key: "streamoff",
    value: function streamoff() {
      this.sendCommand("streamoff");
      this.STREAM_ON.next(false);
    }
  }, {
    key: "emergency",
    value: function emergency() {
      this.sendCommand("emergency");
    }
  }, {
    key: "move",
    value: function move(direction, distance) {
      if (this.checkMoveLimits(distance)) {
        this.sendCommand("".concat(direction, " ").concat(distance));
      } else {
        console.log("error distance is out of range for move ".concat(direction));
      }
    }
  }, {
    key: "move_up",
    value: function move_up(distance) {
      this.move("up", distance);
    }
  }, {
    key: "move_down",
    value: function move_down(distance) {
      this.move("down", distance);
    }
  }, {
    key: "move_left",
    value: function move_left(distance) {
      this.move("left", distance);
    }
  }, {
    key: "move_right",
    value: function move_right(distance) {
      this.move("right", distance);
    }
  }, {
    key: "move_forward",
    value: function move_forward(distance) {
      this.move("forward", distance);
    }
  }, {
    key: "move_back",
    value: function move_back(distance) {
      this.move("back", distance);
    }
  }, {
    key: "rotate_clockwise",
    value: function rotate_clockwise(degree) {
      this.checkRotationLimits(degree) ? this.sendCommand("cw ".concat(degree)) : console.log("error out of range for cw ".concat(degree));
    }
  }, {
    key: "rotate_counter_clockwise",
    value: function rotate_counter_clockwise(degree) {
      this.checkRotationLimits(degree) ? this.sendCommand("ccw ".concat(degree)) : console.log("error out of range for ccw ".concat(degree));
    }
  }, {
    key: "flip",
    value: function flip(direction) {
      this.sendCommand("flip ".concat(direction));
    }
  }, {
    key: "flip_left",
    value: function flip_left() {
      this.flip("l");
    }
  }, {
    key: "flip_right",
    value: function flip_right() {
      this.flip("r");
    }
  }, {
    key: "flip_forward",
    value: function flip_forward() {
      this.flip("f");
    }
  }, {
    key: "flip_back",
    value: function flip_back() {
      this.flip("b");
    }
  }, {
    key: "go_xyz_speed",
    value: function go_xyz_speed(x, y, z, speed) {
      this.sendCommand("go ".concat(x, " ").concat(y, " ").concat(z, " ").concat(speed));
    }
  }, {
    key: "curve_xyz_speed",
    value: function curve_xyz_speed(x1, y1, z1, x2, y2, z2, speed) {
      this.sendCommand("go ".concat(x1, " ").concat(y1, " ").concat(z1, " ").concat(x2, " ").concat(y2, " ").concat(z2, " ").concat(speed));
    }
  }, {
    key: "go_xyz_speed_mid",
    value: function go_xyz_speed_mid(x, y, z, speed, mid) {
      this.sendCommand("go ".concat(x, " ").concat(y, " ").concat(z, " ").concat(speed, " m").concat(mid));
    }
  }, {
    key: "curve_xyz_speed_mid",
    value: function curve_xyz_speed_mid(x1, y1, z1, x2, y2, z2, speed, mid) {
      this.sendCommand("go ".concat(x1, " ").concat(y1, " ").concat(z1, " ").concat(x2, " ").concat(y2, " ").concat(z2, " ").concat(speed, " m").concat(mid));
    }
  }, {
    key: "go_xyz_speed_yaw_mid",
    value: function go_xyz_speed_yaw_mid(x, y, z, speed, yaw, mid1, mid2) {
      this.sendCommand("jump ".concat(x, " ").concat(y, " ").concat(z, " ").concat(speed, " ").concat(yaw, " m").concat(mid1, " m").concat(mid2));
    }
  }, {
    key: "enable_mission_pads",
    value: function enable_mission_pads() {
      this.sendCommand("mon");
    }
  }, {
    key: "disable_mission_pads",
    value: function disable_mission_pads() {
      this.sendCommand("moff");
    }
  }, {
    key: "set_mission_pad_detection_direction",
    value: function set_mission_pad_detection_direction(direction) {
      this.sendCommand("mdirection ".concat(direction));
    }
  }, {
    key: "set_speed",
    value: function set_speed(speed) {
      this.sendCommand("speed ".concat(speed));
    }
  }, {
    key: "send_rc_control",
    value: function send_rc_control() {
      console.log("not yet implemented");
    }
  }, {
    key: "set_wifi_credentials",
    value: function set_wifi_credentials(ssid, password) {
      this.send_simple_command("wifi ".concat(ssid, " ").concat(password));
    }
  }, {
    key: "connect_to_wifi",
    value: function connect_to_wifi(ssid, password) {
      this.send_simple_command("ap ".concat(ssid, " ").concat(password));
    }
  }, {
    key: "get_speed",
    value: function get_speed() {
      this.sendCommand('speed?');
    }
  }, {
    key: "get_mission_pad_id",
    value: function get_mission_pad_id() {
      return this.get_state_field('mid');
    }
  }, {
    key: "get_mission_pad_distance_x",
    value: function get_mission_pad_distance_x() {
      return this.get_state_field('x');
    }
  }, {
    key: "get_mission_pad_distance_y",
    value: function get_mission_pad_distance_y() {
      return this.get_state_field('y');
    }
  }, {
    key: "get_mission_pad_distance_z",
    value: function get_mission_pad_distance_z() {
      return this.get_state_field('z');
    }
  }, {
    key: "get_pitch",
    value: function get_pitch() {
      return this.get_state_field('pitch');
    }
  }, {
    key: "get_roll",
    value: function get_roll() {
      return this.get_state_field('roll');
    }
  }, {
    key: "get_yaw",
    value: function get_yaw() {
      return this.get_state_field('yaw');
    }
  }, {
    key: "get_Xspeed",
    value: function get_Xspeed() {
      return this.get_state_field('vgx');
    }
  }, {
    key: "get_Yspeed",
    value: function get_Yspeed() {
      return this.get_state_field('vgy');
    }
  }, {
    key: "get_Zspeed",
    value: function get_Zspeed() {
      return this.get_state_field('vgz');
    }
  }, {
    key: "get_lowest_temp",
    value: function get_lowest_temp() {
      return this.get_state_field('templ');
    }
  }, {
    key: "get_highest_temp",
    value: function get_highest_temp() {
      return this.get_state_field('temph');
    }
  }, {
    key: "get_time_of_flight",
    value: function get_time_of_flight() {
      return this.get_state_field('tof');
    }
  }, {
    key: "get_height",
    value: function get_height() {
      return this.get_state_field('h');
    }
  }, {
    key: "get_battery_percentage",
    value: function get_battery_percentage() {
      return this.get_state_field('bat');
    }
  }, {
    key: "get_barometer",
    value: function get_barometer() {
      return this.get_state_field('baro');
    }
  }, {
    key: "get_motor_time",
    value: function get_motor_time() {
      return this.get_state_field('time');
    }
  }, {
    key: "get_Xacceleration",
    value: function get_Xacceleration() {
      return this.get_state_field('agx');
    }
  }, {
    key: "get_Yacceleration",
    value: function get_Yacceleration() {
      return this.get_state_field('agy');
    }
  }, {
    key: "get_Zacceleration",
    value: function get_Zacceleration() {
      return this.get_state_field('agz');
    } //#endregion

  }, {
    key: "monitor",
    value: function monitor(state, min, max, response, response2, amount) {
      var _this3 = this;

      this.IS_FLYING.pipe((0, _operators.distinctUntilChanged)(), (0, _operators.debounceTime)(1000)).subscribe(function (val) {
        if (val) {
          var CalledObservable = state.call(_this3);
          var subscription = CalledObservable.pipe((0, _operators.distinctUntilChanged)(), (0, _operators.debounceTime)(1000)).subscribe(function (val) {
            if (val < min) {
              response.call(_this3, amount);
            } else if (val > max) {
              response2.call(_this3, amount);
            } else {
              console.log("we goood");
            }
          });

          _this3.processes.push(subscription);
        } else {
          _this3.processes.forEach(function (element) {
            element.unsubscribe();
          });

          console.log("here:");
          console.log(_this3.processes);
        }
      });
    }
  }]);

  return Tello;
}();

exports.Tello = Tello;
var tello = new Tello();
tello.init();
tello.start_web_server();
tello.command();
tello.streamon();
tello.takeoff();
tello.monitor(tello.get_yaw, 0, 30, tello.rotate_clockwise, tello.rotate_counter_clockwise, 20);
console.log("Please enter a command:"); //var keyups = fromEvent(, "‘keyup’")

rl.on("line", function (line) {
  if (line == "l") {
    tello.land();
  } else if (line == "t") {
    tello.takeoff();
  } else if (line == "cw") {
    tello.rotate_clockwise(50);
  } else if (line == "ccw") {
    tello.rotate_counter_clockwise(50);
  } else if (line == "up") {
    tello.move_up(30);
  } else if (line == "down") {
    tello.move_down(30);
  } else if (line == "left") {
    tello.move_left(30);
  } else if (line == "right") {
    tello.move_right(30);
  } else if (line == "f") {
    tello.flip_back();
  } else if (line == "b") {
    console.log(tello.get_battery_percentage());
  } else if (line == "test") {
    console.log(tello.processes);
    tello.IS_FLYING.next(false);
    console.log(tello.processes);
  } else if (line == "test2") {
    tello.IS_FLYING.next(true);
  }
});