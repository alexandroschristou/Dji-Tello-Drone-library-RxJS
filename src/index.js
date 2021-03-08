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

import { Observable, from } from 'rxjs';
import { map, filter } from 'rxjs/operators';
3


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

// Tello's ID and Port
const TELLO_IP = '192.168.10.1'
const TELLO_SEND_PORT = 8889
const TELLO_STATE_PORT = 8890

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
      observer.error(err);
    });
    socket.on("close", () => {
      observer.complete();
    });
  });
};



/*
  1. Create the web server that the user can access at
  http://localhost:3000/index.html
*/
var server = http.createServer(function (request, response) {

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
const streamServer = http.createServer(function (request, response) {

  // Log that a stream connection has come through
  console.log(
    'Stream Connection on ' + STREAM_PORT + ' from: ' +
    request.socket.remoteAddress + ':' +
    request.socket.remotePort
  );

  // When data comes from the stream (FFmpeg) we'll pass this to the web socket
  request.on('data', function (data) {
    // Now that we have data let's pass it to the web socket server
    webSocketServer.broadcast(data);
  });

}).listen(STREAM_PORT); // Listen for streams on port 3001

/*
  3. Begin web socket server
*/
const webSocketServer = new WebSocket.Server({
  server: streamServer
});

// Broadcast the stream via websocket to connected clients
webSocketServer.broadcast = function (data) {
  webSocketServer.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

/* 
  4. Send the command and streamon SDK commands to begin the Tello video stream.
  YOU MUST POWER UP AND CONNECT TO TELL BEFORE RUNNING THIS SCRIPT
*/





/*
  5. Begin the ffmpeg stream. You must have Tello connected first
*/

// Delay for 3 seconds before we start ffmpeg
// setTimeout(function () {
//   var args = [
//     "-i", "udp://0.0.0.0:11111",
//     "-r", "30",
//     "-s", "960x720",
//     "-codec:v", "mpeg1video",
//     "-b", "800k",
//     "-f", "mpegts",
//     "http://127.0.0.1:3001/stream"
//   ];



//   // Spawn an ffmpeg instance
//   var streamer = spawn('ffmpeg', args);
//   // Uncomment if you want to see ffmpeg stream info
//   //streamer.stderr.pipe(process.stderr);
//   streamer.on("exit", function (code) {
//     console.log("Failure", code);
//   });
// }, 3000);

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
    // console.log("dict:")
    // console.log(dict)
    // console.log()

    this.state_data = dict;

    //console.log(this.state_data)
  }
  init() {
    const udpServer = dgram.createSocket('udp4');
    udpServer.bind(TELLO_STATE_PORT);

    const udpClient = dgram.createSocket('udp4');
    udpClient.bind(TELLO_SEND_PORT);

    const Server = observableFromSocket(udpServer);
    const observer = {
      next: x => this.parse_state_data(x),//console.log('Observer got a next value: ' + x[0] +'Received %f bytes from %s:%d\n', x[1].size, x[1].address, x[1].port),
      error: err => console.error('Observer got an error: ' + err),
      complete: () => console.log('Observer got a complete notification'),
    };
    Server.subscribe(observer)

   
    // These send commands could be smarter by waiting for the SDK to respond with 'ok' and handling errors
    // Send command
    this.command()
    this.streamon()

    udpClient.on('message', function (msg, info) {
      console.log('Data received from server : ' + msg.toString());
      console.log('Received %d bytes from %s:%d\n', msg.length, info.address, info.port);
    });
  }

  send_command_with_return(msg) {
    udpClient.send(msg, this.TELLO_SEND_PORT, this.TELLO_IP, null);
  }

  send_simple_command(msg) {
    udpClient.send(msg, this.TELLO_SEND_PORT, this.TELLO_IP, null);
  }

  send_read_command(cmd) {
    this.send_command_with_return(cmd)
  }

  send_control_command(cmd) {
    this.send_command_with_return(cmd)
  }

  takeoff() {
    this.send_control_command("takeoff")
    this.IS_FLYING = true
  }

  land() {
    this.send_control_command("land")
    this.IS_FLYING = false
  }

  command() {
    this.send_control_command("command")
  }

  streamon() {
    this.send_control_command("streamon")
    this.STREAM_ON = true
  }
  streamoff() {
    this.send_control_command("streamoff")
    this.STREAM_ON = false
  }

  emergency() {
    this.send_control_command("emergency")
  }

  move(direction, distance) {
    this.send_control_command(`${direction} ${distance}`)
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
    this.send_control_command(`cw ${degree}`)
  }

  rotate_counter_clockwise(degree) {
    this.send_control_command(`ccw ${degree}`)
  }

  flip(direction) {
    this.send_control_command(`flip ${direction}`)
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
    this.send_control_command(`go ${x} ${y} ${z} ${speed}`)
  }

  curve_xyz_speed(x1, y1, z1, x2, y2, z2, speed) {
    this.send_control_command(`go ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${speed}`)
  }

  go_xyz_speed_mid(x, y, z, speed, mid) {
    this.send_control_command(`go ${x} ${y} ${z} ${speed} m${mid}`)
  }

  curve_xyz_speed_mid(x1, y1, z1, x2, y2, z2, speed, mid) {
    this.send_control_command(`go ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${speed} m${mid}`)
  }

  go_xyz_speed_yaw_mid(x, y, z, speed, yaw, mid1, mid2) {
    this.send_control_command(`jump ${x} ${y} ${z} ${speed} ${yaw} m${mid1} m${mid2}`)
  }

  enable_mission_pads() {
    this.send_control_command("mon")
  }

  disable_mission_pads() {
    this.send_control_command("moff")
  }

  set_mission_pad_detection_direction(direction) {
    this.send_control_command(`mdirection ${direction}`)
  }

  set_speed(speed) {
    this.send_control_command(`speed ${speed}`)
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
    this.send_read_command('speed?')
  }


}

let tello = new Tello();
tello.init()

console.log(`Please enter a command:`);
rl.on("line", (line) => {
  console.log(tello.state_data)
});

