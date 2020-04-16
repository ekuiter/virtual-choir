window.$$ = document.querySelector.bind(document);

window.App = {
    render_seconds: 10,
    preview_seconds: 8,
    update_interval_ms: 1500,
    prepare_ms: 3000,
    update_interval: null,
    recorder_timeout: null,
    stream: null,
    recorder: null,
    recording_info: null,
    songWavesurfer: null,
    recordingWavesurfer: null,
    songGainNode: null,
    recordingGainNode: null,
    state: null,
    my_name: null,
    wavesurferOptions: (container, offset, drag) => ({
        container: container,
        waveColor: "violet",
        fillParent: false,
        scrollParent: true,
        interact: false,
        autoCenter: false,
        plugins: [
            WaveSurfer.regions.create({
                regions: [{
                    start: offset < 0 ? offset * (-1) : 0,
                    end: offset < 0 ? offset * (-1) + App.preview_seconds : App.preview_seconds - (offset || 0),
                    color: "rgba(255, 128, 128, 0.4)",
                    resize: false,
                    drag: drag !== undefined ? drag : true
                }]
            })
        ]
    })
};

function anyPromise(promises) {
    return Promise.all(promises.map(p => {
        return p.then(
            val => Promise.reject(val),
            err => Promise.resolve(err)
        );
    })).then(
        errors => Promise.reject(errors),
        val => Promise.resolve(val)
    );
}

function pxPerSec() {
    return $$(".container").offsetWidth / App.render_seconds;
}

function getMyStatus() {
    return App.my_name && App.state && App.state.participants && App.state.participants[App.my_name]
        ? App.state.participants[App.my_name].status
        : null;
}

function setMyStatus(status) {
    if (App.my_name && App.state && App.state.participants && App.state.participants[App.my_name])
        App.state.participants[App.my_name].status = status;
}

function post(url, params) {
    const data = new FormData();
    for (const key in params)
        data.append(key, params[key]);
    return window.fetch(url, {method: "POST", body: data});
}

function upload(blob, recording_info, offset, gain) {
    const file = new File([blob], "audio.dat", {type: "application/octet-stream"});
    return post("app.php", {
        name: recording_info.name,
        song: recording_info.song,
        date: recording_info.date,
        offset: offset,
        gain: gain,
        file: file
    });
}

function updateState(params) {
    if (!params)
        params = {};

    return post("app.php", params)
        .then(res => res.json())
        .then(state => {
        console.log(state);
        const myself = App.my_name && App.state && App.state.participants && App.state.participants[App.my_name];
        App.state = state;
        if (myself)
            App.state.participants[App.my_name] = myself;

        if (location.pathname.indexOf("conduct") !== -1) {
            const songs = $$("#songs");
            const submit = $$("#conduct input[type=submit]");
            const status = $$("#conduct #status");

            $$("#participants").innerHTML =
                Object.entries(state.participants)
                    .map(([name, {status}]) => "<tr><td>" + name + "</td><td>" + status + "</td></tr>")
                    .join("");

            if (state.options.start_at) {
                if (state.options.start_at <= (+new Date)) {
                    status.innerText = "Aufnahme läuft ...";
                } else {
                    status.innerText = "Bereite Aufnahme vor ...";
                }
                songs.disabled = true;
                $$("#playback").disabled = true;
                submit.value = "Stoppen";
            }

            if (state.options.stop_at) {
                if (state.options.stop_at <= (+new Date)) {
                    status.innerText = "Aufnahme läuft nicht";
                } else {
                    status.innerText = "Stoppe Aufnahme ...";
                }
                songs.disabled = false;
                $$("#playback").disabled = false;
                submit.value = "Aufnehmen!";
            }
        } else {
            if (state.options.stop_at && getMyStatus() === "preparing") {
                setMyStatus("idle");
                $$("h5").innerHTML = "Aufnahme läuft nicht";
                window.clearTimeout(App.recorder_timeout);
                App.recorder_timeout = null;
            }

            if (state.options.stop_at && getMyStatus() === "recording") {
                if (state.options.stop_at <= (+new Date)) {
                    stopRecording();
                } else {
                    setMyStatus("stopping");
                    $$("h5").innerHTML = "Stoppe Aufnahme ...";
                    App.recorder_timeout =
                        window.setTimeout(stopRecording, state.options.stop_at - (+new Date));
                }
            }

            if (state.options.start_at && getMyStatus() === "idle") {
                if (state.options.start_at <= (+new Date)) {
                    startRecording();
                } else {
                    setMyStatus("preparing");
                    $$("h5").innerHTML = "Bereite Aufnahme vor ...";
                    App.recorder_timeout =
                        window.setTimeout(startRecording, state.options.start_at - (+new Date));
                }
            }
        }

        return state;
    });
}

