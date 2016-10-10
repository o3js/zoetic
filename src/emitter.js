const _ = require('lodash');
const assert = require('sugar').assert;

let __debug;

function configure(opts) {
  __debug = opts.debug || __debug;
}


function doEmit(subs, item) {
  _.each(_.filter(subs), (sub) => { sub.emit(item, sub.unsub); });
}

function doError(subs, err) {
  _.each(_.filter(subs), (sub) => { sub.emitError(err, sub.unsub); });
}

function doComplete(subs) {
  _.each(_.filter(subs), (sub) => { sub.complete(); });
  while (subs.length) { subs.pop(); }
}

function startConsuming(stream, subscribers, lazyFn) {
  lazyFn(
    (item) => {
      assert(!stream._completeCalled,
             'Tried to emit on stream after calling complete');
      doEmit(subscribers, item);
    },
    (err) => {
      assert(!stream._completeCalled,
             'Tried to emit error on stream after calling complete');
      doError(subscribers, err);
    },
    () => {
      assert(!stream._completeCalled,
             'Tried to call complete on stream more than once');
      stream._completeCalled = true;
      doComplete(subscribers);
    }
  );
}

function tryConsuming(stream) {
  if (!stream._isConsuming && stream._subscribers.length > 0 && stream._lfn) {
    stream._isConsuming = true;
    startConsuming(stream, stream._subscribers, stream._lfn);
  }
}

function subscriber(em, er, c, unsub) {
  return {
    emit: em,
    complete: c || _.noop,
    error: er || ((err) => { throw err; }),
    unsub,
  };
}

function addSubscriber(subs, em, er, c) {
  function unsub() {
    // We can't actually mutate the subscribers array at this point
    // because we are likely iterating over it.  So we nullify dead
    // subscribers.  Might want to 'compact', i.e., rid the array of the
    // null trash, at some point?

    // eslint-disable-next-line no-use-before-define
    subs[_.findIndex(subs, (s) => s === sub)] = null;
  }

  const sub = subscriber(em, er, c, unsub);

  subs.push(sub);
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

  subscribe(emit, emitError, complete) {
    const self = this;
    if (self._isConsuming) {
      if (__debug) {
        // eslint-disable-next-line no-console
        console.error('Stream already active: ', self._captureStack);
      }
    }
    if (self._completeCalled && complete) {
      complete();
    }

    addSubscriber(self._subscribers, emit, emitError, complete);
    tryConsuming(self);
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
