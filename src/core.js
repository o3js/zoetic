const _ = require('lodash');
const fp = require('lodash/fp');
const assert = require('o3-sugar').assert;
const Emitter = require('./emitter').Emitter;
const Iterator = require('./iterator').Iterator;
const Observable = require('./observable').Observable;
const Promise = require('bluebird');

//
// Emitter Helpers
//
const isEmitter = (thing) =>
        !!(thing && _.isFunction(thing.subscribe));

// const assertEmitter = (thing) => {
//   assert(isEmitter(thing), 'Not an Emitter: ' + JSON.stringify(thing));
// };

const emitterFn = {
  fromArray: (arr) =>
    (emit, emitError, complete) => {
      emitError = null;
      fp.each((item) => { emit(item); }, arr);
      complete();
    },
  fromPromise: (p) => (emit, emitError, complete) => {
    p.then(emit, emitError).then(complete);
  },
  fromStream: (s) => _.bind(s.subscribe, s),
  fromEventEmitter: (eventEmitter, eventName) =>
    (emit) => {
      eventEmitter.on(eventName, emit);
    },
};

const makeEmitterFn = (thing) => {
  if (_.isArray(thing)) {
    return emitterFn.fromArray(thing);
  }
  if (_.isFunction(thing.on)) {
    return emitterFn.fromEventEmitter(thing, _.rest(arguments)[0]);
  }
  if (_.isFunction(thing.then)) {
    return emitterFn.fromPromise(thing);
  }
  if (isEmitter(thing)) {
    return emitterFn.fromStream(thing);
  }
  if (_.isFunction(thing)) {
    return thing;
  }
  assert(
    false,
    'Cannot build an emitter from: '
      + JSON.stringify(thing));
  return null;
};

function emitter(thing) {
  const str = _.isUndefined(thing)
          ? new Emitter()
          : new Emitter(makeEmitterFn(thing));
  return str;
}

function observable(initial, thing) {
  return new Observable(initial, emitter(thing));
}
//
// Iterator helpers
//

function push(item, buffer, bindings) {
  if (buffer.length) {
    buffer.push(item);
  }
  if (!buffer.length && !bindings.result) buffer.push(item);
  else if (buffer.length && bindings.result) item = buffer.shift();

  if (bindings.result) {
    if (item[0] === 'result') bindings.result(item[1]);
    else if (item[0] === 'error') bindings.error(item[1]);
    else bindings.complete();
    delete bindings.result;
  }
}

const iteratorFn = {
  fromArray: (arr) => (result, error, complete) => {
    if (arr.length === 0 && complete) complete();
    else result(arr.shift());
  },
  fromPromise: (p) => (result, error, complete) => {
    p.then(result, error).then(complete);
  },
  fromEmitter: (em) => {
    const buffer = [];
    let bindings = {};
    em.subscribe(
      (item) => { push(['result', item], buffer, bindings); },
      (err) => { push(['error', err], buffer, bindings); },
      () => { push([], buffer, bindings); });
    return (result, error, complete) => {
      if (buffer.length) {
        const item = buffer.shift();
        if (item[0] === 'result') result(item[1]);
        else if (item[0] === 'error') error(item[1]);
        else complete();
      } else {
        bindings = { result, error, complete };
      }
    };
  },
};

const makeIteratorFn = (thing) => {
  if (_.isArray(thing)) {
    return iteratorFn.fromArray(thing);
  }
  if (isEmitter(thing)) {
    return iteratorFn.fromEmitter(thing);
  }
  if (_.isFunction(thing.next)) {
    return _.bind(thing.next, thing);
  }
  if (_.isFunction(thing.then)) {
    return iteratorFn.fromPromise(thing);
  }
  if (_.isFunction(thing)) {
    return thing;
  }
  assert(
    false,
    'Cannot build a iterator from: '
      + JSON.stringify(thing));
  return null;
};

const isIterator = (thing) =>
  !!(thing && fp.isFunction(thing.next));

// If iterator() is given a function, this is lazily called and the
// resolved result is used to build the iterator's worker function.
//
// If iterator() is given a promise, we construct an iterator that will
// return a single value: the resolution of the promise.
const iterator = (init) => {
  assert(
    _.isUndefined(init) || _.isFunction(init) || _.isFunction(init.then),
    'Expected a function or promise: ' + init);
  return (
    _.isUndefined(init)
      ? new Iterator()
      : (_.isFunction(init.then)
         ? new Iterator(() => init.then((val) => makeIteratorFn([val])))
         : new Iterator(() => {
           return Promise.try(init)
             .then((thing) => makeIteratorFn(thing));
         })));
};

function boundCallback(str, mapper) {
  assert(!mapper || _.isFunction(mapper),
         'expected a function: ' + JSON.stringify(mapper));
  let n;
  str.bind((next) => {
    n = next;
  }, true);
  return (item) => {
    if (n) {
      n(
        _.isFunction(mapper)
          ? mapper(item)
          : (_.isUndefined(mapper)
             ? item
             : mapper));
    }
  };
}

// eslint-disable-next-line consistent-return
function bind(source, seq) {
  if (!seq) return boundCallback(source);
  if (isEmitter(seq)) {
    seq.bind(makeEmitterFn(source));
  } else if (isIterator(seq)) {
    seq.bind(() => {
      return Promise.try(source)
        .then((thing) => makeIteratorFn(thing));
    });
  }
}

function isStreamy(thing) {
  return isEmitter(thing) || isIterator(thing);
}

function assertIsStreamy(thing) {
  assert(isStreamy(thing), 'Expected a streamy type: ' + thing);
}

/* eslint-disable no-use-before-define */
const maxStacks = 50;
function iteratorEach(iter, item, error, complete, count = 1) {
  iter.next(
    (data) => {
      item(data);
      if (count % maxStacks === 0)
        setTimeout(iteratorEach, 0, iter, item, error, complete);
      else iteratorEach(iter, item, error, complete, count++);
    },
    (err) => {
      error(err);
      if (count % maxStacks === 0)
        setTimeout(iteratorEach, 0, iter, item, error, complete);
      else iteratorEach(iter, item, error, complete, count++);
    },
    complete);
}

function each(...args) {
  const seq = fp.last(args);
  const [n, e = fp.noop, c = fp.noop] = fp.take(args.length - 1, args);
  if (isEmitter(seq)) {
    seq.subscribe(n, e, c);
  } else if (isIterator(seq)) {
    iteratorEach(seq, n, e, c);
  } else {
    assert(false, 'Expected a streamy type: ' + seq);
  }
}

module.exports = {
  isEmitter,
  isIterator,
  isStreamy,
  assertIsStreamy,
  iterator,
  emitter,
  observable,
  bind,
  each,
};
