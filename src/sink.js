const fp = require('lodash/fp');

// TODO: should either emit all errors, or halt the source as soon as
//       one error is received

class Sink {

  constructor(source) {
    this.listeners = [];
    this.error = null;
    this.hasError = false;
    this.completed = false;
    this.source = source;
    this.current = null;
    this.hasEmitted = false;
  }

  _halt(listener) {
    // TODO: needs test
    const index = fp.findIndex(listener, this.listeners);
    this.listeners[index] = null;
    fp.defer(() => fp.remove(null, this.listeners));
  }

  _sinkSource() {
    // A listener is marked null to halt during synchronous execution, so
    // we must check its existence before emitting
    this.source.subscribe(
      (item) => {
        if (this.hasError) return;
        this.current = item;
        this.hasEmitted = true;
        fp.each((listener) => listener && listener.emit(item), this.listeners);
      },
      (err) => {
        if (this.hasError) return;
        this.hasError = true;
        this.error = err;
        fp.each((listener) =>
                listener && listener.error(err, fp.noop), this.listeners);
        fp.each((listener) => listener && listener.complete(), this.listeners);
        this.listeners = [];
      },
      () => {
        if (this.hasError) return;
        this.completed = true;
        fp.each((listener) => listener && listener.complete(), this.listeners);
      });
  }

  subscribe(
    emit, error = fp.noop, complete = fp.noop, { onHalt = fp.noop } = {}
  ) {
    if (this.completed) {
      if (this.hasEmitted) emit(this.current, fp.noop);
      complete();
      return;
    }
    if (this.hasError) {
      error(this.error, fp.noop);
      complete();
      return;
    }

    let halted = false;
    const listener = { emit, error, complete };
    onHalt(() => {
      halted = true;
      this._halt(listener);
    });
    if (!halted) {
      this.listeners.push(listener);
      if (this.listeners.length > 1) {
        if (this.hasEmitted) emit(this.current);
      } else {
        this._sinkSource();
      }
    }
  }

}

module.exports = Sink;
