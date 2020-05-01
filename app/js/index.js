import "bootstrap";
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import {h, Fragment, render} from "preact";
import OpusMediaRecorder from "opus-media-recorder";
import EncoderWorker from "opus-media-recorder/encoderWorker.js";
import OggOpusEncoder from "opus-media-recorder/OggOpusEncoder.wasm";
import WebMOpusEncoder from "opus-media-recorder/WebMOpusEncoder.wasm";
import {t, setDefaultLanguage} from "./i18n";
import App from "./components/App";
import {fetchJson} from "./api";

window.addEventListener("error", err =>
    "Error: " + window.alert(err.message));

window.addEventListener("unhandledrejection", e =>
    "Unhandled Rejection: " + window.alert(e.reason));

window.MediaRecorder = class extends OpusMediaRecorder {
    constructor(stream, options) {
        super(stream, options, {
            encoderWorkerFactory: _ => new EncoderWorker(),
            OggOpusEncoderWasmPath: OggOpusEncoder,
            WebMOpusEncoderWasmPath: WebMOpusEncoder
        });
    }
};

render(<App />, document.body);

fetchJson({config: true}).then(config => {
    setDefaultLanguage(config.defaultLanguage);
    if ((window.navigator.userAgent.indexOf("MSIE ") > -1 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) ||
        navigator.userAgent.indexOf("Edge/") > -1 ||
        (window.navigator.userAgent.indexOf("Safari") > -1 && window.navigator.userAgent.indexOf("Chrome") === -1))
        alert(t`browserWarning`);
    if (localStorage.getItem("song") && !config.songs.hasOwnProperty(localStorage.getItem("song")) ||
        localStorage.getItem("register") && !config.registers.hasOwnProperty(localStorage.getItem("register"))) {
        localStorage.clear();
        location.reload();
    } else {
        document.title = config.title || t`title`;
        render(<App config={config} />, document.body);
    }
});