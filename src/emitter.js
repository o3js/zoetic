const _ = require('lodash');
const assert = require('o3-sugar').assert;

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

function startConsuming(emitter, subscribers, lazyFn) {
  lazyFn(
    (item) => {
      assert(!emitter._completeCalled,
             'Tried to emit after calling complete');
      doEmit(subscribers, item);
    },
    (err) => {
      assert(!emitter._completeCalled,
             'Tried to emit an error on emitter after calling complete');
      doError(subscribers, err);
    },
    () => {
      assert(!emitter._completeCalled,
             'Tried to call complete on emitter more than once');
      emitter._completeCalled = true;
      doComplete(subscribers);
    }
  );
}

function tryConsuming(emitter) {
  if (!emitter._isConsuming
      && emitter._subscribers.length > 0
      && emitter._sourceFn) {
    emitter._isConsuming = true;
    startConsuming(emitter, emitter._subscribers, emitter._sourceFn);
  }
}

function subscriber(em, er, c, unsub) {
  return {
    emit: em,
    complete: c || _.noop,
    emitError: er || ((err) => { throw err; }),
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
  constructor(sourceFn) {
    const self = this;
    self._captureStack = __debug ? new Error('Stream created at') : null;
    self._subscribers = [];
    self._isConsuming = false;
    self._sourceFn = sourceFn;
    self._completeCalled = false;
    return self;
  }

  subscribe(emit = _.noop, emitError = _.noop, complete = _.noop) {
    const self = this;
    if (self._completeCalled && complete) {
      complete();
    }

    addSubscriber(self._subscribers, emit, emitError, complete);
    tryConsuming(self);
  }

  bind(sourceFn) {
    const self = this;
    assert(
      _.isFunction(sourceFn),
      'Expected a function: ' + JSON.stringify(sourceFn));
    assert(
      _.isUndefined(self._sourceFn),
      'Emitter is already bound');
    self._sourceFn = sourceFn;
    tryConsuming(self);
    return self;
  }
}

module.exports = { Emitter, configure };
