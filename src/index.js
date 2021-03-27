/*
 * Created on Tue 3/24/2020
 *
 * Copyright (c) 2020 - DroneBlocks, LLC
 * Author: Dennis Baldwin
 * URL: https://github.com/dbaldwin/tello-video-nodejs-websockets
 *
 * PLEASE REVIEW THE README FILE FIRST
 * YOU MUST POWER UP AND CONNECT TO TELLO BEFORE RUNNING THIS SCRIPT
 */

// Import necessary modules for the project

import { Observable, from, Subject, timer, EMPTY } from "rxjs";
import { tap, mapTo, filter, concatMap, scan, take } from "rxjs/operators";
import * as tf from "@tensorflow/tfjs";
import * as posenet from "@tensorflow-models/posenet";

const timestamp = require('performance-now');
const numeral = require('numeral');
const P = require('bluebird');
// A basic http server that we'll access to view the stream
const http = require('http');
// To keep things simple we read the index.html page and send it to the client
const fs = require('fs');
// WebSocket for broadcasting stream to connected clients
const WebSocket = require('ws');
// We'll spawn ffmpeg as a separate process
const spawn = require('child_process').spawn;
// For sending SDK commands to Tello
const dgram = require('dgram');
// HTTP and streaming ports
const HTTP_PORT = 3000;
const STREAM_PORT = 3001

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/* code to make our own observable from a socket */
export function observableFromSocket(socket) {
  return new Observable(function subscribe(subscriber) {
    socket.on('message', function (msg, info) {
      subscriber.next([msg.toString(), info]);
    });
    socket.on("error", err => {
      subscriber.error(err);
    });
    socket.on("close", () => {
      subscriber.complete();
    });
  });
};
export function log(description = '', badgeColor = 'darkCyan') {
  const badge = color => `background:${color}; color:white; padding:4px; margin-right:4px; border-radius:3px; font-size:9px;`;

  return tap({
    next: value => console.log(`%c${description}: ${value}`, badge(badgeColor), value),
    error: error => console.log(`%c${description} (error)`, badge('fireBrick'), error),
    complete: () => console.log(`%c${description} (complete)`, badge('slateGray'))
  });
}

/* 
  4. Send the command and streamon SDK commands to begin the Tello video stream.
  YOU MUST POWER UP AND CONNECT TO TELL BEFORE RUNNING THIS SCRIPT
*/

class TelloService {
  commandQueue$ = new Subject();

  constructor(telloClient) {
    this.telloClient = telloClient;
    this.commandQueue$
      .pipe(
        log("added to queue >>", "slateGray"),
        concatMap(command => telloClient.send_command_with_return(command)),
        log("DONE", "darkOrange")
      )
      .subscribe();
  }

  sendCommand(command) {
    this.commandQueue$.next(command);
  }

  send_simple_command(msg) {
    this.telloClient.send_simple_command(msg)
  }

  get_state_field(key) {
    console.log(this.telloClient.state_data);
    console.log(key)
    if (this.telloClient.state_data.hasOwnProperty(key)) {
      console.log(this.telloClient.state_data[key])
      return this.telloClient.state_data[key];
    }
    else {
      console.log("error state isn't known, not in state_data")
    }
  }

  takeoff() {
    this.sendCommand("takeoff")
    this.IS_FLYING = true
  }

  land() {
    this.sendCommand("land")
    this.IS_FLYING = false
  }

  command() {
    this.sendCommand("command")
  }

  streamon() {
    this.sendCommand("streamon")
    this.STREAM_ON = true
  }
  streamoff() {
    this.sendCommand("streamoff")
    this.STREAM_ON = false
  }

  emergency() {
    this.sendCommand("emergency")
  }

  move(direction, distance) {
    this.sendCommand(`${direction} ${distance}`)
  }

  move_up(distance) {
    this.move("up", distance)
  }

  move_down(distance) {
    this.move("down", distance)
  }

  move_left(distance) {
    this.move("left", distance)
  }

  move_right(distance) {
    this.move("right", distance)
  }

  move_forward(distance) {
    this.move("forward", distance)
  }
  move_back(distance) {
    this.move("back", distance)
  }

  rotate_clockwise(degree) {
    this.sendCommand(`cw ${degree}`)
  }

  rotate_counter_clockwise(degree) {
    this.sendCommand(`ccw ${degree}`)
  }

