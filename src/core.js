const _ = require('lodash');
const fp = require('lodash/fp');
const assert = require('sugar').assert;
const Emitter = require('./emitter').Emitter;
const Iterator = require('./iterator').Iterator;
const Observable = require('./observable').Observable;
const Promise = require('bluebird');

//
// Emitter Helpers
//
const isEmitter = (thing) =>
        !!(thing && _.isFunction(thing.subscribe));

const assertEmitter = (thing) => {
  assert(isEmitter(thing), 'Not an Emitter: ' + JSON.stringify(thing));
};

const emitterFn = {
  fromArray: (arr) =>
    (next, error, complete) => {
      error = null;
      fp.each((item) => { next(item); }, arr);
      complete();
    },
  fromPromise: (p) => (next, error, complete) => {
    p.then(next, error).then(complete);
  },
  fromStream: (s) => _.bind(s.subscribe, s),
  fromEventEmitter: (eventEmitter, eventName) =>
    (next) => {
      eventEmitter.on(eventName, next);
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
  if (_.isFunction(thing.onChange)) {
    return (next) => {
      next(thing.value());
      thing.onChange(next);
    };
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

//
// Iterator helpers
//
const iteratorFn = {
  fromArray: (arr) => (next, error, complete) => {
    if (arr.length === 0 && complete) complete();
    else if (next) next(arr.shift());
  },
  fromPromise: (p) => (next, error, complete) => {
    p.then(next, error).then(complete);
  },
};

const makeIteratorFn = (thing) => {
  if (_.isArray(thing)) {
    return iteratorFn.fromArray(thing);
  }
  if (_.isFunction(thing.forward)) {
    return _.bind(thing.forward, thing);
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

const isIterator = (thing) => !!thing.forward;

const iterator = (initFn) => {
  assert(
    _.isUndefined(initFn) || _.isFunction(initFn),
    'Expected a function: ' + initFn);
  return (
    _.isUndefined(initFn)
      ? new Iterator()
      : new Iterator(() => {
        return Promise.try(initFn)
          .then((thing) => makeIteratorFn(thing));
      }));
};

function bind(initFn, iter) {
  iter.bind(() => {
    return Promise.try(initFn)
      .then((thing) => makeIteratorFn(thing));
  });
}

module.exports = { isEmitter, isIterator, iterator, emitter, bind};
