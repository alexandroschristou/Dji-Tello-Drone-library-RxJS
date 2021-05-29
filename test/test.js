import { BehaviorSubject } from "rxjs";
import { Tello } from "../src/index";
import { Tello_Test_Ports, Tello_Test_IP } from "./utills";

var expect = require('chai').expect;


let tello = null;

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
            expect(tello.StateInterface.state_data[key].getValue()).to.be.a('number');
        }
    });

})


describe('Test sending message', function () {
    this.timeout(2000);
    before(function(done){
        tello.send_command_with_return("TestCommand")
        setTimeout(done, 1500)
      });
    it('message send should be equal to response', function () {
        expect(tello.response[0]).to.be.equal('TestCommand')
    });
});

describe('Test sending rotation with in range value', function (){
    this.timeout(1000);
    this.beforeEach(function(done){
        tello.response = null;
        tello.rotate_clockwise(360)
        setTimeout(done, 500)
      });
    it('rotation in range', function (done){
        expect(tello.response[0]).to.be.equal('cw 360');
        done()
    })
})

describe('Test sending rotation with out of range value', function (){
    this.timeout(1000);
    this.beforeEach(function(done){
        tello.response = null;
        tello.rotate_clockwise(361)
        setTimeout(done, 500)
      });
    it('rotation out of range', function (done){
        expect(tello.response).to.be.null;
        done()
    })
})

describe('Test sending movement with in range value', function (){
    this.timeout(1000);
    this.beforeEach(function(done){
        tello.response = null;
        tello.move_up(500)
        setTimeout(done, 500)
      });
    it('movement in range', function (done){
        expect(tello.response[0]).to.be.equal('up 500');
        done()
    })
})

describe('Test sending movement with out of range value', function (){
    this.timeout(1000);
    this.beforeEach(function(done){
        tello.response = null;
        tello.rotate_clockwise(501)
        setTimeout(done, 500)
      });
    it('movement out of range', function (done){
        expect(tello.response).to.be.null;
        done()
    })
})

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