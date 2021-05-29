"use strict";

var _rxjs = require("rxjs");

var _index = require("../src/index");

var _utills = require("./utills");

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var expect = require('chai').expect;

var tello = null;
describe('Initializing drone', function () {
  it('drone should be initialized', function () {
    tello = new _index.Tello(_utills.Tello_Test_Ports, _utills.Tello_Test_IP);
    expect(tello.IS_FLYING.getValue()).to.be["false"];
    expect(tello.STREAM_ON.getValue()).to.be["false"];
  });
});
describe('Initializing drone', function () {
  it('state data should be initialized', function () {
    for (var _i = 0, _Object$entries = Object.entries(tello.StateInterface.get_drone_state()); _i < _Object$entries.length; _i++) {
      var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
          key = _Object$entries$_i[0],
          value = _Object$entries$_i[1];

      expect(tello.StateInterface.state_data[key]).to.be["null"];
    }
  });
});
describe('state data should be initialized with behaviour subjects', function () {
  it('should be behavioursubjects', function () {
    tello.init();

    for (var _i2 = 0, _Object$entries2 = Object.entries(tello.StateInterface.get_drone_state()); _i2 < _Object$entries2.length; _i2++) {
      var _Object$entries2$_i = _slicedToArray(_Object$entries2[_i2], 2),
          key = _Object$entries2$_i[0],
          value = _Object$entries2$_i[1];

      expect(tello.StateInterface.state_data[key]).to.be.instanceOf(_rxjs.BehaviorSubject);
    }
  });
});
describe('state data should be parsed correctly', function () {
  it('should be a float/number', function () {
    var testdata = ['mid:-2;x:-200;y:-200;z:-200;mpry:0,0,0;pitch:0;roll:0;yaw:0;vgx:0;vgy:0;vgz:0;templ:44;temph:47;tof:10;h:0;bat:88;baro:138.82;time:0;agx:9.00;agy:0.00;agz:-1000.00;\r\n', {
      address: '192.168.10.1',
      family: 'IPv4',
      port: 8889,
      size: 166
    }];
    tello.StateInterface.parse_state_data(testdata);

    for (var _i3 = 0, _Object$entries3 = Object.entries(tello.StateInterface.get_drone_state()); _i3 < _Object$entries3.length; _i3++) {
      var _Object$entries3$_i = _slicedToArray(_Object$entries3[_i3], 2),
          key = _Object$entries3$_i[0],
          value = _Object$entries3$_i[1];

      expect(tello.StateInterface.state_data[key].getValue()).to.be.a('number');
    }
  });
});
describe('Test sending message', function () {
  this.timeout(2000);
  before(function (done) {
    tello.send_command_with_return("TestCommand");
    setTimeout(done, 1500);
  });
  it('message send should be equal to response', function () {
    expect(tello.response[0]).to.be.equal('TestCommand');
  });
});
describe('Test sending rotation with in range value', function () {
  this.timeout(1000);
  this.beforeEach(function (done) {
    tello.response = null;
    tello.rotate_clockwise(360);
    setTimeout(done, 500);
  });
  it('rotation in range', function (done) {
    expect(tello.response[0]).to.be.equal('cw 360');
    done();
  });
});
describe('Test sending rotation with out of range value', function () {
  this.timeout(1000);
  this.beforeEach(function (done) {
    tello.response = null;
    tello.rotate_clockwise(361);
    setTimeout(done, 500);
  });
  it('rotation out of range', function (done) {
    expect(tello.response).to.be["null"];
    done();
  });
});
describe('Test sending movement with in range value', function () {
  this.timeout(1000);
  this.beforeEach(function (done) {
    tello.response = null;
    tello.move_up(500);
    setTimeout(done, 500);
  });
  it('movement in range', function (done) {
    expect(tello.response[0]).to.be.equal('up 500');
    done();
  });
});
describe('Test sending movement with out of range value', function () {
  this.timeout(1000);
  this.beforeEach(function (done) {
    tello.response = null;
    tello.rotate_clockwise(501);
    setTimeout(done, 500);
  });
  it('movement out of range', function (done) {
    expect(tello.response).to.be["null"];
    done();
  });
});
describe('Test flying', function () {
  it('flying variable should be set to true', function (done) {
    tello.takeoff();
    done();
    expect(tello.IS_FLYING.getValue()).to.be["true"];
    tello.response[0].should.equal('takeoff');
  });
});
describe('Test stream', function () {
  it('stream variable should be set to true', function (done) {
    tello.streamon();
    done();
    expect(tello.STREAM_ON.getValue()).to.be["true"];
    tello.response[0].should.equal('streamon');
  });
});