function startRecording() {
    setMyStatus("recording");
    $$("h5").innerHTML = "Aufnahme läuft ...";
    App.recorder = RecordRTC(App.stream, {type: "audio"});
    App.recorder.startRecording();
    App.recording_info = {
        name: App.my_name,
        song: App.state.options.song,
        date: (new Date(parseInt(App.state.options.start_at))).toISOString().replace(/:|\./g, "-")
    };
    if (App.state.options.playback === "true") {
        const playback = $$("#playback");
        playback.src = "songs/" + App.state.options.song;
        playback.currentTime = 0;
        playback.play();
    }
}

function stopRecording() {
    App.recorder.stopRecording(startEditing);
}

function startEditing() {
    $$("#playback").pause();
    App.songWavesurfer.load("songs/" + App.state.options.song);
    App.songWavesurfer.seekAndCenter(0);
    App.songWavesurfer.zoom(pxPerSec());
    App.songGainNode = App.songWavesurfer.backend.ac.createGain();
    App.songGainNode.gain.value = 1;
    App.songWavesurfer.backend.setFilter(App.songGainNode);
    App.recordingWavesurfer.loadBlob((App.recorder.getBlob()));
    App.recordingWavesurfer.seekAndCenter(0);
    App.recordingWavesurfer.zoom(pxPerSec());
    App.recordingGainNode = App.recordingWavesurfer.backend.ac.createGain();
    App.recordingGainNode.gain.value = 1;
    App.recordingWavesurfer.backend.setFilter(App.recordingGainNode);
    Promise.all([App.songWavesurfer, App.recordingWavesurfer]
            .map(wavesurfer => new Promise(resolve => wavesurfer.on("ready", resolve)))).then(() => {
        setMyStatus("editing");
        $$("h5").innerHTML = "Verschiebe die Regionen so, dass der Ton synchron ist.";
        $$("#editing").style.display = "block";
        $$("#songWavesurfer > wave").scroll(0, 0);
        $$("#recordingWavesurfer > wave").scroll(0, 0);
    });
}

function stopPreview() {
    App.songWavesurfer.stop();
    App.recordingWavesurfer.stop();
    preview.innerText = "Abspielen";
}

function stopEditing() {
    stopPreview();
    setMyStatus("idle");
    $$("h5").innerHTML = "Aufnahme läuft nicht";
    $$("#editing").style.display = "none";
}

function initializeIndex() {
    class MyRecorder extends OpusMediaRecorder {
        constructor(stream, options) {
            const workerOptions = {
                OggOpusEncoderWasmPath: "https://cdn.jsdelivr.net/npm/opus-media-recorder@latest/OggOpusEncoder.wasm",
                WebMOpusEncoderWasmPath: "https://cdn.jsdelivr.net/npm/opus-media-recorder@latest/WebMOpusEncoder.wasm"
            };
            super(stream, options, workerOptions);
        }
    }

    window.MediaRecorder = MyRecorder;

    $$("#login").addEventListener("submit", e => {
        e.preventDefault();
        const name = $$("#login #name");
        const submit = $$("#login input[type=submit]");
        App.my_name = name.value.trim() ? name.value.trim() : null;
        if (submit.value === "Anmelden" && App.my_name) {
            navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(stream => {
                App.stream = stream;
                updateState({name: App.my_name, status: "idle"}).then(_state => {
                    $$("h4").innerText = "Hallo " + App.my_name + "! :)";
                    if (getMyStatus() === "idle")
                        $$("h5").innerHTML = "Aufnahme läuft nicht";
                    submit.value = "Abmelden";
                    name.disabled = true;
                    App.update_interval = window.setInterval(() =>
                        updateState({name: App.my_name, status: getMyStatus()}), App.update_interval_ms);
                });
            });
        } else if (submit.value === "Abmelden" && App.my_name) {
            window.clearInterval(App.update_interval);
            App.update_interval = null;
            updateState({name: App.my_name, status: "leave"}).then(_state => {
                submit.value = "Anmelden";
                name.disabled = false;
                if (getMyStatus() === "recording")
                    App.recorder.stopRecording();
                if (getMyStatus() === "editing")
                    stopEditing();
                $$("#playback").pause();
                if (App.stream)
                    App.stream.getTracks().forEach(track => track.stop());
                App.stream = null;
                App.my_name = null;
                $$("h4").innerText = "Bitte melde dich an.";
                $$("h5").innerHTML = "&nbsp;";
            });
        }
    });

    window.addEventListener("unload",
        () => App.my_name && updateState({name: App.my_name, status: "leave"}));

    App.songWavesurfer = WaveSurfer.create(App.wavesurferOptions("#songWavesurfer"));
    App.recordingWavesurfer = WaveSurfer.create(App.wavesurferOptions("#recordingWavesurfer"));

    const preview = $$("#preview");
    preview.addEventListener("click", () => {
        if (preview.innerText === "Abspielen") {
            Object.values(App.songWavesurfer.regions.list)[0].play();
            Object.values(App.recordingWavesurfer.regions.list)[0].play();
            preview.innerText = "Stoppen";
            Promise.all([App.songWavesurfer, App.recordingWavesurfer].map(wavesurfer =>
                new Promise(resolve => wavesurfer.on("region-out", resolve)))).then(stopPreview);
            anyPromise([App.songWavesurfer, App.recordingWavesurfer].map(wavesurfer =>
                new Promise(resolve => wavesurfer.on("region-updated", resolve)))).then(stopPreview);
        } else
            stopPreview();
    });

    $$("#upload").addEventListener("click", () => {
        setMyStatus("uploading");
        $$("h5").innerHTML = "Aufnahme wird hochgeladen ...";
        upload(App.recorder.getBlob(), App.recording_info,
            (Object.values(App.songWavesurfer.regions.list)[0].start -
            Object.values(App.recordingWavesurfer.regions.list)[0].start).toString(),
            (App.recordingGainNode.gain.value / App.songGainNode.gain.value).toString()).then(stopEditing);
    });

    $$("#discard").addEventListener("click", stopEditing);

    const songVolumeSlider = new Slider("#songVolume");
    const recordingVolumeSlider = new Slider("#recordingVolume");

    songVolumeSlider.on("change", () =>
        App.songGainNode.gain.value = songVolumeSlider.getValue());
    recordingVolumeSlider.on("change", () =>
        App.recordingGainNode.gain.value = recordingVolumeSlider.getValue());
}

