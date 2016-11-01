// const s = require('./stream');

class Observable {

  constructor(initialValue, str) {
    const self = this;
    // s.assertStream(str);

    self._currentValue = initialValue;
    self._source = str;
    str.subscribe(
      (item) => { self._currentValue = item; }
    );
  }

  subscribe(next, __, complete) {
    const self = this;
    __ = null;
    // TODO: only push changes
    next(self._currentValue);
    return self._source.subscribe(next, null, complete);
  }

  bind(...args) {
    const self = this;
    self._source.bind(...args);
  }

  current(cb) {
    const self = this;
    cb(self._currentValue);
  }
}

module.exports = { Observable };
