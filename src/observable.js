const fp = require('lodash/fp');
const { startWith, changes } = require('./transforms');

class Observable {

  constructor(initial, source) {
    this.listeners = [];
    this.error = null;
    this.hasError = false;
    this.completed = false;

    changes(startWith(initial, source)).subscribe(
      (item) => {
        if (this.hasError) return;
        this.current = item;
        fp.each((listener) => listener.emit(item), this.listeners);
      },
      (err) => {
        if (this.hasError) return;
        this.hasError = true;
        this.error = err;
        fp.each((listener) => listener.error(err, fp.noop), this.listeners);
        fp.each((listener) => listener.complete(), this.listeners);
        this.listeners = [];
      },
      () => {
        if (this.hasError) return;
        this.completed = true;
        fp.each((listener) => listener.complete(), this.listeners);
      });
  }

  _unsubscribe(listener) {
    fp.defer(() => fp.remove(listener, this.listeners));
  }

  subscribe(
    emit, error = fp.noop, complete = fp.noop, { onHalt = fp.noop } = {}
  ) {
    if (this.completed) {
      emit(this.current, fp.noop);
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
      this._unsubscribe(listener);
    });
    if (!halted) {
      this.listeners.push(listener);
      emit(this.current, () => {
        fp.defer(() => fp.remove(listener, this.listeners));
      });
    }
  }

}

module.exports = Observable;
