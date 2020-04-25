/** How to minify manually (who needs bundlers anyway?):
 * - download https://requirejs.org/docs/release/2.3.6/r.js
 * - run "node r.js -o baseUrl=. name=main out=peaks.js optimize=none" in this directory
 * - uglify online: https://skalman.github.io/UglifyJS-online/
 * - add to lib.js
 */

/**
 * @file
 *
 * Defines the {@link Peaks} class.
 *
 * @module main
 */

define([
  './eventemitter2',
  './waveform-points',
  './player',
  './marker-factories',
  './view-controller',
  './zoom-controller',
  './waveform-builder',
  './utils'
], function(
    EventEmitter,
    WaveformPoints,
    Player,
    MarkerFactories,
    ViewController,
    ZoomController,
    WaveformBuilder,
    Utils) {
  'use strict';

  function buildUi(container) {
    return {
      player:   container.querySelector('.waveform'),
      zoomview: container.querySelector('.zoom-container')
    };
  }

  /**
   * Initialises a new Peaks instance with default option settings.
   *
   * @class
   * @alias Peaks
   *
   * @param {Object} opts Configuration options
   */

  function Peaks() {
    EventEmitter.call(this, { wildcard: true });

    this.options = {

      /**
       * Array of scale factors (samples per pixel) for the zoom levels
       * (big >> small)
       */
      zoomLevels:            [512, 1024, 2048, 4096],

      /**
       * Data URI where to get the waveform data.
       *
       * If a string, we assume that `this.dataUriDefaultFormat` is the default
       * `xhr.responseType` value.
       *
       * @since 0.0.1
       *
       * ```js
       * dataUri: 'url/to/data.json?waveformId=1337'
       * ```
       *
       * If an object, each key is an `xhr.responseType` which will contain its
       * associated source URI.
       *
       * @since 0.3.0
       *
       * ```js
       * dataUri: {
       *   arraybuffer: 'url/to/data.dat',
       *   json: 'url/to/data.json'
       * }
       * ```
       */
      dataUri:               null,

      /**
       * Will be used as a `xhr.responseType` if `dataUri` is a string, and not
       * an object. Here for backward compatibility purpose only.
       *
       * @since 0.3.0
       */
      dataUriDefaultFormat:  'json',

      /**
       * If true, all ajax requests (e.g. to fetch waveform data) will be made
       * with credentials (i.e. browser-controlled cookies).
       *
       * @type {Boolean}
       */
      withCredentials: false,

      /**
       * Pre-fetched / local waveform data to build the waveforms with
       *
       * Only one source is required
       *
       * ```js
       * waveformData: {
       *   arraybuffer: ArrayBuffer,
       *   json: Object
       * }
       * ```
       */
      waveformData:               null,

      /**
       * Will report errors to that function
       *
       * @type {Function=}
       * @since 0.4.4
       */
      logger:                null,

      /**
       * Deprecation messages logger.
       *
       * @type {Function}
       * @since 0.4.8
       */
      // eslint-disable-next-line no-console
      deprecationLogger:     console.log.bind(console),

      /**
       * Colour for the zoomed in waveform
       */
      zoomWaveformColor:     'rgba(0, 225, 128, 1)',

      /**
       * Height of the waveform canvases in pixels
       */
      height:                200,

      /**
       *
       */
      template:              [
        '<div class="waveform">',
        '<div class="zoom-container"></div>',
        '</div>'
      ].join(''),

      /**
       * An object containing an AudioContext, used when creating waveform data
       * using the Web Audio API
       */

      webAudio: null,

      /**
       * Use animation on zoom
       */
      zoomAdapter: 'static',

      /**
       * Point/Segment marker customisation.
       *
       * @todo This part of the API is not stable.
       */
      createPointMarker:   MarkerFactories.createPointMarker
    };

    /**
     * Asynchronous errors logger.
     *
     * @type {Function}
     */
    // eslint-disable-next-line no-console
    this.logger = console.error.bind(console);

    return this;
  }

  Peaks.prototype = Object.create(EventEmitter.prototype);

  /**
   * Creates and initialises a new Peaks instance with the given options.
   *
   * @param {Object} opts Configuration options
   *
   * @return {Peaks}
   */

  Peaks.init = function(opts, callback) {
    var instance = new Peaks();

    opts = opts || {};

    var err = instance._setOptions(opts);

    if (err) {
      callback(err);
      return;
    }

    /*
     Setup the layout
     */

    var containers = null;

    if (typeof instance.options.template === 'string') {
      opts.container.innerHTML = instance.options.template;

      containers = buildUi(instance.options.container);
    }
    else if (Utils.isHTMLElement(instance.options.template)) {
      this.container.appendChild(instance.options.template);

      containers = buildUi(instance.options.container);
    }
    else if (instance.options.containers) {
      containers = instance.options.containers;
    }
    else {
      // eslint-disable-next-line max-len
      callback(new TypeError('Peaks.init(): The template option must be a valid HTML string or a DOM object'));
      return;
    }

    var zoomviewContainer = containers.zoomview || containers.zoom;

    if (!Utils.isHTMLElement(zoomviewContainer)) {
      // eslint-disable-next-line max-len
      callback(new TypeError('Peaks.init(): The containers.zoomview and/or containers.overview options must be valid HTML elements'));
      return;
    }

    if (zoomviewContainer && zoomviewContainer.clientWidth <= 0) {
      // eslint-disable-next-line max-len
      callback(new TypeError('Peaks.init(): Please ensure that the zoomview container is visible and has non-zero width'));
      return;
    }

    instance.player = new Player(instance, instance.options.mediaElement);
    instance.points = new WaveformPoints(instance);
    instance.zoom = new ZoomController(instance, instance.options.zoomLevels);
    instance.views = new ViewController(instance);

    // Setup the UI components
    var waveformBuilder = new WaveformBuilder(instance);

    waveformBuilder.init(instance.options, function(err, waveformData) {
      if (err) {
        if (callback) {
          callback(err);
        }

        return;
      }

      instance._waveformData = waveformData;

      if (zoomviewContainer) {
        instance.views.createZoomview(zoomviewContainer);
      }

      instance._addWindowResizeHandler();

      if (instance.options.points) {
        instance.points.add(instance.options.points);
      }

      // Allow applications to attach event handlers before emitting events,
      // when initialising with local waveform data.

      setTimeout(function() {
        instance.emit('peaks.ready');
      }, 0);

      if (callback) {
        callback(null, instance);
      }
    });

    return instance;
  };

  Peaks.prototype._setOptions = function(opts) {
    // eslint-disable-next-line no-console
    opts.deprecationLogger = opts.deprecationLogger || console.log.bind(console);

    if (opts.audioElement) {
      opts.mediaElement = opts.audioElement;
      // eslint-disable-next-line max-len
      opts.deprecationLogger('Peaks.init(): The audioElement option is deprecated, please use mediaElement instead');
    }

    if (!opts.mediaElement) {
      return new Error('Peaks.init(): Missing mediaElement option');
    }

    if (!(opts.mediaElement instanceof HTMLMediaElement)) {
      // eslint-disable-next-line max-len
      return new TypeError('Peaks.init(): The mediaElement option should be an HTMLMediaElement');
    }

    if (!opts.container && !opts.containers) {
      // eslint-disable-next-line max-len
      return new Error('Peaks.init(): Please specify either a container or containers option');
    }
    else if (Boolean(opts.container) === Boolean(opts.containers)) {
      // eslint-disable-next-line max-len
      return new Error('Peaks.init(): Please specify either a container or containers option, but not both');
    }

    if (opts.template && opts.containers) {
      // eslint-disable-next-line max-len
      return new Error('Peaks.init(): Please specify either a template or a containers option, but not both');
    }

    // The 'containers' option overrides 'template'.
    if (opts.containers) {
      opts.template = null;
    }

    if (opts.logger && !Utils.isFunction(opts.logger)) {
      // eslint-disable-next-line max-len
      return new TypeError('Peaks.init(): The logger option should be a function');
    }

    if (opts.points && !Array.isArray(opts.points)) {
      // eslint-disable-next-line max-len
      return new TypeError('Peaks.init(): options.points must be an array of point objects');
    }

    Utils.extend(this.options, opts);

    if (!Array.isArray(this.options.zoomLevels)) {
      return new TypeError('Peaks.init(): The zoomLevels option should be an array');
    }
    else if (this.options.zoomLevels.length === 0) {
      return new Error('Peaks.init(): The zoomLevels array must not be empty');
    }
    else {
      if (!Utils.isInAscendingOrder(this.options.zoomLevels)) {
        return new Error('Peaks.init(): The zoomLevels array must be sorted in ascending order');
      }
    }

    if (opts.logger) {
      this.logger = opts.logger;
    }

    return null;
  };

  /**
   * Remote waveform data options for [Peaks.setSource]{@link Peaks#setSource}.
   *
   * @typedef {Object} RemoteWaveformDataOptions
   * @global
   * @property {String=} arraybuffer
   * @property {String=} json
   */

  /**
   * Local waveform data options for [Peaks.setSource]{@link Peaks#setSource}.
   *
   * @typedef {Object} LocalWaveformDataOptions
   * @global
   * @property {ArrayBuffer=} arraybuffer
   * @property {Object=} json
   */

  /**
   * Web Audio options for [Peaks.setSource]{@link Peaks#setSource}.
   *
   * @typedef {Object} WebAudioOptions
   * @global
   * @property {AudioContext} audioContext
   * @property {AudioBuffer=} audioBuffer
   * @property {Boolean=} multiChannel
   */

  /**
   * Options for [Peaks.setSource]{@link Peaks#setSource}.
   *
   * @typedef {Object} PeaksSetSourceOptions
   * @global
   * @property {String} mediaUrl
   * @property {RemoteWaveformDataOptions=} dataUri
   * @property {LocalWaveformDataOptions=} waveformData
   * @property {WebAudioOptions=} webAudio
   * @property {Boolean=} withCredentials
   * @property {Array<Number>=} zoomLevels
   */

  /**
   * Changes the audio or video media source associated with the {@link Peaks}
   * instance.
   *
   * @param {PeaksSetSourceOptions} options
   * @param {Function} callback
   */

  Peaks.prototype.setSource = function(options, callback) {
    var self = this;

    if (!options.mediaUrl) {
      callback(new Error('peaks.setSource(): options must contain a mediaUrl'));
      return;
    }

    function reset() {
      self.removeAllListeners('player_canplay');
      self.removeAllListeners('player_error');
    }

    function playerErrorHandler(err) {
      reset();

      // Return the MediaError object from the media element
      callback(err);
    }

    function playerCanPlayHandler() {
      reset();

      if (!options.zoomLevels) {
        options.zoomLevels = self.options.zoomLevels;
      }

      var waveformBuilder = new WaveformBuilder(self);

      waveformBuilder.init(options, function(err, waveformData) {
        if (err) {
          callback(err);
          return;
        }

        self._waveformData = waveformData;

        ['zoomview'].forEach(function(viewName) {
          var view = self.views.getView(viewName);

          if (view) {
            view.setWaveformData(waveformData);
          }
        });

        self.zoom.setZoomLevels(options.zoomLevels);

        callback();
      });
    }

    self.once('player_canplay', playerCanPlayHandler);
    self.once('player_error', playerErrorHandler);

    self.player.setSource(options.mediaUrl);
  };

  Peaks.prototype.getWaveformData = function() {
    return this._waveformData;
  };

  Peaks.prototype._addWindowResizeHandler = function() {
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  };

  Peaks.prototype._onResize = function() {
    this.emit('window_resize');
  };

  Peaks.prototype._removeWindowResizeHandler = function() {
    window.removeEventListener('resize', this._onResize);
  };

  /**
   * Cleans up a Peaks instance after use.
   */

  Peaks.prototype.destroy = function() {
    this._removeWindowResizeHandler();

    if (this.views) {
      this.views.destroy();
    }

    if (this.player) {
      this.player.destroy();
    }
  };

  return Peaks;
});