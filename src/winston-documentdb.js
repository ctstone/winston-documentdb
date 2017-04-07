const winston = require('winston');
const util = require('util');
const crypto = require('crypto');

/**
 * @class
 * @param {DocumentDbOptions} options
 */
exports.DocumentDbLogger = function(options) {
  winston.Transport.call(this, options);
  this._options = options || { };
  this._options.concurrency = this._options.concurrency || 1;
  this._options.hashBuffers = this._options.hashBuffers === false ? false : true;
  this._queue = [];
  this._pending = 0;
  this._client = this._options.client;
  this._collectionLink = `dbs/${this._options.databaseName}/colls/${this._options.collectionName}`;
};

/**
 * Log an event
 * @param {string} level
 * @param {string} message
 * @param {meta} any
 * @param {Function} callback
 */
exports.DocumentDbLogger.prototype.log = function(level, message, meta, callback) {
  meta = prepareMeta(this, meta);

  /** @type LogEvent */
  const entry = { doc: { level, message, meta, time: new Date().getTime() }, callback };

  // write immediately
  if (this._pending < this._options.concurrency) {
    writeNext(this, entry);

  // append to queue
  } else {
    this._queue.push(entry);
  }
};

/**
 * Write the next event to DocumentDb store and then process queue, if needed
 * @param {DocumentDbLogger} logger 
 * @param {LogEvent} entry 
 */
function writeNext(logger, entry) {
  logger._pending += 1;
  logger._client.createDocument(logger._collectionLink, entry.doc, (err => {
    setImmediate(() => entry.callback(err, !!err));
    logger._pending -= 1;
    if (logger._queue.length) {
      const next = logger._queue.splice(-1, 1)[0];
      writeNext(logger, next, entry.callback);
    }
  }));
}

/**
 * Recursively handle special types on the meta object
 * @param {DocumentDbLogger} logger 
 * @param {any} obj 
 * @returns {any} same input object or a cloned object if any properties were changed
 */
function prepareMeta(logger, obj) {
  if (obj instanceof Error) {
    return { name: obj.name, message: obj.message, stack: obj.stack };
  } else if (Buffer.isBuffer(obj)) {
    return logger._options.hashBuffers 
      ? { $buffer: hash(obj) }
      : obj;
  } else if (Array.isArray(obj)) {
    return obj.map(x => prepareMeta(logger, x));
  } else if (typeof obj == 'object') {
    const clone = {};
    Object.keys(obj).forEach((x) => clone[x] = prepareMeta(logger, obj[x]));
    return clone;
  } else {
    return obj;
  }
}

/**
 * Get an MD5 hash for a buffer
 * @param {Buffer} buf 
 * @returns {string} Hex encoding of MD5 hash
 */
function hash(buf) { // TODO options for algo and encoding
  return crypto.createHash('md5').update(buf).digest('hex');
}

util.inherits(exports.DocumentDbLogger, winston.Transport);