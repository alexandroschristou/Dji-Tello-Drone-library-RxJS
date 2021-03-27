import { Observable, from, Subject, timer } from "rxjs";
import { tap, mapTo, filter, concatMap, scan, take } from "rxjs/operators";
//import { log } from "./helpers";
const timestamp = require("performance-now");
const numeral = require("numeral");
const P = require("bluebird");

// For sending SDK commands to Tello
const udp = require("dgram");

/* code to make our own observable from a socket */
export function observableFromSocket(socket) {
  return new Observable(function subscribe(subscriber) {
    socket.on("message", function(msg, info) {
      subscriber.next([msg.toString(), info]);
    });
    socket.on("error", err => {
      subscriber.error(err);
    });
    socket.on("close", () => {
      subscriber.complete();
    });
  });
}

export function log(description = '', badgeColor = 'darkCyan') {
  const badge = color => `background:${color}; color:white; padding:4px; margin-right:4px; border-radius:3px; font-size:9px;`;

  return tap({
    next:  value => console.log(`%c${description}: ${value}`,  badge(badgeColor),  value),
    error: error => console.log(`%c${description} (error)`,    badge('fireBrick'), error),
    complete: () => console.log(`%c${description} (complete)`, badge('slateGray'))
  });
}

class TelloService {
  commandQueue$ = new Subject();

  constructor(telloClient) {
    this.commandQueue$
      .pipe(
        log("added to queue >>", "slateGray"),
        concatMap(command => telloClient.testSubject.next(command)),
        log("DONE", "darkOrange")
      )
      .subscribe();
  }

  sendCommand(command) {
    return timer(1500)
      .pipe(mapTo(command))
      .toPromise();
  }
}

class Tello {
  constructor() {

    this.udpServer = null;
    this.udpClient = null;
    this.Client = null;

    this.testSubject = new Subject();
    this.testSubject.subscribe(
      msg => {
        console.log("command received and send:", msg); //normally this sends the command to the drone using UDP
        this.udpClient.send(msg, 2222, "localhost", null);
      },
      err => console.error("subject got an error: " + err),
      () => console.log("subject got a complete notification")
    );
  }

  init() {
    // creating a udp server
    var server = udp.createSocket("udp4");

    // emits on new datagram msg
    server.on("message", function(msg, info) {
      console.log("Data received from client : " + msg.toString());

      //sending msg
      setTimeout(function() {
        server.send("ok", info.port, "localhost", function(error) {
          if (error) {
            client.close();
          } 
        });
      }, 3000);
    });
    server.bind(2222);

    this.udpClient = udp.createSocket("udp4");
    this.udpClient.bind(this.TELLO_SEND_PORT);

    this.Client = observableFromSocket(this.udpClient);
    this.Client.subscribe(
      x => console.log("respone from drone is:", x), // this prints the response from the drone after a command has been sent (ok or error)
      err => console.error("Observer got an error: " + err),
      () => console.log("Observer got a complete notification")
    );

    //this.testSubject.next("command"); /*currently sending first command manually 
    //                                    this command should always be send first before any other*/
    //this.command()
    //this.streamon();
  }

  async send_command_with_return(msg) {
   return  this.testSubject.next(msg).toPromise();
  }

  streamon() {
    this.send_command_with_return("streamon");
  }

  streamoff() {
    this.send_command_with_return("streamoff");
  }

  get_speed() {
    this.send_command_with_return("speed?");
  }

  get_battery() {
    this.send_command_with_return("battery?");
  }
}

let tello = new Tello();
let service = new TelloService(tello);
tello.init();

 service.sendCommand('streamon');
 service.sendCommand('stremoff');
// tello.get_speed();
// tello.get_battery();




// let parentobject = this;

// let zeroTime = timestamp();
// const now = () => numeral((timestamp() - zeroTime) / 10e3).format("0.0000");

// const asyncTask = data =>
//   new Observable(obs => {
//     console.log(`${now()}: starting async task ${data}`);

    
//     parentobject.Client.pipe(take(1)).subscribe(
//       dataa => {
//         console.log("loool")
//         obs.next(data);
//         this.testSubject.next(data);
//         console.log(`${now()}: end of async task ${data}`);
//         obs.complete();
//       },
//       err => console.error("Observer got an error: " + err),
//       () => console.log("observer asynctask finished with " + data + "\n")
//     );
//   });

// let p = this.commandQueue.pipe(concatMap(asyncTask)).toPromise(P); //commandQueue is a subject in the constructor

// console.log("start filling queue with " + msg);
// zeroTime = timestamp();
// this.commandQueue.next(msg);
// //["streamon", "streamoff", "height?", "temp?"].forEach(a => this.commandQueue.next(a));

// await p;

// // this.testSubject.next(msg);