  flip(direction) {
    this.sendCommand(`flip ${direction}`)
  }

  flip_left() {
    this.flip("l")
  }

  flip_right() {
    this.flip("r")
  }

  flip_forward() {
    this.flip("f")
  }

  flip_back() {
    this.flip("b")
  }

  go_xyz_speed(x, y, z, speed) {
    this.sendCommand(`go ${x} ${y} ${z} ${speed}`)
  }

  curve_xyz_speed(x1, y1, z1, x2, y2, z2, speed) {
    this.sendCommand(`go ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${speed}`)
  }

  go_xyz_speed_mid(x, y, z, speed, mid) {
    this.sendCommand(`go ${x} ${y} ${z} ${speed} m${mid}`)
  }

  curve_xyz_speed_mid(x1, y1, z1, x2, y2, z2, speed, mid) {
    this.sendCommand(`go ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${speed} m${mid}`)
  }

  go_xyz_speed_yaw_mid(x, y, z, speed, yaw, mid1, mid2) {
    this.sendCommand(`jump ${x} ${y} ${z} ${speed} ${yaw} m${mid1} m${mid2}`)
  }

  enable_mission_pads() {
    this.sendCommand("mon")
  }

  disable_mission_pads() {
    this.sendCommand("moff")
  }

  set_mission_pad_detection_direction(direction) {
    this.sendCommand(`mdirection ${direction}`)
  }

  set_speed(speed) {
    this.sendCommand(`speed ${speed}`)
  }

  send_rc_control() {
    console.log("not yet implemented")
  }

  set_wifi_credentials(ssid, password) {
    this.send_simple_command(`wifi ${ssid} ${password}`)
  }

  connect_to_wifi(ssid, password) {
    this.send_simple_command(`ap ${ssid} ${password}`)
  }

  get_speed() {
    this.sendCommand('speed?')
  }

  get_mission_pad_id() {
    this.get_state_field('mid')
  }

  get_mission_pad_distance_x() {
    this.get_state_field('x')
  }

  get_mission_pad_distance_y() {
    this.get_state_field('y')
  }

  get_mission_pad_distance_z() {
    this.get_state_field('z')
  }

  get_pitch() {
    this.get_state_field('pitch')
  }

  get_roll() {
    this.get_state_field('roll')
  }

  get_yaw() {
    this.get_state_field('yaw')
  }

  get_Xspeed() {
    this.get_state_field('vgx')
  }

  get_Yspeed() {
    this.get_state_field('vgy')
  }

  get_Zspeed() {
    this.get_state_field('vgz')
  }

  get_lowest_temp() {
    this.get_state_field('templ')
  }

  get_highest_temp() {
    this.get_state_field('temph')
  }

  get_time_of_flight() {
    this.get_state_field('tof')
  }

  get_height() {
    this.get_state_field('h')
  }

  get_battery_percentage() {
    this.get_state_field('bat')
  }

  get_barometer() {
    this.get_state_field('baro')
  }

  get_motor_time() {
    this.get_state_field('time')
  }

  get_Xacceleration() {
    this.get_state_field('agx')
  }

  get_Yacceleration() {
    this.get_state_field('agy')
  }

  get_Zacceleration() {
    this.get_state_field('agz')
  }
}

class Tello {
  constructor() {
    // Tello's ID and Port
    this.TELLO_IP = '192.168.10.1'
    this.TELLO_SEND_PORT = 8889
    this.TELLO_STATE_PORT = 8890

    this.STREAM_UDP_IP = '0.0.0.0'
    this.STREAM_UDP_PORT = 11111

    this.IS_FLYING = false
    this.STREAM_ON = false

    this.RESPONSE_TIMEOUT = 7
    this.TAKEOFF_TIMEOUT = 20  // in seconds
    this.TIME_BTW_COMMANDS = 0.1 //# in seconds
    this.TIME_BTW_RC_CONTROL_COMMANDS = 0.001  // in seconds
    this.RETRY_COUNT = 3  // number of retries after a failed command
    this.state_data = {}
    this.udpServer = null
    this.udpClient = null
    this.Client = null
    this.Occupied = false

    this.webServer = null
    this.streamServer = null
    this.webSocketServer = null

    this.testSubject = new Subject();
    this.testSubject.subscribe(
      msg => {
        console.log("command received and send:", msg); //normally this sends the command to the drone using UDP
        this.Occupied = true;
        this.udpClient.send(msg, this.TELLO_SEND_PORT, this.TELLO_IP, null);
      },
      err => console.error("subject got an error: " + err),
      () => console.log("subject got a complete notification")
    );
  }

