const fp = require('lodash/fp');
const assert = require('assert');

class Iterator {
  constructor(lazyInit) {
    this._lazyInit = lazyInit;
    this._initializationError = null;
    this._outstanding = 0;

    this._next = fp.bind(this._next, this);
    this._error = fp.bind(this._error, this);
    this._complete = fp.bind(this._complete, this);
  }

  _next(item) {
    this._outstanding -= 1;
    this._n(item);
  }

  _error(err) {
    this._outstanging -= 1;
    this._e(err);
  }

  _complete() {
    this._outstanging -= 1;
    this._c();
  }

  forward(next, error, complete) {
    // We could have made subsequent calls wait, but I can't yet think of
    // why you'd want to synchronously call forward multiple times.
    assert(
      this._outstanding === 0,
      'Iterator can\'t be called twice before returning');

    // initialize callbacks
    this._outstanding += 1;
    this._n = next || fp.noop;
    this._e = error || fp.noop;
    this._c = complete || fp.noop;
    [next, error, complete] = [null, null, null];

    if (this._initializationError) this._complete();

    if (this._fn) {
      this._fn(this._next, this._error, this._complete);
    } else {
      this
        ._lazyInit()
        .then(
          (fn) => {
            this._fn = fn;
            fn(this._next, this._error, this._complete);
          },
          (err) => {
            this._error(err);
            this._initializationError = err;
          });
    }
  }

  bind(lazyInit) {
    assert(!this._lazyInit, 'Iterator may not be bound twice');
    this._lazyInit = lazyInit;
  }

}

module.exports = { Iterator };
