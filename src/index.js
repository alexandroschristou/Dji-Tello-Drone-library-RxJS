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

import { Observable } from 'rxjs';

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
const TELLO_RECEIVE_PORT = 8890

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
const udpServer = dgram.createSocket('udp4');

udpServer.bind(TELLO_RECEIVE_PORT);

const observable = observableFromSocket(udpServer);
const observer = {
    next: x => console.log('Observer got a next value: ' + x[0] +'Received %f bytes from %s:%d\n', x[1].length, x[1].address, x[1].port),
    error: err => console.error('Observer got an error: ' + err),
    complete: () => console.log('Observer got a complete notification'),
  };
observable.subscribe(observer)


const udpClient = dgram.createSocket('udp4');
udpClient.bind(TELLO_SEND_PORT);
// These send commands could be smarter by waiting for the SDK to respond with 'ok' and handling errors
// Send command
udpClient.send("command", TELLO_SEND_PORT, TELLO_IP, null);
udpClient.send("streamon", TELLO_SEND_PORT, TELLO_IP, null);

udpClient.on('message', function (msg, info) {
  console.log('Data received from server : ' + msg.toString());
  console.log('Received %d bytes from %s:%d\n', msg.length, info.address, info.port);
});

/*
  5. Begin the ffmpeg stream. You must have Tello connected first
*/

// Delay for 3 seconds before we start ffmpeg
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

  console.log(`Please enter a command:`);
  rl.on("line", (line) => {
    udpClient.send(line, TELLO_SEND_PORT, TELLO_IP)
  });

  // Spawn an ffmpeg instance
  var streamer = spawn('ffmpeg', args);
  // Uncomment if you want to see ffmpeg stream info
  //streamer.stderr.pipe(process.stderr);
  streamer.on("exit", function (code) {
    console.log("Failure", code);
  });
}, 3000);