  //https://github.com/damiafuentes/DJITelloPy/blob/master/djitellopy/tello.py

  parse_state_data(data) {
    let state = data[0].trim();
    let additional_info = data[1];
    let dict = {};
    let res = state.split(";")
    res.forEach(function (el) {
      if (el.length > 1) {
        var x = el.split(":")
        dict[x[0]] = parseFloat(x[1]);
      }
    })

    this.state_data = dict;
    console.log(res);
  }

  /*
  1. Create the web server that the user can access at
  http://localhost:3000/index.html
*/
  start_web_server() {
    let parentObject = this;
    parentObject.webServer = http.createServer(function (request, response) {

      // Log that an http connection has come through
      console.log(
        'HTTP Connection on ' + HTTP_PORT + ' from: ' +
        request.socket.remoteAddress + ':' +
        request.socket.remotePort
      );

      // Read file from the local directory and serve to user
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


      // Log that a stream connection has come through
      console.log(
        'Stream Connection on ' + STREAM_PORT + ' from: ' +
        request.socket.remoteAddress + ':' +
        request.socket.remotePort
      );

      // When data comes from the stream (FFmpeg) we'll pass this to the web socket
      request.on('data', function (data) {
        // Now that we have data let's pass it to the web socket server
        parentObject.webSocketServer.broadcast(data);
      });

    }).listen(STREAM_PORT); // Listen for streams on port 3001

    /*
      3. Begin web socket server
    */
    parentObject.webSocketServer = new WebSocket.Server({
      server: parentObject.streamServer
    });

    // Broadcast the stream via websocket to connected clients
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
      var args = [
        "-i", "udp://0.0.0.0:11111",
        "-r", "30",
        "-s", "960x720",
        "-codec:v", "mpeg1video",
        "-b", "800k",
        "-f", "mpegts",
        "http://127.0.0.1:3001/stream"
      ];



      // Spawn an ffmpeg instance
      var streamer = spawn('ffmpeg', args);
      // Uncomment if you want to see ffmpeg stream info
      //streamer.stderr.pipe(process.stderr);
      streamer.on("exit", function (code) {
        console.log("Failure", code);
      });
    }, 3000);
  }


  init() {
    this.udpServer = dgram.createSocket('udp4');
    this.udpServer.bind(this.TELLO_STATE_PORT);

    this.udpClient = dgram.createSocket('udp4');
    this.udpClient.bind(this.TELLO_SEND_PORT);

    const Server = observableFromSocket(this.udpServer);
    const observer = {
      next: x => this.parse_state_data(x),//console.log('Observer got a next value: ' + x[0] +'Received %f bytes from %s:%d\n', x[1].size, x[1].address, x[1].port),
      error: err => console.error('Observer got an error: ' + err),
      complete: () => console.log('Observer got a complete notification')
    };
    Server.subscribe(observer)

    this.Client = observableFromSocket(this.udpClient);
    this.Client.subscribe(
      x => {
        this.Occupied = false
        console.log("respone from drone is:", x)
      },
      err => console.error('Observer got an error: ' + err),
      () => console.log('Observer got a complete notification')
    )
  }



  send_command_with_return(msg) {
    let parentobject = this;

    let zeroTime = timestamp();
    const now = () => numeral((timestamp() - zeroTime) / 10e3).format("0.0000");

    if (this.Occupied) {
      return new Observable(obs => {
        parentobject.Client.pipe(take(1)).subscribe(
          dataa => {
            obs.next(msg);
            this.testSubject.next(msg);
            obs.complete();
          },
          err => console.error("Observer got an error: " + err),
          () => console.log("observer finished with " + msg + "\n")
        );
      }).toPromise();
    }
    else {
      parentobject.testSubject.next(msg);
      return EMPTY;
    }
  }

  send_simple_command(msg) {
    this.testSubject.next(msg);
  }
}

let tello = new Tello();
let service = new TelloService(tello);
tello.init();
tello.start_web_server();

service.command();
// service.takeoff()
// service.rotate_clockwise(90);
// service.rotate_counter_clockwise(180);
// service.get_pitch();
// service.land();


// console.log(`Please enter a command:`);
// rl.on("line", (line) => {
//   tello.send_simple_command("height?")
// });


