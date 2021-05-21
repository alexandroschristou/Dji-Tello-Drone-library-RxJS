// import {Subject} from "rxjs";
// import {distinctUntilChanged, concatMap, debounceTime } from "rxjs/operators";
import {observableFromSocket} from "./utils"

const dgram = require('dgram');


export class CommandInterface {

    constructor(Tello, Tello_Ports) {
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
                this.telloClient.Occupied = false
                this.telloClient.response = x;
                console.log("respone from drone is:", x)
            },
            err => console.error('Observer2 got an error: ' + err),
            () => console.log('Observer got a complete notification')
        )
    }
    send_command(msg, port, ip, callback){
        console.log(msg, port, ip, callback);
        this.udpClient.send(msg, port, ip, callback);
    }
}