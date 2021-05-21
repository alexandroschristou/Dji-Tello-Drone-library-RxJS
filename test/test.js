import { assertValidOutputStride } from "@tensorflow-models/posenet/dist/util";
import { BehaviorSubject } from "rxjs";
import { marbles } from "rxjs-marbles/mocha";
import { map } from "rxjs/operators";
import { Tello } from "../src/index";
import { Tello_Test_Ports, Tello_Test_IP } from "./utills";
var assert = require('chai').assert;
var expect = require('chai').expect;


let tello = null;
// beforeEach("initializing drone", function() {
//     // runs once before the first test in this block
//     tello = new Tello(Tello_Test_Ports, Tello_Test_IP);
//     tello.init();
//   });

describe('Initializing drone', function () {
    it('drone should be initialized', function () {
        tello = new Tello(Tello_Test_Ports, Tello_Test_IP);


        expect(tello.IS_FLYING.getValue()).to.be.false
        expect(tello.STREAM_ON.getValue()).to.be.false
    });
})

describe('Initializing drone', function () {
    it('state data should be initialized', function () {
        for (const [key, value] of Object.entries(tello.StateInterface.get_drone_state())) {
            expect(tello.StateInterface.state_data[key]).to.be.null;
        }
    });
})

describe('state data should be initialized with behaviour subjects', function () {
    it('should be behavioursubjects', function () {
        tello.init();
        for (const [key, value] of Object.entries(tello.StateInterface.get_drone_state())) {
            expect(tello.StateInterface.state_data[key]).to.be.instanceOf(BehaviorSubject);
        }
    });

})
describe('state data should be parsed correctly', function () {
    it('should be a float/number', function () {
        let testdata = [
            'mid:-2;x:-200;y:-200;z:-200;mpry:0,0,0;pitch:0;roll:0;yaw:0;vgx:0;vgy:0;vgz:0;templ:44;temph:47;tof:10;h:0;bat:88;baro:138.82;time:0;agx:9.00;agy:0.00;agz:-1000.00;\r\n',
            { address: '192.168.10.1', family: 'IPv4', port: 8889, size: 166 }
        ]
        tello.StateInterface.parse_state_data(testdata);
        for (const [key, value] of Object.entries(tello.StateInterface.get_drone_state())) {
            //            console.log(tello.StateInterface.state_data[key].getValue().instanceOf(Number))
            expect(tello.StateInterface.state_data[key].getValue()).to.be.a('number');
        }
    });

})



describe('Test sending message', function () {
    it('message send should be equal to response', function (done) {
        tello.send_command_with_return("TestCommand")
        done();
        tello.response[0].should.equal('TestCommand')
    });
});

describe('Test flying', function () {
    it('flying variable should be set to true', function (done) {
        tello.takeoff()
        done();
        expect(tello.IS_FLYING.getValue()).to.be.true
        tello.response[0].should.equal('takeoff')
    });
});

describe('Test stream', function () {
    it('stream variable should be set to true', function (done) {
        tello.streamon()
        done();
        expect(tello.STREAM_ON.getValue()).to.be.true
        tello.response[0].should.equal('streamon')
    });
});




// describe("rxjs-marbles", () => {

//     it("should support marble tests", marbles(m => {

//         const source = m.hot("--^-a-b-c-|");
//         const subs = "^-------!";
//         const expected = "--b-c-d-|";

//         const destination = source.pipe(
//             map(value => String.fromCharCode(value.charCodeAt(0) + 1))
//         );
//         m.expect(destination).toBeObservable(expected);
//         m.expect(source).toHaveSubscriptions(subs);
//     }));
// });