const fp = require('lodash/fp');

class Observable {

  constructor(initialValue, em) {
    const self = this;
    // s.assertStream(em);

    self._currentValue = initialValue;
    self._lastEmitted = initialValue;
    self._source = em;

    // Observable is greedy so we don't miss a value change
    em.subscribe(
      (item) => { self._currentValue = item; },
      fp.noop,
      fp.noop
    );
  }

  subscribe(emit, error, complete) {
    const self = this;
    // TODO: only push changes
    emit(self._currentValue);
    return self._source.subscribe(
      (item, unsub) => {
        // if (fp.equals(self._lastEmitted, item)) return;
        self._lastEmitted = item;
        emit(item, unsub);
      },
      error, complete);
  }

  bind(...args) {
    const self = this;
    self._source.bind(...args);
  }

  current() {
    const self = this;
    return self._currentValue;
  }

  currentSync() {
    return this._currentValue;
  }
}

module.exports = { Observable };
