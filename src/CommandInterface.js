import { observableFromSocket } from "./utils"

const dgram = require('dgram');


export class CommandInterface {
    constructor(Tello, Tello_Ports) {
        this.telloClient = Tello;
        this.udpServer = dgram.createSocket('udp4');
        this.udpServer.bind(Tello_Ports.State);

        this.udpClient = dgram.createSocket('udp4');
        this.udpClient.bind(Tello_Ports.Send);

        this.Server = observableFromSocket(this.udpServer);
        this.ServerSubscriber = this.Server.subscribe(
            x => this.telloClient.StateInterface.parse_state_data(x),
            err => console.error('Server got an error: ' + err),
            () => console.log('Server got a complete notification'))

        this.Client = observableFromSocket(this.udpClient);
        this.ClientSubscriber = this.Client.subscribe(
            x => {
                this.telloClient.Occupied = false
                this.telloClient.response = x;
                console.log("response from drone is:", x)
            },
            err => console.error('Client got an error: ' + err),
            () => console.log('Client got a complete notification'))
    }

    send_command(msg, port, ip, callback) {
        this.udpClient.send(msg, port, ip, callback);
    }

    close() {
        this.ServerSubscriber.complete();
        this.udpServer.close();
        this.ClientSubscriber.complete();
        this.udpClient.close();
    }
}
