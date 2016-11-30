class Observable {

  constructor(initialValue, str) {
    const self = this;
    // s.assertStream(str);

    self._currentValue = initialValue;
    self._source = str;

    // Observable is greedy so we don't miss a value change
    str.subscribe(
      (item) => { self._currentValue = item; }
    );
  }

  subscribe(emit, error, complete) {
    const self = this;
    // TODO: only push changes
    emit(self._currentValue);
    return self._source.subscribe(emit, error, complete);
  }

  bind(...args) {
    const self = this;
    self._source.bind(...args);
  }

  current(cb) {
    const self = this;
    cb(self._currentValue);
  }

  currentSync() {
    return this._currentValue;
  }
}

module.exports = { Observable };
