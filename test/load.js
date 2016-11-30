/* eslint-disable global-require */

require('chai').use(require('chai-as-promised'));
const mochaBrackets = require('mocha-brackets');

mochaBrackets.load({},
                   [require('./iterator_test'), require('./test')]);
