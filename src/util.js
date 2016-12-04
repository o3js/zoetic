const Emitter = require('./emitter').Emitter;
const Observable = require('./observable').Observable;
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

const source = {
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
    return source.fromEmitter(thing);
  }
  if (fp.isArray(thing)) {
    return source.fromArray(thing);
  }
  if (fp.isFunction(thing.on)) {
    return source.fromEventEmitter(thing, rest[0]);
  }
  if (fp.isFunction(thing.then)) {
    return source.fromPromise(thing);
  }
  assert(
    false,
    'Cannot build an emitter source from: '
      + JSON.stringify(thing));
  return null;
}

function emitter(thing) {
  const str = fp.isUndefined(thing)
          ? new Emitter()
          : { subscribe: makeSource(thing) };
  return str;
}

function observable(initial, thing) {
  return new Observable(initial, emitter(thing));
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

function bind(em, thing) {
  if (!thing) {
    // DEPRECATED
    // eslint-disable-next-line no-console
    console.error(
      'bind() w/o second argument is deprecated. Use callbackFor().',
      new Error());
    return callbackFor(em);
  }

  return em.bind(makeSource(thing), true);
}

module.exports = {
  isEmitter,
  assertEmitter,
  assertEmitterArray,
  assertEmitterProps,
  makeSource,
  emitter,
  observable,
  bind,
  callbackFor,
};
