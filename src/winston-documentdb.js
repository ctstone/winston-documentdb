const winston = require('winston');
const util = require('util');
const crypto = require('crypto');
const async = require('async');

const DEFAULT_THROUGHPUT = 10000;
const DEFAULT_CONURRENCY = 1;
const HTTP_CONFLICT = 409;
const HTTP_NOT_FOUND = 404;

/**
 * @class
 * @param {DocumentDbOptions} options
 */
exports.DocumentDbLogger = function(options) {
  winston.Transport.call(this, options);
  this._options = options || { };
  this._options.concurrency = this._options.concurrency || DEFAULT_CONURRENCY;
  this._options.collectionThroughput = this._options.collectionThroughput || DEFAULT_THROUGHPUT;
  this._options.defaultTtl = this._options.defaultTtl || null;
  this._options.attachMedia = this._options.attachMedia === false ? false : true;
  this._queue = [];
  this._pending = 0;
  this._initialization = null;
  this._pendingInit = [];
  this._client = this._options.client;
  this._collectionLink = `dbs/${this._options.databaseName}/colls/${this._options.collectionName}`;
};

exports.DocumentDbLogger.prototype.name = 'documentdb';

/**
 * Log an event
 * @param {string} level
 * @param {string} message
 * @param {meta} any
 * @param {Function} callback
 */
exports.DocumentDbLogger.prototype.log = function(level, message, meta, callback) {
  const media = [];
  meta = prepareMeta(this, meta, media);

  /** @type LogEvent */
  const entry = { 
    callback,
    doc: { level, message, meta, time: new Date().getTime() }, 
    media: uniqBy(media, x => x.id),
  };

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

  async.series([
    (next) => init(logger, next),
    (next) => {
      async.waterfall([
        (next) => logger._client.createDocument(logger._collectionLink, entry.doc, next),
        (doc, headers, next) => {
          async.each(entry.media, (media, next) => {
            logger._client.createAttachmentAndUploadMedia(doc._self, media.data, next); // TODO media options like contentType
          }, next);
        }
      ], next);
    },
  ], (err) => {
    setImmediate(() => entry.callback(err, !!err));
    logger._pending -= 1;
    if (logger._queue.length) {
      const next = logger._queue.splice(-1, 1)[0];
      setImmediate(() => writeNext(logger, next, entry.callback));
    }
  });
}

/**
 * 
 * @param {any[]} array 
 * @param {Function} iteratee 
 */
function uniqBy(array, iteratee) {
  return array.filter((a,i,ar) => !ar.slice(i+1).some(b => iteratee(a) === iteratee(b)));
}

/**
 * Recursively handle special types on the meta object
 * @param {DocumentDbLogger} logger 
 * @param {any} obj 
 * @param {any[]} media
 * @param {any[]} seen
 * @returns {any} Input object or a cloned object if any properties were changed
 */
function prepareMeta(logger, obj, mediaFiles, seen) {
  seen = seen || [];
  const ref = seen.find(x => x.obj === obj);

  if (ref) {
    return ref.meta;
  }

  function saw(meta) {
    seen.push({obj: obj, meta });
    return meta;
  }

  if (obj instanceof Error) {
    return saw({ name: obj.name, message: obj.message, stack: obj.stack });
  } else if (Buffer.isBuffer(obj)) {
    const event = {id: hash(obj), data:obj}; // dedupe here?
    logger.emit('media', event);
    if (logger._options.attachMedia) {
      mediaFiles.push(event);
    }
    return saw({ $media: event.id });
  } else if (Array.isArray(obj)) {
    return saw(obj.map(x => prepareMeta(logger, x, mediaFiles, seen)));
  } else if (obj && typeof obj == 'object') {
    const clone = {};
    Object.keys(obj).forEach((x) => clone[x] = prepareMeta(logger, obj[x], mediaFiles, seen));
    return saw(clone);
  } else {
    return obj;
  }
}

/**
 * Perform initialization, or wait for initialization-in-progress
 * @param {DocumentDbLogger} logger 
 * @param {Function} callback 
 */
function init(logger, callback) {
  // complete
  if (logger._initialization === true) {
    callback(null);

  // failed
  } else if (logger._initialization) {
    callback(logger._initialization);

  // pending
  } else if (logger._initialization === false) {
    logger._pendingInit.push(callback);
  
  // do
  } else {
    logger._initialization = false;
    async.series([
      (next) => createDatabaseIfNotExists(logger, next),
      (next) => createCollectionIfNotExists(logger, next),
    ], (err) => {
      logger._initialization = err;
      callback(err);
      logger._pendingInit.forEach((x) => x(err));
      logger._pendingInit.length = 0;
    });
  }
}

/**
 * Create the database if it does not already exist
 * @param {DocumentDbLogger} logger 
 * @param {Function} callback 
 */
function createDatabaseIfNotExists(logger, callback) {
  async.waterfall([
    (next) => databaseExists(logger._client, logger._options.databaseName, next),
    (exists, next) => {
      if (exists) {
        return next(null);
      }
      logger._client.createDatabase({ id: logger._options.databaseName }, (err) => {
        next(err && err.code !== HTTP_CONFLICT ? err : null);
      });
    },
  ], callback);
}

/**
 * Create the collection if it does not already exist
 * @param {DocumentDbLogger} logger 
 * @param {Function} callback 
 */
function createCollectionIfNotExists(logger, callback) {
  const collection = {
    defaultTtl: logger._options.defaultTtl,
    id: logger._options.collectionName,
    partitionKey: logger._options.partitionKey ? { paths: [ logger._options.partitionKey ], kind: 'Hash' } : null,
  };

  const collectionOpts = { offerThroughput: logger._options.collectionThroughput };

  if (!collection.defaultTtl) delete collection.defaultTtl;
  if (!collection.partitionKey) delete collection.partitionKey;

  async.waterfall([
    (next) => collectionExists(logger._client, logger._options.databaseName, logger._options.collectionName, next),
    (exists, next) => {
      if (exists) {
        return next(null);
      }
      logger._client.createCollection(`dbs/${logger._options.databaseName}`, collection, collectionOpts, (err) => {
        next(err && err.code !== HTTP_CONFLICT ? err : null);
      });
    },
  ], callback);
}

/**
 * Determine if database exists
 * @param {DocumentClient} client 
 * @param {string} databaseName 
 * @param {Function} callback 
 */
function databaseExists(client, databaseName, callback) {
  client.readDatabase(`dbs/${databaseName}`, (err, db) => {
    callback(err && err.code === HTTP_NOT_FOUND ? null : err, !!db);
  });
}

/**
 * Determine if collection exists
 * @param {DocumentClient} client 
 * @param {string} databaseName
 * @param {string} collectionName
 * @param {Function} callback 
 */
function collectionExists(client, databaseName, collectionName, callback) {
  client.readCollection(`dbs/${databaseName}/colls/${collectionName}`, (err, coll) => {
    callback(err && err.code === HTTP_NOT_FOUND ? null : err, !!coll);
  });
}

/**
 * Get an MD5 hash for a buffer
 * @param {Buffer} buf 
 * @returns {string} Hex encoding of MD5 hash
 */
function hash(buf) { // TODO options for algo and encoding
  return crypto.createHash('md5').update(buf).digest('hex');
}

/**
 * Register DocumentDb transprot with Winston
 */
exports.registerTransport = function() {
  winston.transports.DocumentDb = exports.DocumentDbLogger;
}

util.inherits(exports.DocumentDbLogger, winston.Transport);
exports.registerTransport();
