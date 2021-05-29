import { Observable, Subject, BehaviorSubject, EMPTY } from "rxjs";
import { distinctUntilChanged, concatMap, take, debounceTime } from "rxjs/operators";

import { log } from "./utils";
import { StateInterface } from "./StateInterface";
import { CommandInterface } from "./CommandInterface";


// A basic http server that we'll access to view the stream
const http = require('http');
// To keep things simple we read the index.html page and send it to the client
const fs = require('fs');
// WebSocket for broadcasting stream to connected clients
const WebSocket = require('ws');
// We'll spawn ffmpeg as a separate process
const spawn = require('child_process').spawn;
// For sending SDK commands to Tello
var keypress = require('keypress');

// HTTP and streaming ports
const HTTP_PORT = 3000;
const STREAM_PORT = 3001

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

  /*
  https://github.com/dbaldwin/tello-video-nodejs-websockets

  1. Create the web server that the user can access at
  http://localhost:3000/index.html
*/
  start_web_server() {
    let parentObject = this;
    parentObject.webServer = http.createServer(function (request, response) {

      // log that an http connection has come through
      log(
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
      // log that a stream connection has come through
      log(
        'Stream Connection on ' + STREAM_PORT + ' from: ' +
        request.socket.remoteAddress + ':' +
        request.socket.remotePort
      );

      // When data comes from the stream (FFmpeg) we'll pass this to the web socket
      request.on('data', function (data) {
        // Now that we have data let's pass it to the web socket server
        //log(data);
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
        log("Failure", code);
      });
    }, 3000);
  }

  //initializing drone
  init() {
    for (const [key, value] of Object.entries(this.StateInterface.get_drone_state())) {
      this.StateInterface.state_data[key] = new BehaviorSubject(null)
    }
    this.SendSubject.subscribe(
      msg => {
        log("command received and send:", msg);
        this.Occupied = true;
        this.CommandInterface.send_command(msg, this.Tello_Ports.Send, this.Tello_IP, null);
      },
      err => console.error("subject got an error: " + err),
      () => log("subject got a complete notification")
    );

    this.commandQueue$
      .pipe(
        log("added to queue >>"),
        concatMap(command => this.send_command_with_return(command)),
        log("DONE")
      )
      .subscribe();
  }

  //send command and waits for a return.
  send_command_with_return(msg) {
    let parentobject = this;
    log("Occupied value is: " + this.Occupied)
    if (this.Occupied) {
      return new Observable(obs => {
        parentobject.CommandInterface.Client
          .pipe(distinctUntilChanged(), take(1))
          .subscribe(
            response => {//when response from observable we send next
              obs.next(msg);
              this.SendSubject.next(msg);
              obs.complete();
            },
            err => console.error("Observer got an error: " + err),
            () => log("observer finished with " + msg + "\n")
          );
      }).toPromise();
    }
    else {
      parentobject.SendSubject.next(msg);
      return EMPTY;
    }
  }

  send_simple_command(msg) {
    this.SendSubject.next(msg);
  }

  //add command to commandQueue
  sendCommand(command) {
    this.commandQueue$.next(command);
  }

  //return specific state (behaviourSubject)
  get_state_field(key) {
    let state = this.StateInterface.get_drone_state();
    if (state.hasOwnProperty(key)) {
      return state[key];
    }
    else {
      log("error state isn't known, not in state_data")
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

  start() {

    let tello = this;
    // make `process.stdin` begin emitting "keypress" events
    keypress(process.stdin);
    process.on('exit', function () {
      // disable mouse on exit, so that the state
      // is back to normal for the terminal
      process.stdin.pause()
    });
    // listen for the "keypress" event
    process.stdin.on('keypress', function (ch, key) {
      switch (key.name) {
        case "z":
          tello.move_forward(30);
          break;
        case "s":
          tello.move_back(30);
          break;
        case "q":
          tello.move_left(30);
          break;
        case "d":
          tello.move_right(30);
          break;
        case "left":
          tello.rotate_counter_clockwise(30);
          break;
        case "right":
          tello.rotate_clockwise(30);
          break;
        case "up":
          tello.move_up(30);
          break;
        case "down":
          tello.move_down(30);
          break;
        case "t":
          tello.takeoff()
          break;
        case "l":
          tello.land()
          break;
        case "b":
          console.log(tello.get_battery_percentage());
          break;
        case "f":  
          tello.flip_forward();
          break;
        case "escape":
          tello.close();
          process.exit();
      }
      if (key && key.ctrl && key.name == 'c') {
        process.stdin.pause();
      }
    });

     process.stdin.setRawMode(true);
     process.stdin.resume();
  }

  close() {
    if (this.IS_FLYING.getValue()) {
      console.log("Can't close, drone is still flying, please land.")
    }
    else {
      this.CommandInterface.close()

    }
  }

  //#region commands from SDK
  takeoff() {
    this.sendCommand("takeoff")
    this.IS_FLYING.next(true)
  }

  land() {
    this.sendCommand("land")
    this.IS_FLYING.next(false)
    this.processes.forEach(process => {
      process.unsubscribe();
    });
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
      log(`error distance is out of range for move ${direction}`)
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
    this.checkRotationLimits(degree) ? this.sendCommand(`cw ${degree}`) : log(`error out of range for cw ${degree}`)
  }

  rotate_counter_clockwise(degree) {
    this.checkRotationLimits(degree) ? this.sendCommand(`ccw ${degree}`) : log(`error out of range for ccw ${degree}`)
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

  /*x-axis left/right 
    y-axis forward/backward
    z-axis up/down
  */
  send_rc_control(x_axis, y_axis, z_axis, yaw) {
    this.sendCommand(`rc ${x_axis} ${y_axis} ${z_axis} ${yaw}`)
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

  // monitor function to monitor given state
  monitor(state, min, max, lower, upper, amount) {
    this.IS_FLYING.pipe(distinctUntilChanged(), debounceTime(1000))
      .subscribe(flying => {
        if (flying) {
          let StateSubject = state.call(this);
          let subscription = StateSubject.pipe(
            distinctUntilChanged(), debounceTime(1000))
            .subscribe(
              val => {
                console.log("here")
                console.log(val);
                if (val < min) {
                  lower.call(this, amount)
                }
                else if (val > max) {
                  upper.call(this, amount)
                }
                else{
                  console.log("we good")
                }
              })
          this.processes.push(subscription);
        }
      })
  }
}




