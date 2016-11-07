const fp = require('lodash/fp');
const assert = require('assert');

let name = 0;

class Iterator {
  constructor(lazyInit) {
    this._name = name++;
    this._stack = new Error().stack;
    this._lazyInit = lazyInit;
    this._initializationError = null;
    this._outstanding = 0;

    this._result = fp.bind(this._result, this);
    this._error = fp.bind(this._error, this);
    this._complete = fp.bind(this._complete, this);
  }

  _result(item) {
    assert(
      this._outstanding === 1,
      'Illegal item -- terator function has already called back');
    this._outstanding -= 1;
    this._r(item);
  }

  _error(err) {
    assert(
      this._outstanding === 1,
      'Illegal err - iterator function has already called back');
    this._outstanding -= 1;
    this._e(err);
  }

  _complete() {
    assert(
      this._outstanding === 1,
      'Illegal complete - iterator function has already called back');
    this._outstanding -= 1;
    this._c();
  }

  next(result, error, complete) {
    // We could have made subsequent calls wait, but I can't yet think of
    // why you'd want to synchronously call forward multiple times.
    assert(
      this._outstanding === 0,
      'Iterator can\'t be called twice before returning');

    // initialize callbacks
    this._outstanding += 1;
    this._r = result || fp.noop;
    this._e = error || fp.noop;
    this._c = complete || fp.noop;
    [result, error, complete] = [null, null, null];

    if (this._initializationError) {
      this._complete();
      return;
    }

    if (this._fn) {
      this._fn(this._result, this._error, this._complete);
    } else {
      this
        ._lazyInit()
        .then(
          (fn) => {
            this._happy = true;
            this._fn = fn;
            fn(this._result, this._error, this._complete);
          },
          (err) => {
            this._initializationError = err;
            this._error(err);
          });
    }
  }

  bind(lazyInit) {
    assert(!this._lazyInit, 'Iterator may not be bound twice');
    this._lazyInit = lazyInit;
  }

}

module.exports = { Iterator };
