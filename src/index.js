const _ = require('lodash');
const _s = require('sugar');
const fp = require('lodash/fp');
const assert = require('sugar').assert;
const Promise = require('bluebird');
const { iterator, emitter, isIterator, isEmitter } = require('./core');
const transduce = require('./transduce');

const bind = (em, thing) => (
  thing
    ? em.bind(makeEmitterFn(thing), true)
    : boundCallback(em)
);

/* eslint-disable no-use-before-define */
const maxStacks = 50;
function _forwardAll(iter, item, error, complete, count) {
  iter.forward(
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
  if (seq.subscribe) {
    seq.subscribe(n, e, c);
  } else if (seq.forward) {
    forwardAll(seq, n, e, c);
  } else {
    assert(false, 'Invalid type: ' + seq);
  }
}

function propagate(fn, init, seq) {
  if (isEmitter(seq)) {
    return emitter((n, e, c) => {
      init();
      seq.subscribe(...fn(n, e, c));
    });
  }
  if (isIterator(seq)) {
    return iterator(() => {
      init();
      return (n, e, c) => {
        seq.forward(...fn(n, e, c));
      };
    });
  }
  return assert(false, 'Unrecognized sequence type');
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


const seqXF = {
  '@@transducer/init': () => {},
  '@@transducer/result': (result) => {
    result.complete();
  },
  '@@transducer/step': (result, input) => {
    result.next(input);
  },
};

function grease(transducer, seq) {
  let result;
  const xf = transducer(seqXF);
  return propagate(
    (next, error, complete) => {
      result = { next, error, complete };
      return [
        (item) => xf['@@transducer/step'](result, item),
        (err) => error(err),
        () => xf['@@transducer/result'](result),
      ];
    },
    () => { xf['@@transducer/init'](); },
    seq
  );
}

function resolve(xf) {
  return {
    '@@transducer/init': () => xf['@@transducer/init'](),
    '@@transducer/result': (result) => {
      xf['@@transducer/result'](result);
    },
    '@@transducer/step': (result, input) => {
      Promise
        .resolve(input)
        .then(
          (i) => xf['@@transducer/step'](result, i),
          (result && result.error) || _.noop);
    },
  };
}

_.extend(grease, { emitter, collect });

function transducerToOperation(td) {
  const arity = _s.parseParams(td).length;
  const name = td.name;
  const op = function(...args) {
    assert(args.length >= arity, 'Insufficient arguments');
    if (args.length === arity) {
      return td(...args);
    }
    return transduce.propogate(
      [td(fp.take(arity, args))],
      args[arity + 1]);
  };
  op.name = name;
  return op;
}

const ops = fp.mapValues(transducerToOperation, transduce.transducer);

console.log(ops);

module.exports = _.extend(
  ops,
  {
    emitter,
    iterator,
    collect,
    propagate: transduce.propagate,
  }
);