function initializeConduct() {
    $$("#conduct").addEventListener("submit", e => {
        e.preventDefault();
        const songs = $$("#songs");
        const submit = $$("#conduct input[type=submit]");
        if (!songs.value || songs.value === "null")
            window.alert("Bitte Song auswählen!");
        else {
            if (submit.value === "Aufnehmen!")
                updateState({
                    song: songs.value,
                    start_at: (+new Date) + App.prepare_ms,
                    stop_at: null,
                    playback: $$("#playback").checked
                });
            else
                updateState({
                    songs: songs.value,
                    start_at: null,
                    stop_at: (+new Date) + App.prepare_ms,
                    playback: $$("#playback").checked
                });
        }
    });

    $$("#reset").addEventListener("submit", e => {
        e.preventDefault();
        if (confirm("Sicher? Dies löscht alle Aufnahmen."))
            updateState({reset: true});
    });

    updateState().then(_state => App.update_interval =
        window.setInterval(updateState, App.update_interval_ms));
}

function initializeMix() {
    $$("#dates-from").addEventListener("change", () => {
        $$("#dates-to").value = $$("#dates-from").value;
        $$("#date").submit();
    });
    $$("#dates-to").addEventListener("change", () => $$("#date").submit());

    $$("#reset").addEventListener("submit", e => {
        e.preventDefault();
        if (confirm("Sicher? Dies löscht alle Aufnahmen."))
            updateState({reset: true});
    });

    const songWavesurfer = WaveSurfer.create(App.wavesurferOptions("#songWavesurfer"));
    songWavesurfer.load("songs/" + $$("#songWavesurfer").dataset.song);
    songWavesurfer.seekAndCenter(0);
    songWavesurfer.zoom(pxPerSec());
    const wavesurfers = [];

    document.querySelectorAll(".wavesurfer").forEach(div => {
        const offset = parseFloat(div.dataset.offset);
        const wavesurfer = WaveSurfer.create(App.wavesurferOptions(
            "#" + div.id, offset, false));
        wavesurfer.load("uploads/" + div.dataset.file);
        wavesurfer.seekAndCenter(0);
        wavesurfer.zoom(pxPerSec());
        const gainNode = wavesurfer.backend.ac.createGain();
        const delayNode = offset > 0 ? wavesurfer.backend.ac.createDelay(offset) : null;
        gainNode.gain.value = parseFloat(div.dataset.gain);
        if (offset > 0)
            delayNode.delayTime.value = offset;
        wavesurfer.backend.setFilters(offset > 0 ? [gainNode, delayNode] : [gainNode]);
        wavesurfers.push(wavesurfer);
    });

    const allWavesurfers = wavesurfers.concat([songWavesurfer]);

    Promise.all(allWavesurfers.map(wavesurfer =>
        new Promise(resolve => wavesurfer.on("ready", resolve)))).then(() => {
        const preview = $$("#preview");
        preview.disabled = false;
        preview.addEventListener("click", e => {
            e.preventDefault();
            const playback = $$("#playback").checked;
            const playWavesurfers = playback ? allWavesurfers : wavesurfers;
            if (preview.innerText === "Abspielen") {
                playWavesurfers.forEach(wavesurfer => Object.values(wavesurfer.regions.list)[0].play());
                preview.innerText = "Stoppen";
            } else {
                playWavesurfers.forEach(wavesurfer => wavesurfer.stop());
                preview.innerText = "Abspielen";
            }
        });
        document.querySelectorAll(".wavesurfer > wave").forEach(wave => wave.scroll(0, 0));
        $$("#loading").style.display = "none";
        $$("#editing").style.display = "block";
    });
}