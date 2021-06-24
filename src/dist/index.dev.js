"use strict";

var _drone = require("./drone");

var _utils = require("./utils");

var tello = new _drone.Tello(_utils.Tello_Ports, _utils.Tello_IP);
tello.init();
tello.start_web_server();
tello.command();
tello.streamon();
tello.start();
tello.monitor(tello.get_yaw, 0, 50, tello.rotate_clockwise, tello.rotate_counter_clockwise, 20);
tello.monitor(tello.get_height, 120, 150, tello.move_up, tello.move_down, 30);

function DoubleBackFlip() {
  tello.flip_back();
  tello.flip_back();
}