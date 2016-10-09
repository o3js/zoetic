const _ = require('lodash');
const assert = require('sugar').assert;

let __debug;

function configure(opts) {
  __debug = opts.debug || __debug;
}


function emitNext(subs, item) {
  _.each(_.filter(subs), (sub) => { sub.next(item); });
}

function emitError(subs, err) {
  _.each(_.filter(subs), (sub) => { sub.error(err); });
}

function emitComplete(subs) {
  _.each(_.filter(subs), (sub) => { sub.complete(); });
}

function complete(subs) {
  emitComplete(subs);
  while (subs.length) { subs.pop(); }
}

function startConsuming(stream, subscribers, lazyFn) {
  lazyFn(
    (item) => {
      assert(!stream._completeCalled,
             'Tried to emit on stream after calling complete');
      emitNext(subscribers, item);
    },
    (err) => {
      assert(!stream._completeCalled,
             'Tried to emit error on stream after calling complete');
      emitError(subscribers, err);
    },
    () => {
      assert(!stream._completeCalled,
             'Tried to call complete on stream more than once');
      stream._completeCalled = true;
      complete(subscribers);
    }
  );
}

function tryConsuming(stream) {
  if (!stream._isConsuming && stream._subscribers.length > 0 && stream._lfn) {
    stream._isConsuming = true;
    startConsuming(stream, stream._subscribers, stream._lfn);
  }
}

function subscriber(n, e, c) {
  return {
    next: n,
    complete: c || _.noop,
    error: e || ((err) => { throw err; }),
  };
}

function addSubscriber(subs, n, e, c) {
  const sub = subscriber(n, e, c);
  subs.push(sub);
  return sub;
}

class Emitter {
  constructor(lazyFn) {
    const self = this;
    self._captureStack = __debug ? new Error('Stream created at') : null;
    self._subscribers = [];
    self._isConsuming = false;
    self._lfn = lazyFn;
    self._completeCalled = false;
    return self;
  }

  subscribe(n, e, c) {
    const self = this;
    if (self._isConsuming) {
      if (__debug) {
        // eslint-disable-next-line no-console
        console.error('Stream already active: ', self._captureStack);
      }
    }
    if (self._completeCalled && c) {
      c();
      return _.noop;
    }

    const aSubscriber = addSubscriber(self._subscribers, n, e, c);
    tryConsuming(self);
    return function unsubscribe() {
      // We can't actually mutate the subscribers array at this point
      // because we are likely iterating over it.  So we nullify dead
      // subscribers.  Might want to 'compact', i.e., rid the array of the
      // null trash, at some point?
      self._subscribers[
        _.findIndex(
          self._subscribers,
          (sub) => sub === aSubscriber
        )] = null;
    };
  }

  bind(lfn) {
    const self = this;
    assert(_.isFunction(lfn), 'Expected a function: ' + JSON.stringify(lfn));
    assert(_.isUndefined(self._lfn), 'Emitter is already bound');
    self._lfn = lfn;
    tryConsuming(self);
    return self;
  }
}

module.exports = { Emitter, configure };
