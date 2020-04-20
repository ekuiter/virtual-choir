/**
 * @file
 *
 * Defines the {@link ViewController} class.
 *
 * @module view-controller
 */

define([
  './waveform-zoomview',
  './utils'
], function(
    WaveformZoomView,
    Utils) {
  'use strict';

  /**
   * Creates an object that allows users to create and manage waveform views.
   *
   * @class
   * @alias ViewController
   *
   * @param {Peaks} peaks
   */

  function ViewController(peaks) {
    this._peaks = peaks;
    this._zoomview = null;
  }

  ViewController.prototype.createZoomview = function(container) {
    if (this._zoomview) {
      return this._zoomview;
    }

    var waveformData = this._peaks.getWaveformData();

    this._zoomview = new WaveformZoomView(
      waveformData,
      container,
      this._peaks
    );

    return this._zoomview;
  };

  ViewController.prototype.destroyZoomview = function() {
    if (!this._zoomview) {
      return;
    }

    this._zoomview.destroy();
    this._zoomview = null;
  };

  ViewController.prototype.destroy = function() {
    if (this._zoomview) {
      this._zoomview.destroy();
      this._zoomview = null;
    }
  };

  ViewController.prototype.getView = function(name) {
    if (Utils.isNullOrUndefined(name)) {
      if (this._zoomview) {
        return this._zoomview;
      }
      else {
        return null;
      }
    }
    else {
      switch (name) {
        case 'zoomview':
          return this._zoomview;

        default:
          return null;
      }
    }
  };

  return ViewController;
});
