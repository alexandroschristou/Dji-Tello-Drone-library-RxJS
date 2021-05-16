// import {Subject} from "rxjs";
// import {distinctUntilChanged, concatMap, debounceTime } from "rxjs/operators";
import {observableFromSocket} from "./utils"
import { Tello_Ports } from "./utils";
const dgram = require('dgram');


export class CommandInterface {

    constructor(Tello) {
        this.telloClient = Tello;
        this.udpServer = dgram.createSocket('udp4');
        this.udpServer.bind(Tello_Ports.State);

        this.udpClient = dgram.createSocket('udp4');
        this.udpClient.bind(Tello_Ports.Send);

        const Server = observableFromSocket(this.udpServer);
        const observer = {
            next: x => this.telloClient.StateInterface.parse_state_data(x),
            error: err => console.error('Observerrr got an error: ' + err),
            complete: () => console.log('Observer got a complete notification')
        };
        Server.subscribe(observer)

        this.Client = observableFromSocket(this.udpClient);
        this.Client.subscribe(
            x => {
                Tello.Occupied = false
                console.log("respone from drone is:", x)
            },
            err => console.error('Observer2 got an error: ' + err),
            () => console.log('Observer got a complete notification')
        )
    }
    send_command(msg, port, ip, callback){
        this.udpClient.send(msg, port, ip, callback);
    }
}