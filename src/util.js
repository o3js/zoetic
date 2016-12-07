const assert = require('o3-sugar').assert;
const fp = require('lodash/fp');

function isEmitter(thing) {
  return !!(thing && fp.isFunction(thing.subscribe));
}

const assertEmitter = (thing) => {
  assert(isEmitter(thing), 'Not a stream: ' + JSON.stringify(thing));
};

const assertEmitterArray = (things) => {
  assert(fp.isArray(things), 'Not an array: ' + JSON.stringify(things));
  fp.each(assertEmitter, things);
};

const assertEmitterProps = (things) => {
  assert(
    fp.isObject(things),
    'Not an object: ' + JSON.stringify(things));
  fp.each(assertEmitter, things);
};

const sourceHelpers = {
  fromEmitter: (em) => fp.bind(em.subscribe, em),
  fromArray: (arr) => (emit, emitError, complete) => {
    emitError = null;
    fp.each((item) => { emit(item, fp.noop); }, arr);
    complete();
  },
  fromPromise: (p) => (emit, emitError, complete) => {
    p.then(
      (item) => emit(item, fp.noop),
      (err) => emitError(err, fp.noop)
    ).then(complete);
  },
  fromEventEmitter: (eventEmitter, eventName) =>
    (emit) => {
      eventEmitter.addListener(
        eventName,
        function emitEvent(evt) {
          emit(evt, () => { eventEmitter.removeListener(emitEvent); });
        });
    },
};

function makeSource(thing, ...rest) {
  if (fp.isFunction(thing)) {
    return thing;
  }
  if (isEmitter(thing)) {
    return sourceHelpers.fromEmitter(thing);
  }
  if (fp.isArray(thing)) {
    return sourceHelpers.fromArray(thing);
  }
  if (fp.isFunction(thing.on)) {
    return sourceHelpers.fromEventEmitter(thing, rest[0]);
  }
  if (fp.isFunction(thing.then)) {
    return sourceHelpers.fromPromise(thing);
  }
  assert(
    false,
    'Cannot build an emitter source from: '
      + JSON.stringify(thing));
  return null;
}

function unboundEmitter() {
  let source = null;
  let pendingSubscribers = null;
  function subscribe(emit, error, complete) {
    if (source) {
      source(emit, error, complete);
      return;
    }
    pendingSubscribers = pendingSubscribers || [];
    pendingSubscribers.push([emit, error, complete]);
  }

  function bind_(aSource) {
    assert(!source, 'source already bound');
    source = aSource;
    if (pendingSubscribers) {
      fp.each((subscriber) => { source(...subscriber); }, pendingSubscribers);
    }
  }

  return { subscribe, bind: bind_ };
}

function emitter(thing) {
  const str = fp.isUndefined(thing)
          ? unboundEmitter()
          : { subscribe: makeSource(thing) };
  return str;
}

function callbackFor(em, mapper) {
  assert(!mapper || fp.isFunction(mapper),
         'expected a function: ' + JSON.stringify(mapper));
  let emitCb;
  em.bind((emit_) => {
    emitCb = emit_;
  }, true);
  return (item) => {
    if (emitCb) {
      emitCb(
        fp.isFunction(mapper)
          ? mapper(item)
          : (fp.isUndefined(mapper)
             ? item
             : mapper));
    }
  };
}

function bind(thing, em) {
  return em.bind(makeSource(thing), true);
}

function listen(eventName, em = emitter()) {
  return (el, onRelease = fp.noop) => {
    em.bind((emit, error, complete) => {
      error = null;
      onRelease(() => {
        em = null;
        complete();
      });
      el.addEventListener(eventName, function listener(evt) {
        emit(evt, () => em.removeListener(eventName, listener));
      });
    });
    return em;
  };
}

module.exports = {
  isEmitter,
  assertEmitter,
  assertEmitterArray,
  assertEmitterProps,
  makeSource,
  emitter,
  bind,
  callbackFor,
  listen,
};
