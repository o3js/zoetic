const _ = require('lodash');
const _s = require('sugar');
const fp = require('lodash/fp');
const assert = require('sugar').assert;
const Promise = require('bluebird');
const { iterator, emitter, isIterator, isEmitter } = require('./core');
const transduce = require('./transduce');

/* eslint-disable no-use-before-define */
const maxStacks = 50;
function _forwardAll(iter, item, error, complete, count) {
  iter.next(
    (data) => {
      item(data);
      if (count % maxStacks === 0)
        setTimeout(_forwardAll, 0, iter, item, error, complete, 1);
      else _forwardAll(iter, item, error, complete, count++);
    },
    (err) => {
      error(err);
      if (count % maxStacks === 0)
        setTimeout(_forwardAll, 0, iter, item, error, complete, 1);
      else _forwardAll(iter, item, error, complete, count++);
    },
    complete);
}

function forwardAll(iter, item, error, complete) {
  error = error || ((err) => { throw err; });
  _forwardAll(iter, item, error, complete, 1);
}

function each(n, e, c, seq) {
  if (isEmitter(seq)) {
    seq.subscribe(n, e, c);
  } else if (isIterator(seq)) {
    forwardAll(seq, n, e, c);
  } else {
    assert(false, 'Invalid type: ' + seq);
  }
}

const collect = (seq) => new Promise(
  (resolve, reject) => {
    const items = [];
    each(
      (item) => { items.push(item); },
      (err) => { reject(err); reject = _.noop; },
      () => { resolve(items); },
      seq);
  });

function transducerToOperation(td) {
  const arity = _s.parseParams(td).length;
  const name = td.name;
  const op = function(...args) {
    assert(
      args.length >= arity,
      'Insufficient arguments, expected at least ' + arity);
    if (args.length === arity) {
      return td(...args);
    }
    return transduce.propagate(
      td(...fp.take(arity, args)),
      args[arity]);
  };
  op.name = name;
  return op;
}

const ops = fp.mapValues(transducerToOperation, transduce.transducer);

module.exports = _.extend(
  ops,
  {
    emitter,
    iterator,
    collect,
    comp: transduce.comp,
    propagate: transduce.propagate,
  }
);
