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
    document.title = config.title || t`title`;
    render(<App config={config} />, document.body);
});