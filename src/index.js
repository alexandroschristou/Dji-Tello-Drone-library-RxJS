/*
 *
 * Author: Dennis Baldwin
 * URL: https://github.com/dbaldwin/tello-video-nodejs-websockets
 *
 */

// Import necessary modules for the project
import { Observable, from, fromEvent, Subject, BehaviorSubject, timer, EMPTY } from "rxjs";
import { tap, map, distinctUntilChanged, mapTo, filter, concatMap, scan, take, debounceTime } from "rxjs/operators";

import { observableFromSocket, log} from "./utils";
import { StateInterface } from "./StateInterface";
import { CommandInterface } from "./CommandInterface";
import { Tello_IP, Tello_Ports, Tello_Stream_IP } from "./utils";


// A basic http server that we'll access to view the stream
const http = require('http');
// To keep things simple we read the index.html page and send it to the client
const fs = require('fs');
// WebSocket for broadcasting stream to connected clients
const WebSocket = require('ws');
// We'll spawn ffmpeg as a separate process
const spawn = require('child_process').spawn;
// For sending SDK commands to Tello

// HTTP and streaming ports
const HTTP_PORT = 3000;
const STREAM_PORT = 3001

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


/* 
  4. Send the command and streamon SDK commands to begin the Tello video stream.
  YOU MUST POWER UP AND CONNECT TO TELL BEFORE RUNNING THIS SCRIPT
*/


export class Tello {
  constructor(Tello_Ports, Tello_IP) {
    this.IS_FLYING = new BehaviorSubject(false)
    this.STREAM_ON = new BehaviorSubject(false)
    this.Tello_Ports = Tello_Ports;
    this.Tello_IP = Tello_IP;

    this.StateInterface = new StateInterface(this);
    this.CommandInterface = new CommandInterface(this, this.Tello_Ports);

    this.rotationLimits = { lower: 1, upper: 360 }
    this.moveLimits = { lower: 20, upper: 500 }

    this.processes = []
    this.response = null;
    
    this.Occupied = false

    this.webServer = null
    this.streamServer = null
    this.webSocketServer = null

    this.SendSubject = new Subject();
   
    this.commandQueue$ = new Subject();
   
  }

  //https://github.com/damiafuentes/DJITelloPy/blob/master/djitellopy/tello.py

  

