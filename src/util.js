const Emitter = require('./emitter').Emitter;
const Observable = require('./observable').Observable;
const assert = require('o3-sugar').assert;
const fp = require('lodash/fp');

const source = {
  fromEmitter: (em) => fp.bind(em.subscribe, em),
  fromArray: (arr) => (emit, emitError, complete) => {
    emitError = null;
    fp.each((item) => { emit(item); }, arr);
    complete();
    return fp.noop;
  },
  fromPromise: (p) => (emit, emitError, complete) => {
    p.then(emit, emitError).then(complete);
    return fp.noop;
  },
  fromEventEmitter: (eventEmitter, eventName) =>
    (emit) => {
      eventEmitter.on(eventName, emit);
      return () => {
        eventEmitter.off(emit);
      };
    },
};


function isEmitter(thing) {
  return !!(thing && fp.isFunction(thing.subscribe));
}

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
          : new Emitter(makeSource(thing));
  return str;
}

function observable(initial, thing) {
  return new Observable(initial, emitter(thing));
}

module.exports = {
  isEmitter,
  makeSource,
  emitter,
  observable,
};
