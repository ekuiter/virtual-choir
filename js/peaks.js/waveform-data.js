(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.WaveformData = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

/**
 * ArrayBuffer adapter consumes binary waveform data.
 * It is used as a data abstraction layer by `WaveformData`.
 *
 * This is supposed to be the fastest adapter ever:
 * * **Pros**: working directly in memory, everything is done by reference
 *   (including the offsetting)
 * * **Cons**: binary data are hardly readable without data format knowledge
 *   (and this is why this adapter exists).
 *
 * @param {ArrayBuffer} buffer
 * @constructor
 */

function WaveformDataArrayBufferAdapter(buffer) {
  this._data = new DataView(buffer);
  this._offset = this.version === 2 ? 24 : 20;
}

/**
 * Detects if a set of data is suitable for the ArrayBuffer adapter.
 * It is used internally by `WaveformData.create` so you should not bother using it.
 *
 * @static
 * @param {Mixed} data
 * @returns {boolean}
 */

WaveformDataArrayBufferAdapter.isCompatible = function isCompatible(data) {
  const isCompatible = data && typeof data === "object" && "byteLength" in data;

  if (isCompatible) {
    const view = new DataView(data);
    const version = view.getInt32(0, true);

    if (version !== 1 && version !== 2) {
      throw new TypeError("This waveform data version not supported.");
    }
  }

  return isCompatible;
};

/**
 * @namespace WaveformDataArrayBufferAdapter
 */

 WaveformDataArrayBufferAdapter.prototype = {
  /**
   * Returns the data format version number.
   *
   * @return {Integer} Version number of the consumed data format.
   */

  get version() {
    return this._data.getInt32(0, true);
  },

  /**
   * Returns the number of bits per sample, either 8 or 16.
   */

  get bits() {
    var bits = Boolean(this._data.getUint32(4, true));

    return bits ? 8 : 16;
  },

  /**
   * Returns the number of channels.
   *
   * @return {Integer} Number of channels.
   */

  get channels() {
    if (this.version === 2) {
      return this._data.getInt32(20, true);
    }
    else {
      return 1;
    }
  },

  /**
   * Returns the number of samples per second.
   *
   * @return {Integer} Number of samples per second.
   */

  get sample_rate() {
    return this._data.getInt32(8, true);
  },

  /**
   * Returns the scale (number of samples per pixel).
   *
   * @return {Integer} Number of samples per pixel.
   */

  get scale() {
    return this._data.getInt32(12, true);
  },

  /**
   * Returns the length of the waveform data (number of data points).
   *
   * @return {Integer} Length of the waveform data.
   */

  get length() {
    return this._data.getUint32(16, true);
  },

  /**
   * Returns a value at a specific offset.
   *
   * @param {Integer} index
   * @return {Integer} waveform value
   */

  at: function at_sample(index) {
    return this._data.getInt8(this._offset + index);
  },

  /**
   * Returns a new ArrayBuffer with the concatenated waveform.
   * All waveforms must have identical metadata (version, channels, etc)
   *
   * @param {...WaveformDataArrayBufferAdapter} otherAdapters One or more adapters to concatenate
   * @return {ArrayBuffer} concatenated ArrayBuffer
   */

  concatBuffers: function() {
    var otherAdapters = Array.prototype.slice.call(arguments);
    var headerSize = this._offset;
    var totalSize = headerSize;
    var totalDataLength = 0;
    var bufferCollection = [this].concat(otherAdapters).map(function(w) {
      return w._data.buffer;
    });
    var i, buffer;

    for (i = 0; i < bufferCollection.length; i++) {
      buffer = bufferCollection[i];
      var dataSize = new DataView(buffer).getInt32(16, true);

      totalSize += buffer.byteLength - headerSize;
      totalDataLength += dataSize;
    }

    var totalBuffer = new ArrayBuffer(totalSize);
    var sourceHeader = new DataView(bufferCollection[0]);
    var totalBufferView = new DataView(totalBuffer);

    // Copy the header from the first chunk
    for (i = 0; i < headerSize; i++) {
      totalBufferView.setUint8(i, sourceHeader.getUint8(i));
    }
    // Rewrite the data-length header item to reflect all of the samples concatenated together
    totalBufferView.setInt32(16, totalDataLength, true);

    var offset = 0;
    var dataOfTotalBuffer = new Uint8Array(totalBuffer, headerSize);

    for (i = 0; i < bufferCollection.length; i++) {
      buffer = bufferCollection[i];
      dataOfTotalBuffer.set(new Uint8Array(buffer, headerSize), offset);
      offset += buffer.byteLength - headerSize;
    }

    return totalBuffer;
  }
};

module.exports = WaveformDataArrayBufferAdapter;

},{}],2:[function(require,module,exports){
"use strict";

/**
 * Object adapter consumes waveform data in JSON format.
 * It is used as a data abstraction layer by `WaveformData`.
 *
 * This is supposed to be a fallback for browsers not supporting ArrayBuffer:
 * * **Pros**: easy to debug and quite self describing.
 * * **Cons**: slower than ArrayBuffer, more memory consumption.
 *
 * @param {Object} data Waveform data object
 * @constructor
 */

function WaveformDataObjectAdapter(data) {
  this._data = data;
}

/**
 * Detects if a set of data is suitable for the Object adapter.
 * It is used internally by `WaveformData.create` so you should not bother using it.
 *
 * @static
 * @param {Mixed} data
 * @returns {boolean}
 */

WaveformDataObjectAdapter.isCompatible = function isCompatible(data) {
  return data &&
    typeof data === "object" &&
    "sample_rate" in data &&
    "samples_per_pixel" in data &&
    "bits" in data &&
    "length" in data &&
    "data" in data;
};

/**
 * @namespace WaveformDataObjectAdapter
 */

WaveformDataObjectAdapter.prototype = {
  /**
   * Returns the data format version number.
   *
   * @return {Integer} Version number of the consumed data format.
   */

  get version() {
    return this._data.version || 1;
  },

  /**
   * Returns the number of bits per sample, either 8 or 16.
   */

  get bits() {
    return this._data.bits;
  },

  /**
   * Returns the number of channels.
   *
   * @return {Integer} Number of channels.
   */

  get channels() {
    return this._data.channels || 1;
  },

  /**
   * Returns the number of samples per second.
   *
   * @return {Integer} Number of samples per second.
   */

  get sample_rate() {
    return this._data.sample_rate;
  },

  /**
   * Returns the scale (number of samples per pixel).
   *
   * @return {Integer} Number of samples per pixel.
   */

  get scale() {
    return this._data.samples_per_pixel;
  },

  /**
   * Returns the length of the waveform data (number of data points).
   *
   * @return {Integer} Length of the waveform data.
   */

  get length() {
    return this._data.length;
  },

  /**
   * Returns a value at a specific offset.
   *
   * @param {Integer} index
   * @return {number} waveform value
   */

  at: function at_sample(index) {
    const data = this._data.data;

    if (index >= 0 && index < data.length) {
      return data[index];
    }
    else {
      throw new RangeError("Invalid index: " + index);
    }
  },

  /**
   * Returns a new data object with the concatenated waveform.
   * Both waveforms must have identical metadata (version, channels, etc)
   *
   * @param {...WaveformDataObjectAdapter} otherAdapters One or more adapters
   * @return {Mixed} combined waveform data
   */

  concatBuffers: function() {
    var otherAdapters = Array.prototype.slice.call(arguments);
    var otherDatas = otherAdapters.map(function(a) {
      return a._data.data;
    });
    var result = Object.assign({}, this._data);

    result.data = result.data.concat.apply(result.data, otherDatas);
    result.length += otherAdapters.reduce(function(sum, adapter) {
      return sum + adapter.length;
    }, 0);
    return result;
  }
};

module.exports = WaveformDataObjectAdapter;

},{}],3:[function(require,module,exports){
"use strict";

var WaveformData = require("../core");
var InlineWorker = require("inline-worker");

/**
 * This callback is executed once the audio has been decoded by the browser and
 * resampled by waveform-data.
 *
 * @callback onAudioResampled
 * @param {Error?}
 * @param {WaveformData} waveform_data Waveform instance of the browser decoded audio
 * @param {AudioBuffer} audio_buffer Decoded audio buffer
 */

/**
 * AudioBuffer-based WaveformData generator
 *
 * Adapted from BlockFile::CalcSummary in Audacity, with permission.
 * @see https://code.google.com/p/audacity/source/browse/audacity-src/trunk/src/BlockFile.cpp
 *
 * @param {Object.<{scale: Number, amplitude_scale: Number, split_channels: Boolean}>} options
 * @param {onAudioResampled} callback
 * @returns {Function.<AudioBuffer>}
 */

function getAudioDecoder(options, callback) {
  return function onAudioDecoded(audio_buffer) {
    var worker = new InlineWorker(function() {
      var INT8_MAX = 127;
      var INT8_MIN = -128;

      function calculateWaveformDataLength(audio_sample_count, scale) {
        var data_length = Math.floor(audio_sample_count / scale);

        var samples_remaining = audio_sample_count - (data_length * scale);

        if (samples_remaining > 0) {
          data_length++;
        }

        return data_length;
      }

      this.addEventListener("message", function(evt) {
        var scale = evt.data.scale;
        var amplitude_scale = evt.data.amplitude_scale;
        var split_channels = evt.data.split_channels;
        var audio_buffer = evt.data.audio_buffer;

        var channels = audio_buffer.channels;
        var output_channels = split_channels ? channels.length : 1;
        var version = output_channels === 1 ? 1 : 2;
        var header_size = version === 1 ? 20 : 24;
        var data_length = calculateWaveformDataLength(audio_buffer.length, scale);
        var total_size = header_size + data_length * 2 * output_channels;
        var data_object = new DataView(new ArrayBuffer(total_size));

        var min_value = new Array(output_channels);
        var max_value = new Array(output_channels);

        for (let channel = 0; channel < output_channels; channel++) {
          min_value[channel] = Infinity;
          max_value[channel] = -Infinity;
        }

        var scale_counter = 0;
        var buffer_length = audio_buffer.length;
        var offset = header_size;
        var channel, i;

        data_object.setInt32(0, version, true); // Version
        data_object.setUint32(4, 1, true); // Is 8 bit?
        data_object.setInt32(8, audio_buffer.sampleRate, true); // Sample rate
        data_object.setInt32(12, scale, true); // Scale
        data_object.setInt32(16, data_length, true); // Length

        if (version === 2) {
          data_object.setInt32(20, output_channels, true);
        }

        for (i = 0; i < buffer_length; i++) {
          var sample = 0;

          if (output_channels === 1) {
            for (channel = 0; channel < channels.length; ++channel) {
              sample += channels[channel][i];
            }

            sample = Math.floor(INT8_MAX * sample * amplitude_scale / channels.length);

            if (sample < min_value[0]) {
              min_value[0] = sample;

              if (min_value[0] < INT8_MIN) {
                min_value[0] = INT8_MIN;
              }
            }

            if (sample > max_value[0]) {
              max_value[0] = sample;

              if (max_value[0] > INT8_MAX) {
                max_value[0] = INT8_MAX;
              }
            }
          }
          else {
            for (channel = 0; channel < output_channels; ++channel) {
              sample = Math.floor(INT8_MAX * channels[channel][i] * amplitude_scale);

              if (sample < min_value[channel]) {
                min_value[channel] = sample;

                if (min_value[channel] < INT8_MIN) {
                  min_value[channel] = INT8_MIN;
                }
              }

              if (sample > max_value[channel]) {
                max_value[channel] = sample;

                if (max_value[channel] > INT8_MAX) {
                  max_value[channel] = INT8_MAX;
                }
              }
            }
          }

          if (++scale_counter === scale) {
            for (channel = 0; channel < output_channels; channel++) {
              data_object.setInt8(offset++, min_value[channel]);
              data_object.setInt8(offset++, max_value[channel]);

              min_value[channel] = Infinity;
              max_value[channel] = -Infinity;
            }

            scale_counter = 0;
          }
        }

        if (scale_counter > 0) {
          for (channel = 0; channel < output_channels; channel++) {
            data_object.setInt8(offset++, min_value[channel]);
            data_object.setInt8(offset++, max_value[channel]);
          }
        }

        this.postMessage(data_object);
      });
    });

    worker.addEventListener("message", function(evt) {
      var data_object = evt.data;

      callback(
        null,
        new WaveformData(data_object.buffer),
        audio_buffer
      );
    });

    // Construct a simple object with the necessary AudioBuffer data,
    // as we cannot send an AudioBuffer to a Web Worker.
    var audio_buffer_obj = {
      length: audio_buffer.length,
      sampleRate: audio_buffer.sampleRate,
      channels: []
    };

    // Fill in the channels data.
    for (var channel = 0; channel < audio_buffer.numberOfChannels; ++channel) {
      audio_buffer_obj.channels[channel] = audio_buffer.getChannelData(channel);
    }

    worker.postMessage({
      scale: options.scale,
      amplitude_scale: options.amplitude_scale,
      split_channels: options.split_channels,
      audio_buffer: audio_buffer_obj
    });
  };
}

module.exports = getAudioDecoder;

},{"../core":7,"inline-worker":8}],4:[function(require,module,exports){
"use strict";

var defaultOptions = {
  scale: 512,
  amplitude_scale: 1.0,
  split_channels: false
};

function getOptions(options) {
  if (Object.prototype.hasOwnProperty.call(options, "scale_adjuster")) {
    throw new Error("Please rename the 'scale_adjuster' option to 'amplitude_scale'");
  }

  var opts = {
    scale: options.scale || defaultOptions.scale,
    amplitude_scale: options.amplitude_scale || defaultOptions.amplitude_scale,
    split_channels: options.split_channels || defaultOptions.split_channels
  };

  return opts;
}

module.exports = getOptions;

},{}],5:[function(require,module,exports){
"use strict";

var getAudioDecoder = require("./audiodecoder");
var getOptions = require("./options");

function createFromArrayBuffer(audioContext, audioData, options, callback) {
  // The following function is a workaround for a Webkit bug where decodeAudioData
  // invokes the errorCallback with null instead of a DOMException.
  // See https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-decodeaudiodata
  // and http://stackoverflow.com/q/10365335/103396

  function errorCallback(error) {
    if (!error) {
      error = new DOMException("EncodingError");
    }

    callback(error);
  }

  audioContext.decodeAudioData(
    audioData,
    getAudioDecoder(options, callback),
    errorCallback
  );
}

function createFromAudioBuffer(audioBuffer, options, callback) {
  var audioDecoder = getAudioDecoder(options, callback);

  return audioDecoder(audioBuffer);
}

/**
 * Creates a working WaveformData based on binary audio data.
 *
 * This is still quite experimental and the result will mostly depend on the
 * level of browser support.
 *
 * ```javascript
 * const xhr = new XMLHttpRequest();
 * const audioContext = new AudioContext();
 *
 * // URL of a CORS MP3/Ogg file
 * xhr.open('GET', 'https://example.com/audio/track.ogg');
 * xhr.responseType = 'arraybuffer';
 *
 * xhr.addEventListener('load', function(progressEvent) {
 *   WaveformData.createFromAudio(audioContext, progressEvent.target.response,
 *     function(err, waveform) {
 *     if (err) {
 *       console.error(err);
 *       return;
 *     }
 *
 *     console.log(waveform.duration);
 *   });
 * });
 *
 * xhr.send();
 * ```
 *
 * @todo Use `SourceBuffer.appendBuffer` and `ProgressEvent` to stream the decoding?
 * @param {AudioContext|webkitAudioContext} audio_context
 * @param {ArrayBuffer} audio_data
 * @param {callback} what to do once the decoding is done
 * @constructor
 */

function createFromAudio(options, callback) {
  var opts = getOptions(options);

  if (options.audio_context && options.array_buffer) {
    return createFromArrayBuffer(options.audio_context, options.array_buffer, opts, callback);
  }
  else if (options.audio_buffer) {
    return createFromAudioBuffer(options.audio_buffer, opts, callback);
  }
  else {
    throw new TypeError("Please pass either an AudioContext and ArrayBuffer, or an AudioBuffer object");
  }
}

module.exports = createFromAudio;

},{"./audiodecoder":3,"./options":4}],6:[function(require,module,exports){
"use strict";

/**
 * Provides access to the waveform data for a single audio channel.
 *
 * @param {WaveformData} waveformData Waveform data.
 * @param {Number} channelIndex Channel number.
 * @constructor
 */

function WaveformDataChannel(waveformData, channelIndex) {
  this._waveformData = waveformData;
  this._channelIndex = channelIndex;
}

/**
 * Returns a min value for a specific offset.
 *
 * ```javascript
 * var waveform = WaveformData.create({ ... });
 * var channel = waveform.channel(0);
 *
 * console.log(channel.min_sample(10)); // -> -12
 * ```
 *
 * @api
 * @param {Integer} offset
 * @return {Number} Offset min value
 */

WaveformDataChannel.prototype.min_sample = function(index) {
  const offset = (index * this._waveformData.channels + this._channelIndex) * 2;

  return this._waveformData._adapter.at(offset);
};

/**
 * Returns a max value for a specific offset.
 *
 * ```javascript
 * var waveform = WaveformData.create({ ... });
 * var channel = waveform.channel(0);
 *
 * console.log(channel.max_sample(10)); // -> 12
 * ```
 *
 * @api
 * @param {Integer} offset
 * @return {Number} Offset max value
 */

WaveformDataChannel.prototype.max_sample = function(index) {
  const offset = (index * this._waveformData.channels + this._channelIndex) * 2 + 1;

  return this._waveformData._adapter.at(offset);
};

/**
 * Returns all the min values within the current offset.
 *
 * ```javascript
 * var waveform = WaveformData.create({ ... });
 * var channel = waveform.channel(0);
 *
 * console.log(channel.min_array()); // -> [-7, -5, -10]
 * ```
 *
 * @return {Array.<Integer>} Min values contained in the offset.
 */

WaveformDataChannel.prototype.min_array = function() {
  return this._waveformData._offsetValues(
    0,
    this._waveformData.length,
    this._channelIndex * 2
  );
};

/**
 * Returns all the max values within the current offset.
 *
 * ```javascript
 * var waveform = WaveformData.create({ ... });
 * var channel = waveform.channel(0);
 *
 * console.log(channel.max_array()); // -> [9, 6, 11]
 * ```
 *
 * @return {Array.<Integer>} Max values contained in the offset.
 */

WaveformDataChannel.prototype.max_array = function() {
  return this._waveformData._offsetValues(
    0,
    this._waveformData.length,
    this._channelIndex * 2 + 1
  );
};

module.exports = WaveformDataChannel;

},{}],7:[function(require,module,exports){
"use strict";

var WaveformDataChannel = require("./channel");
var WaveformDataObjectAdapter = require("./adapters/object");
var WaveformDataArrayBufferAdapter = require("./adapters/arraybuffer");

var adapters = [
  WaveformDataArrayBufferAdapter,
  WaveformDataObjectAdapter
];

/**
 * Facade to iterate on audio waveform response.
 *
 * ```javascript
 * var waveform = new WaveformData({ ... });
 *
 * var json_waveform = new WaveformData(xhr.responseText);
 *
 * var arraybuff_waveform = new WaveformData(
 *   getArrayBufferData()
 * );
 * ```
 *
 * ## Offsets
 *
 * An **offset** is a non-destructive way to iterate on a subset of data.
 *
 * It is the easiest way to **navigate** through data without having to deal
 * with complex calculations. Simply iterate over the data to display them.
 *
 * *Notice*: the default offset is the entire set of data.
 *
 * @param {String|ArrayBuffer|Object} data Waveform data,
 * to be consumed by the related adapter.
 * @param {WaveformData.adapter|Function} adapter Backend adapter used to manage
 * access to the data.
 * @constructor
 */

function WaveformData(data) {
  var Adapter = this._getAdapter(data);

  this._adapter = new Adapter(data);

  this._channels = [];

  for (let channel = 0; channel < this.channels; channel++) {
    this._channels[channel] = new WaveformDataChannel(this, channel);
  }
}

/**
 * Creates an instance of WaveformData by guessing the adapter from the
 * data type. It can also accept an XMLHttpRequest response.
 *
 * ```javascript
 * var xhr = new XMLHttpRequest();
 * xhr.open("GET", "http://example.com/waveforms/track.dat");
 * xhr.responseType = "arraybuffer";
 *
 * xhr.addEventListener("load", function onResponse(progressEvent) {
 *   var waveform = WaveformData.create(progressEvent.target);
 *
 *   console.log(waveform.duration);
 * });
 *
 * xhr.send();
 * ```
 *
 * @static
 * @throws TypeError
 * @param {Object} data
 * @return {WaveformData}
 */

WaveformData.create = function create(data) {
  return new WaveformData(data);
};

/**
 * Public API for the Waveform Data manager.
 *
 * @namespace WaveformData
 */

WaveformData.prototype = {

  _getAdapter: function(data) {
    var Adapter = null;

    adapters.some(function(AdapterClass) {
      if (AdapterClass.isCompatible(data)) {
        Adapter = AdapterClass;
        return true;
      }
    });

    if (Adapter === null) {
      throw new TypeError("Could not detect a WaveformData adapter from the input.");
    }

    return Adapter;
  },

  /**
   * Creates a new WaveformData object with resampled data.
   * Returns a rescaled waveform, to either fit the waveform to a specific
   * width, or to a specific zoom level.
   *
   * **Note**: You may specify either the *width* or the *scale*, but not both.
   * The `scale` will be deduced from the `width` you want to fit the data into.
   *
   * Adapted from Sequence::GetWaveDisplay in Audacity, with permission.
   *
   * ```javascript
   * var waveform = WaveformData.create({ ... });
   * // ...
   *
   * // fitting the data in a 500px wide canvas
   * var resampled_waveform = waveform.resample({ width: 500 });
   *
   * console.log(resampled_waveform.min.length);   // -> 500
   *
   * // zooming out on a 3 times less precise scale
   * var resampled_waveform = waveform.resample({ scale: waveform.scale * 3 });
   * ```
   *
   * @see https://code.google.com/p/audacity/source/browse/audacity-src/trunk/src/Sequence.cpp
   * @param {{ width: Number } | { scale: Number }} options Either a width (in pixels) or a zoom level (in samples per pixel)
   * @return {WaveformData} New resampled object
   */

  resample: function(options) {
    if (typeof options === "number") {
      options = {
        width: options
      };
    }

    options.input_index = typeof options.input_index === "number" ? options.input_index : null;
    options.output_index = typeof options.output_index === "number" ? options.output_index : null;
    options.scale = typeof options.scale === "number" ? options.scale : null;
    options.width = typeof options.width === "number" ? options.width : null;

    var is_partial_resampling = Boolean(options.input_index) || Boolean(options.output_index);

    if (options.input_index != null && (options.input_index < 0)) {
      throw new RangeError("options.input_index should be a positive integer value. [" + options.input_index + "]");
    }

    if (options.output_index != null && (options.output_index < 0)) {
      throw new RangeError("options.output_index should be a positive integer value. [" + options.output_index + "]");
    }

    if (options.width != null && (options.width <= 0)) {
      throw new RangeError("options.width should be a strictly positive integer value. [" + options.width + "]");
    }

    if (options.scale != null && (options.scale <= 0)) {
      throw new RangeError("options.scale should be a strictly positive integer value. [" + options.scale + "]");
    }

    if (!options.scale && !options.width) {
      throw new RangeError("You should provide either a resampling scale or a width in pixel the data should fit in.");
    }

    var definedPartialOptionsCount = ["width", "scale", "output_index", "input_index"].reduce(function(count, key) {
      return count + (options[key] === null ? 0 : 1);
    }, 0);

    if (is_partial_resampling && definedPartialOptionsCount !== 4) {
      throw new Error("Some partial resampling options are missing. You provided " + definedPartialOptionsCount + " of them over 4.");
    }

    var output_data = [];
    var samples_per_pixel = options.scale || Math.floor(this.duration * this.sample_rate / options.width); // scale we want to reach
    var scale = this.scale; // scale we are coming from
    var channel_count = 2 * this.channels;

    var input_buffer_size = this.length; // the amount of data we want to resample i.e. final zoom want to resample all data but for intermediate zoom we want to resample subset
    var input_index = options.input_index || 0; // is this start point? or is this the index at current scale
    var output_index = options.output_index || 0; // is this end point? or is this the index at scale we want to be?

    var channels = this.channels;

    var min = new Array(channels);
    var max = new Array(channels);

    for (let channel = 0; channel < channels; ++channel) {
      if (input_buffer_size > 0) {
        min[channel] = this.channel(channel).min_sample(input_index);
        max[channel] = this.channel(channel).max_sample(input_index);
      }
      else {
        min[channel] = 0;
        max[channel] = 0;
      }
    }

    var min_value = -128;
    var max_value = 127;

    if (samples_per_pixel < scale) {
      throw new Error("Zoom level " + samples_per_pixel + " too low, minimum: " + scale);
    }

    var where, prev_where, stop, value, last_input_index;

    function sample_at_pixel(x) {
      return Math.floor(x * samples_per_pixel);
    }

    function add_sample(min, max) {
      output_data.push(min, max);
    }

    while (input_index < input_buffer_size) {
      while (Math.floor(sample_at_pixel(output_index) / scale) <= input_index) {
        if (output_index > 0) {
          for (let channel = 0; channel < channels; ++channel) {
            add_sample(min[channel], max[channel]);
          }
        }

        last_input_index = input_index;

        output_index++;

        where      = sample_at_pixel(output_index);
        prev_where = sample_at_pixel(output_index - 1);

        if (where !== prev_where) {
          for (let channel = 0; channel < channels; ++channel) {
            min[channel] = max_value;
            max[channel] = min_value;
          }
        }
      }

      where = sample_at_pixel(output_index);
      stop = Math.floor(where / scale);

      if (stop > input_buffer_size) {
        stop = input_buffer_size;
      }

      while (input_index < stop) {
        for (let channel = 0; channel < channels; ++channel) {
          value = this.channel(channel).min_sample(input_index);

          if (value < min[channel]) {
            min[channel] = value;
          }

          value = this.channel(channel).max_sample(input_index);

          if (value > max[channel]) {
            max[channel] = value;
          }
        }

        input_index++;
      }

      if (is_partial_resampling && (output_data.length / channel_count) >= options.width) {
        break;
      }
    }

    if (is_partial_resampling) {
      if ((output_data.length / channel_count) > options.width &&
          input_index !== last_input_index) {
          for (let channel = 0; channel < channels; ++channel) {
            add_sample(min[channel], max[channel]);
          }
      }
    }
    else if (input_index !== last_input_index) {
      for (let channel = 0; channel < channels; ++channel) {
        add_sample(min[channel], max[channel]);
      }
    }

    return new WaveformData({
      version: this._adapter.version,
      bits: this.bits,
      samples_per_pixel: samples_per_pixel,
      length: output_data.length / channel_count,
      data: output_data,
      sample_rate: this.sample_rate,
      channels: channels
    });
  },

  /**
   * Return a new WaveformData instance with the concatenated result of multiple waveforms.
   *
   * @param {...WaveformData} otherWaveforms One or more waveform instances to concatenate
   * @return {WaveformData} New concatenated object
   */
  concat: function() {
    var self = this;
    var otherWaveforms = Array.prototype.slice.call(arguments);

    // Check that all the supplied waveforms are compatible
    otherWaveforms.forEach(function(otherWaveform) {
      if (self.channels !== otherWaveform.channels ||
        self.sample_rate !== otherWaveform.sample_rate ||
        self.scale !== otherWaveform.scale ||
        Object.getPrototypeOf(self._adapter) !== Object.getPrototypeOf(otherWaveform._adapter) ||
        self._adapter.version !== otherWaveform._adapter.version) {
        throw new Error("Waveforms are incompatible");
      }
    });

    var otherAdapters = otherWaveforms.map(function(w) {
      return w._adapter;
    });

    var combinedBuffer = this._adapter.concatBuffers.apply(this._adapter, otherAdapters);

    return new WaveformData(combinedBuffer);
  },

  /**
   * Return the unpacked values for a particular offset.
   *
   * @param {Integer} start
   * @param {Integer} length
   * @param {Integer} correction The step to skip for each iteration
   * (as the response body is [min, max, min, max...])
   * @return {Array.<Integer>}
   */

  _offsetValues: function getOffsetValues(start, length, correction) {
    var adapter = this._adapter;
    var values = [];
    var channels = this.channels;

    correction += (start * channels * 2); // offset the positioning query

    for (var i = 0; i < length; i++) {
      values.push(adapter.at((i * channels * 2) + correction));
    }

    return values;
  },

  /**
   * Returns the length of the waveform, in pixels.
   *
   * ```javascript
   * var waveform = WaveformData.create({ ... });
   * console.log(waveform.length); // -> 600
   * ```
   *
   * @api
   * @return {Integer} Length of the waveform, in pixels.
   */

  get length() {
    return this._adapter.length;
  },

  /**
   * Returns the number of bits per sample, either 8 or 16.
   */

  get bits() {
    return this._adapter.bits;
  },

  /**
   * Returns the (approximate) duration of the audio file, in seconds.
   *
   * ```javascript
   * var waveform = WaveformData.create({ ... });
   * console.log(waveform.duration); // -> 10.33333333333
   * ```
   *
   * @api
   * @return {number} Duration of the audio waveform, in seconds.
   */

  get duration() {
    return this.length * this.scale / this.sample_rate;
  },

  /**
   * Return the number of pixels per second.
   *
   * ```javascript
   * var waveform = WaveformData.create({ ... });
   *
   * console.log(waveform.pixels_per_second); // -> 93.75
   * ```
   *
   * @api
   * @return {number} Number of pixels per second.
   */

  get pixels_per_second() {
    return this.sample_rate / this.scale;
  },

  /**
   * Return the amount of time represented by a single pixel.
   *
   * ```javascript
   * var waveform = WaveformData.create({ ... });
   *
   * console.log(waveform.seconds_per_pixel);       // -> 0.010666666666666666
   * ```
   *
   * @return {number} Amount of time (in seconds) contained in a pixel.
   */

  get seconds_per_pixel() {
    return this.scale / this.sample_rate;
  },

  /**
   * Returns the number of waveform channels.
   *
   * ```javascript
   * var waveform = WaveformData.create({ ... });
   * console.log(waveform.channels);    // -> 1
   * ```
   *
   * @api
   * @return {number} Number of channels.
   */

  get channels() {
    return this._adapter.channels;
  },

  /**
   * Returns a waveform channel.
   *
   * ```javascript
   * var waveform = WaveformData.create({ ... });
   * var channel = waveform.channel(0);
   * console.log(channel.min_sample(0)); // -> 1
   * ```
   *
   * @api
   * @param {Number} Channel index.
   * @return {WaveformDataChannel} Waveform channel.
   */

  channel: function(index) {
    if (index >= 0 && index < this._channels.length) {
      return this._channels[index];
    }
    else {
      throw new RangeError("Invalid channel: " + index);
    }
  },

  /**
   * Returns the number of samples per second.
   *
   * @return {Integer} Number of samples per second.
   */

  get sample_rate() {
    return this._adapter.sample_rate;
  },

  /**
   * Returns the scale (number of samples per pixel).
   *
   * @return {Integer} Number of samples per pixel.
   */

  get scale() {
    return this._adapter.scale;
  },

  /**
   * Returns the pixel location for a given time.
   *
   * @param {number} time
   * @return {integer} Index location for a specific time.
   */

  at_time: function at_time(time) {
    return Math.floor(time * this.sample_rate / this.scale);
  },

  /**
   * Returns the time in seconds for a given index
   *
   * @param {Integer} index
   * @return {number}
   */

  time: function time(index) {
    return index * this.scale / this.sample_rate;
  }
};

module.exports = WaveformData;

},{"./adapters/arraybuffer":1,"./adapters/object":2,"./channel":6}],8:[function(require,module,exports){
(function (global){
var WORKER_ENABLED = !!(global === global.window && global.URL && global.Blob && global.Worker);

function InlineWorker(func, self) {
  var _this = this;
  var functionBody;

  self = self || {};

  if (WORKER_ENABLED) {
    functionBody = func.toString().trim().match(
      /^function\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}$/
    )[1];

    return new global.Worker(global.URL.createObjectURL(
      new global.Blob([ functionBody ], { type: "text/javascript" })
    ));
  }

  function postMessage(data) {
    setTimeout(function() {
      _this.onmessage({ data: data });
    }, 0);
  }

  this.self = self;
  this.self.postMessage = postMessage;

  setTimeout(func.bind(self, self), 0);
}

InlineWorker.prototype.postMessage = function postMessage(data) {
  var _this = this;

  setTimeout(function() {
    _this.self.onmessage({ data: data });
  }, 0);
};

module.exports = InlineWorker;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/waveform-data.js":[function(require,module,exports){
"use strict";

var WaveformData = require("./lib/core");

WaveformData.createFromAudio = require("./lib/builders/webaudio");

module.exports = WaveformData;

},{"./lib/builders/webaudio":5,"./lib/core":7}]},{},[])("/waveform-data.js")
});