  /*
  1. Create the web server that the user can access at
  http://localhost:3000/index.html
*/
  start_web_server() {
    let parentObject = this;
    parentObject.webServer = http.createServer(function (request, response) {

      // console.log that an http connection has come through
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
      // console.log that a stream connection has come through
      console.log(
        'Stream Connection on ' + STREAM_PORT + ' from: ' +
        request.socket.remoteAddress + ':' +
        request.socket.remotePort
      );

      // When data comes from the stream (FFmpeg) we'll pass this to the web socket
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
        "-b:v", "800k",
        "-f", "mpegts",
        "http://127.0.0.1:3001/stream"
      ];
      
      //Spawn an ffmpeg instance
      var streamer = spawn('ffmpeg', args);
      
      //Uncomment if you want to see ffmpeg stream info
      //streamer.stderr.pipe(process.stdout);
      streamer.on("exit", function (code) {
        console.log("Failure", code);
      });
    }, 3000);
  }


  init() {
    for (const [key, value] of Object.entries(this.StateInterface.get_drone_state())) {
      this.StateInterface.state_data[key] = new BehaviorSubject(null)
    }
    this.SendSubject.subscribe(
      msg => {
        console.log("command received and send:", msg); 
        this.Occupied = true;
        this.CommandInterface.send_command(msg, Tello_Ports.Send, this.Tello_IP, null);
      },
      err => console.error("subject got an error: " + err),
      () => console.log("subject got a complete notification")
    );

    this.commandQueue$
      .pipe(
        log("added to queue >>"),
        concatMap(command => this.send_command_with_return(command)),
        log("DONE")
      )
      .subscribe();
  }

  send_command_with_return(msg) {
    let parentobject = this;
    console.log("Occupied value is: " + this.Occupied)
    if (this.Occupied) {
      return new Observable(obs => {
        parentobject.CommandInterface.Client
          .pipe(
            distinctUntilChanged(),
            take(1))
          .subscribe(
            dataa => {
              obs.next(msg);
              this.SendSubject.next(msg);
              obs.complete();
            },
            err => console.error("Observer got an error: " + err),
            () => console.log("observer finished with " + msg + "\n")
          );
      }).toPromise();
    }
    else {
      parentobject.SendSubject.next(msg);
      return EMPTY;
    }
  }

  send_simple_command(msg) {
    console.log(msg)
    this.SendSubject.next(msg);
  }

  sendCommand(command) {
    this.commandQueue$.next(command);
  }


  get_state_field(key) {
    let state = this.StateInterface.get_drone_state();
    if (state.hasOwnProperty(key)) {
      return state[key];
    }
    else {
      console.log("error state isn't known, not in state_data")
    }
  }

  checkMoveLimits(distance) {
    if (distance < this.moveLimits.lower || distance > this.moveLimits.upper) {
      return false
    }
    else {
      return true
    }
  }
  checkRotationLimits(range) {
    if (range < this.rotationLimits.lower || range > this.rotationLimits.upper) {
      return false
    }
    else {
      return true
    }
  }

  //#region commands
  takeoff() {
    this.sendCommand("takeoff")
    this.IS_FLYING.next(true)
  }

  land() {
    this.sendCommand("land")
    this.IS_FLYING.next(false)
  }

  command() {
    this.sendCommand("command")
  }

  streamon() {
    this.sendCommand("streamon")
    this.STREAM_ON.next(true)
  }
  streamoff() {
    this.sendCommand("streamoff")
    this.STREAM_ON.next(false)
  }

  emergency() {
    this.sendCommand("emergency")
  }

  move(direction, distance) {
    if (this.checkMoveLimits(distance)) {
      this.sendCommand(`${direction} ${distance}`)
    }
    else {
      console.log(`error distance is out of range for move ${direction}`)
    }
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
    this.checkRotationLimits(degree) ? this.sendCommand(`cw ${degree}`) : console.log(`error out of range for cw ${degree}`)
  }

  rotate_counter_clockwise(degree) {
    this.checkRotationLimits(degree) ? this.sendCommand(`ccw ${degree}`) : console.log(`error out of range for ccw ${degree}`)
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
    return this.get_state_field('mid')
  }

  get_mission_pad_distance_x() {
    return this.get_state_field('x')
  }

  get_mission_pad_distance_y() {
    return this.get_state_field('y')
  }

  get_mission_pad_distance_z() {

    return this.get_state_field('z')
  }

  get_pitch() {
    return this.get_state_field('pitch')
  }

  get_roll() {
    return this.get_state_field('roll')
  }

  get_yaw() {
    return this.get_state_field('yaw')
  }

  get_Xspeed() {
    return this.get_state_field('vgx')
  }

  get_Yspeed() {
    return this.get_state_field('vgy')
  }

  get_Zspeed() {
    return this.get_state_field('vgz')
  }

  get_lowest_temp() {
    return this.get_state_field('templ')
  }

  get_highest_temp() {
    return this.get_state_field('temph')
  }

  get_time_of_flight() {
    return this.get_state_field('tof')
  }

  get_height() {
    return this.get_state_field('h')
  }

  get_battery_percentage() {
    return this.get_state_field('bat')
  }

  get_barometer() {
    return this.get_state_field('baro')
  }

  get_motor_time() {
    return this.get_state_field('time')
  }

  get_Xacceleration() {
    return this.get_state_field('agx')
  }

  get_Yacceleration() {
    return this.get_state_field('agy')
  }

  get_Zacceleration() {
    return this.get_state_field('agz')
  }
  //#endregion

  monitor(state, min, max, response, response2, amount) {
    this.IS_FLYING.pipe(distinctUntilChanged(), debounceTime(1000))
      .subscribe(val => {
        if (val) {
          let CalledObservable = state.call(this);
          let subscription = CalledObservable.pipe(
            distinctUntilChanged(),
            debounceTime(1000)
          ).subscribe(
            val => {
              if (val < min) {
                response.call(this, amount)
              }
              else if (val > max) {
                response2.call(this, amount)
              }
              else {
                console.log("we goood")
              }
            })
          this.processes.push(subscription);
        }
        else {
          this.processes.forEach(element => {
            element.unsubscribe();
          });
          console.log("here:");
          console.log(this.processes);
        }
      })
  }
}



// let tello = new Tello(Tello_Ports, Tello_IP);
// tello.init();
// tello.start_web_server();
// tello.command();
// tello.streamon();
// //tello.takeoff();

// tello.monitor(tello.get_yaw, 0, 30, tello.rotate_clockwise, tello.rotate_counter_clockwise, 20);


// console.log(`Please enter a command:`);
// //var keyups = fromEvent(, "‘keyup’")
// rl.on("line", (line) => {
//   if (line == "l") {
//     tello.land();
//   } else if (line == "t") {
//     tello.takeoff()
//   } else if (line == "cw") {
//     tello.rotate_clockwise(50)
//   } else if (line == "ccw") {
//     tello.rotate_counter_clockwise(50)
//   } else if (line == "up") {
//     tello.move_up(30)
//   } else if (line == "down") {
//     tello.move_down(30)
//   } else if (line == "left") {
//     tello.move_left(30)
//   } else if (line == "right") {
//     tello.move_right(30)
//   } else if (line == "f") {
//     tello.flip_back();
//   } else if (line == "b") {
//     console.log(tello.get_battery_percentage());
//   }else if (line == "test") {
//     console.log(tello.processes)
//     tello.IS_FLYING.next(false)
//     console.log(tello.processes)

//   }
//   else if (line == "test2") {

//     tello.IS_FLYING.next(true)
//   }
// });
