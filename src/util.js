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
  fromArray: (arr) => (emit, emitError, complete, opts) => {
    opts.onHalt(() => {
      [emit, complete] = [fp.noop, fp.noop];
    });
    emitError = null;
    fp.each((item) => { emit(item, fp.noop); }, arr);
    complete();
  },
  fromPromise: (p) => (emit, error, complete, opts) => {
    opts.onHalt(() => {
      [emit, error, complete] = [fp.noop, fp.noop, fp.noop];
    });
    p.then(
      (item) => emit(item),
      (err) => error(err)
    ).then(complete);
  },
};

function halter(chained) {
  let listeners = [];
  let halted = false;
  function onHalt(fn) {
    listeners.push(fn);
  }

  function halt() {
    halted = true;
    fp.each(l => l(), listeners);
    listeners = [];
  }

  function isHalted() {
    return halted;
  }

  chained.onHalt(halt);

  return { onHalt, halt, isHalted };
}

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
  function subscribe(emit, error, complete, { onHalt = fp.noop } = {}) {
    if (source) {
      source(emit, error, complete, { onHalt });
      return;
    }
    pendingSubscribers = pendingSubscribers || [];
    pendingSubscribers.push([emit, error, complete, { onHalt }]);
  }

  function bind_(aSource) {
    assert(fp.isFunction(aSource), 'Expected a function: ' + aSource);
    assert(!source, 'Source already bound');
    source = aSource;
    if (pendingSubscribers) {
      fp.each((subscriber) => { source(...subscriber); }, pendingSubscribers);
    }
  }

  return { subscribe, bind: bind_ };
}

function boundEmitter(source) {
  function subscribe(emit, error, complete, { onHalt = fp.noop } = {}) {
    source(emit, error, complete, { onHalt });
  }

  return { subscribe };
}

function emitter(thing) {
  const str = fp.isUndefined(thing)
          ? unboundEmitter()
          : boundEmitter(makeSource(thing));
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

module.exports = {
  isEmitter,
  assertEmitter,
  assertEmitterArray,
  assertEmitterProps,
  makeSource,
  emitter,
  bind,
  callbackFor,
  halter,
};
