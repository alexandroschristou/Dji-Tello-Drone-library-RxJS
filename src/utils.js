import { tap } from "rxjs/operators";
import { Observable } from "rxjs";

export const Tello_IP = '192.168.10.1', Tello_Stream_IP = '0.0.0.0';
export const Tello_Ports = {
  State: 8890,
  Send: 8889,
  Stream: 11111
}


export function log(description = '') {
  return tap({
    next: value => console.log(`%c${description}: ${value}`, value),
    error: error => console.log(`%c${description} (error)`, error),
    complete: () => console.log(`%c${description} (complete)`)
  });
}

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

