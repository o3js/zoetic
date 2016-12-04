const fp = require('lodash/fp');
const Emitter = require('./emitter').Emitter;

class Observable {

  constructor(initialValue, em) {
    const self = this;
    // s.assertStream(em);

    self._listeners = [];
    self._currentValue = initialValue;
    self._source = em;
    self._completed = false;

    let emitted = false;

    // Observable is greedy so we don't miss a value change
    self._ee = new Emitter((emit, error, complete) => {
      em.subscribe(
        (item) => {
          if (emitted && fp.equals(self._currentValue, item)) return;
          emitted = true;
          self._currentValue = item;
          emit(item);
        },
        error,
        () => {
          self._completed = true;
          complete();
        }
      );
    });
  }

  subscribe(emit = fp.noop, error = fp.noop, complete = fp.noop) {
    emit(this._currentValue);
    if (this._completed) {
      complete();
      return;
    }
    this._ee.subscribe(emit, error, complete);
  }

  current() {
    return this._currentValue;
  }

  currentSync() {
    return this._currentValue;
  }
}

module.exports = { Observable };
