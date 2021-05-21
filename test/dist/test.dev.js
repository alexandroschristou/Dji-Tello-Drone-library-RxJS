"use strict";

var _mocha = require("rxjs-marbles/mocha");

var _operators = require("rxjs/operators");

//const marbles = () => require('rxjs-marbles/mocha');
//const map = () => require('rxjs/operators')
describe("rxjs-marbles", function () {
  it("should support marble tests", (0, _mocha.marbles)(function (m) {
    var source = m.hot("--^-a-b-c-|");
    var subs = "^-------!";
    var expected = "--b-c-d-|";
    var destination = source.pipe((0, _operators.map)(function (value) {
      return String.fromCharCode(value.charCodeAt(0) + 1);
    }));
    m.expect(destination).toBeObservable(expected);
    m.expect(source).toHaveSubscriptions(subs);
  }));
});