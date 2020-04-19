const {html, render, useState, useEffect, useRef} = window.htmPreact;
const Peaks = window.peaks;
const snippetDuration = 20;

const songs = {
    "21Guns": {offset: 0.41},
    "BabaYetu": {offset: 1},
    "ColorsOfTheWind": {offset: 1},
    "Erlkoenig": {offset: 1},
    "EveningRise80bpm": {offset: 1},
    "WeWillRockYou": {offset: 1}
};

const registers = [
    "Sopran",
    "Alt",
    "Tenor",
    "Bass",
    "Nichts davon"
];

const navigation = [
    {title: "Aufnehmen", href: "index.html"},
    {title: "Abmischen", href: "mix.html"},
    {title: "GitHub", href: "https://github.com/ekuiter/virtual-choir"}
];

// API
function post(params) {
    const data = new FormData();
    for (const key in params)
        data.append(key, params[key]);
    return window.fetch("php/app.php", {method: "POST", body: data});
}

const uploadTrack = (blobUri, name, register, song, offset, gain) =>
    fetch(blobUri)
        .then(res => res.blob())
        .then(blob => post({
            name: name,
            register: register,
            song: song,
            offset: offset,
            gain: gain,
            date: (new Date).toISOString(),
            file: new File([blob], "audio.dat", {type: "application/octet-stream"})
        }));

// opus codec initialization
class MyRecorder extends OpusMediaRecorder {
    constructor(stream, options) {
        const path = location.href.substr(0, location.href.lastIndexOf("/") + 1);
        const workerOptions = {
            OggOpusEncoderWasmPath: path + "js/OggOpusEncoder.wasm",
            WebMOpusEncoderWasmPath: path + "js/WebMOpusEncoder.wasm"
        };
        super(stream, options, workerOptions);
    }
}

window.MediaRecorder = MyRecorder;

// audio buffer preparation for peaks.js
const fetchAudioBuffer = (duration => {
    const cache = {};
    return (src) => {
        if (cache[src])
            return Promise.resolve(cache[src]);
        return fetch(src)
            .then(res => res.arrayBuffer())
            .then(arrayBuffer => new AudioContext().decodeAudioData(arrayBuffer))
            .then(duration
                ? audioBuffer => {
                    const ctx = new AudioContext();
                    const shortAudioBuffer = ctx.createBuffer(audioBuffer.numberOfChannels,
                        Math.min(audioBuffer.length, ctx.sampleRate * duration), ctx.sampleRate);
                    for (var channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                        const oldChannel = audioBuffer.getChannelData(channel);
                        const newChannel = shortAudioBuffer.getChannelData(channel);
                        for (var i = 0; i < shortAudioBuffer.length; i++)
                            newChannel[i] = oldChannel[i];
                    }
                    return shortAudioBuffer;
                }
                : audioBuffer => audioBuffer)
            .then(audioBuffer => cache[src] = audioBuffer);
    };
})(snippetDuration);

// Preact components
const Navigation = ({activeHref}) => html`
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <a class=navbar-brand href=index.html>Virtueller Chor</a>
        <button class=navbar-toggler type=button data-toggle=collapse data-target=#navbarSupportedContent
            aria-controls=navbarSupportedContent aria-expanded=false aria-label="Toggle navigation">
            <span class=navbar-toggler-icon />
        </button>
        <div class="collapse navbar-collapse" id=navbarSupportedContent>
            <ul class="navbar-nav mr-auto">
                ${navigation.map(({title, href}) => html`
                    <li class="nav-item ${activeHref.endsWith(href) ? "active" : ""}">
                        <a class=nav-link href=${href}>${title}</a>
                    </li>
                `)}
            </ul>
        </div>
    </nav>
`;

const IconButton = ({onClick, icon, children, ...props}) => html `
    <button className="btn btn-light" onclick=${onClick}
        style="height: 38px; padding: 0 12px 0 6px; margin: 6px 6px 6px 0;" ...${props}>
        <img src=${icon} width="24" height="24" style="float: left; padding: 0 3px 0 0;" />
        ${children}
    </button>
`;

const PlayButton = ({isPlaying, onClick, ...props}) =>
    isPlaying
        ? html`<${IconButton} icon="img/stop.svg" onClick=${onClick} ...${props}>Stoppen<//>`
        : html`<${IconButton} icon="img/play.svg" onClick=${onClick} ...${props}>Abspielen<//>`;

const Track = ({title, src, offset = 0.5, gain = 1, displaySeconds = 5.0, onReady,
    isPlaying, onSetIsPlaying, onOffsetUpdated, onGainUpdated, showPlayButton = true}) => {
    const [peaks, setPeaks] = useState();
    const audioRef = useRef();
    const zoomviewRef = useRef();
    const overviewRef = useRef();
    const gainNodeRef = useRef();
    
    useEffect(() => {
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(audioRef.current);
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.gain.value = gain;
        source.connect(gainNodeRef.current);
        gainNodeRef.current.connect(ctx.destination);
        fetchAudioBuffer(src).then(audioBuffer => {
            const options = {
                containers: {
                    zoomview: zoomviewRef.current,
                    overview: overviewRef.current
                },
                mediaElement: audioRef.current,
                webAudio: {
                    audioContext: ctx,
                    audioBuffer: audioBuffer
                },
                zoomLevels: [1],
                points: [{
                    id: "offset",
                    time: offset,
                    editable: true,
                    color: "#ff0000"
                }]
            };
            Peaks.init(options, (err, peaks) => {
                if (err)
                    window.alert(err);
                else {
                    peaks.views.getView("zoomview").setZoom({seconds: displaySeconds});
                    peaks.player.seek(peaks.points.getPoint("offset").time);
                    peaks.on("points.dragmove", () => {
                        if (onSetIsPlaying)
                            onSetIsPlaying(false);
                        if (onOffsetUpdated)
                            onOffsetUpdated(peaks.points.getPoint("offset").time);
                    });
                    setPeaks(peaks);
                    if (onReady)
                        onReady();
                }
            });
        });
        return () => peaks && peaks.destroy();
    }, []);

    useEffect(() => {
        if (peaks) {
            peaks.player.seek(peaks.points.getPoint("offset").time);
            if (isPlaying)
                peaks.player.play();
            else
                peaks.player.pause();
        }
    }, [isPlaying]);

    const onGainInput = e => {
        const gain = parseFloat(e.target.value);
        gainNodeRef.current.gain.value = parseFloat(e.target.value);
        if (onGainUpdated)
            onGainUpdated(gain);
    };

    return html`
        <h5 style="margin-top: 20px;">${title}</h5>
        <div style=${peaks ? "display: none;" : "position: absolute; left: calc(50% - 50px);"}>
            <img src="img/loading.gif" width="100" height="100" style="margin-top: 50px;" />
        </div>
        <audio src=${src} ref=${audioRef} onended=${() => onSetIsPlaying && onSetIsPlaying(false)} />
        <div ref=${zoomviewRef} style="height: 140px;" />
        <div ref=${overviewRef} style="height: 80px;" />
        <div style=${peaks ? "display: flex;" : "display: none;"}>
            ${showPlayButton && html`<${PlayButton} isPlaying=${isPlaying} onClick=${() => onSetIsPlaying && onSetIsPlaying(!isPlaying)} />`}
            <div class="form-group form-inline">
                <label style="margin-top: 6px;">
                    <span style="margin-top: -3px; padding: 0 20px 0 10px;">Lautstärke</span>
                    <input type=range class=custom-range min=0.01 max=2 step=0.01
                        style="margin: 10px 0;" value=${gain} oninput=${onGainInput} />
                </label>
            </div>
        </div>
    `;
};

const Index = () => {
    const [name, setName] = useState(localStorage.getItem("name"));
    const [register, setRegister] = useState(localStorage.getItem("register"));
    const [song, setSong] = useState(localStorage.getItem("song"));
    const [playback, setPlayback] = useState(localStorage.getItem("playback") === "true");
    const [busy, setBusy] = useState();
    const [recorder, setRecorder] = useState();
    const [recordingUri, setRecordingUri] = useState();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSongTrackReady, setIsSongTrackReady] = useState(false);
    const [isRecordingTrackReady, setIsRecordingTrackReady] = useState(false);
    const [songTrackOffset, setSongTrackOffset] = useState();
    const [recordingTrackOffset, setRecordingTrackOffset] = useState(0.5);
    const [songTrackGain, setSongTrackGain] = useState(1);
    const [recordingTrackGain, setRecordingTrackGain] = useState(1);
    const playbackRef = useRef();

    useEffect(() => song && fetchAudioBuffer("songs/" + song + ".mp3"), [song]);

    const getSongTrackOffset = () => songTrackOffset || songs[song].offset;

    const onRecordSubmit = e => {
        e.preventDefault();
        if (!recorder) {
            if (!name)
                alert("Bitte einen Namen eingeben!");
            else if (!register)
                alert("Bitte eine Stimmlage auswählen!");
            else if (!song)
                alert("Bitte einen Song auswählen!");
            else {
                localStorage.setItem("name", name);
                localStorage.setItem("register", register);
                localStorage.setItem("song", song);
                localStorage.setItem("playback", playback ? "true" : "false");
                setBusy(true);
                navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(stream => {
                    const recorder = RecordRTC(stream, {type: "audio"});
                    recorder.startRecording();
                    if (playback && playbackRef.current) {
                        playbackRef.current.currentTime = 0;
                        playbackRef.current.play();
                    }
                    setBusy(false);
                    setRecorder(recorder);
                });
            }
        } else {
            setBusy(true);
            if (playback && playbackRef.current)
                playbackRef.current.pause();
            recorder.stopRecording(() => {
                const internalRecorder = recorder.getInternalRecorder().getInternalRecorder();
                internalRecorder._stream.getTracks().forEach(track => track.stop());
                setBusy(false);
                setRecorder();
                setRecordingUri(recorder.toURL());
            });
        }
    };

    const onUploadClick = () => {
        const offset = recordingTrackOffset - getSongTrackOffset();
        const gain = recordingTrackGain / songTrackGain;
        setBusy(true);
        uploadTrack(recordingUri, name, register, song, offset, gain)
            .then(onDiscardClick)
            .then(() => setBusy(false));
    };

    const onDiscardClick = () => {
        setRecordingUri();
        setIsPlaying(false);
        setIsSongTrackReady();
        setIsRecordingTrackReady();
        setSongTrackGain();
        setSongTrackOffset();
        setSongTrackGain();
        setRecordingTrackOffset();
    };

    const recordDisabled = busy || recorder || recordingUri;
    const uploadDisabled = busy || !isSongTrackReady || !isRecordingTrackReady;

    return html`
        <h4 style="margin-bottom: 15px;">Aufnehmen</h4>
        <form class="form form-inline my-2 my-lg-0" onsubmit=${onRecordSubmit}>
            <input type=text class="form-control mr-sm-2" placeholder="Dein Name" pattern="[A-Za-z0-9]+" value=${name} disabled=${recordDisabled} onchange=${e => setName(e.target.value)} />
            <select class=custom-select class="form-control mr-sm-2" disabled=${recordDisabled} onchange=${e => setRegister(e.target.value)}>
                <option>Deine Stimmlage</option>
                ${registers.map(_register => html`
                    <option value=${_register} selected=${register === _register}>${_register}</option>
                `)}
            </select>
            <select class=custom-select class="form-control mr-sm-2" disabled=${recordDisabled} onchange=${e => setSong(e.target.value)}>
                <option>Welcher Song?</option>
                ${Object.keys(songs).map((_song) => html`
                    <option value=${_song} selected=${song === _song}>${_song}</option>
                `)}
            </select>
            <div class=form-check>
                <input class=form-check-input type=checkbox id=playback checked=${playback} disabled=${recordDisabled} onchange=${e => setPlayback(e.target.checked)} />
                <label class=form-check-label for=playback style="margin-right: 1rem; user-select: none;">Playback</label>
            </div>
            <input type=submit class="btn ${busy || recordingUri ? "btn-outline-secondary" : recorder ? "btn-outline-danger" : "btn-outline-success"} my-2 my-sm-0" 
                value=${recorder ? "Aufnahme stoppen ..." : "Aufnahme starten!"} disabled=${busy || recordingUri} />
        </form>
        ${song && !recordingUri && html`
            <br />
            <iframe src="songs/${song}.pdf" style="width: 100%; height: 100vh;" frameborder="0"></iframe>
            <audio src="songs/${song}.mp3" ref=${playbackRef} />
        `}
        ${recordingUri && html`
            <${Track} title="Song" src="songs/${song}.mp3" offset=${getSongTrackOffset()} gain=${songTrackGain}
                onOffsetUpdated=${setSongTrackOffset} onGainUpdated=${setSongTrackGain}
                isPlaying=${isPlaying} onSetIsPlaying=${setIsPlaying} showPlayButton=${false}
                onReady=${() => setIsSongTrackReady(true)} />
            <${Track} title="Deine Aufnahme" src=${recordingUri} offset=${recordingTrackOffset} gain=${recordingTrackGain}
                onOffsetUpdated=${setRecordingTrackOffset} onGainUpdated=${setRecordingTrackGain}
                isPlaying=${isPlaying} onSetIsPlaying=${setIsPlaying} showPlayButton=${false}
                onReady=${() => setIsRecordingTrackReady(true)} />
            <p />
            <${PlayButton} isPlaying=${isPlaying} onClick=${() => setIsPlaying(!isPlaying)} disabled=${uploadDisabled} />
            <button class="btn btn-outline-success" style="margin-right: 6px;" disabled=${uploadDisabled} onclick=${onUploadClick}>Hochladen</button>
            <button class="btn btn-outline-danger" onclick=${onDiscardClick}>Verwerfen</button>
        `}
    `;
};

const Mix = () => {
    const [selectedTrackIds, setSelectedTracksIds] = useState([]);
    const [readyTracksIds, setReadyTracksIds] = useState([]);
    const [playingTrackIds, setPlayingTracksIds] = useState([]);

    useEffect(() => {
        if (location.hash)
            setSelectedTracksIds(JSON.parse(atob(location.hash.substr(1))));
    }, []);

    const isReady = selectedTrackIds.length === readyTracksIds.length;
    const isPlaying = playingTrackIds.length > 0;
    const selectedTracks = selectedTrackIds.map(id => tracks.find(track => track.id === id));
    const addReadyTrack = id => () => setReadyTracksIds(readyTracksIds => [...readyTracksIds, id]);
    const formatDate = date => date.getDate() + "." + ("0" + (date.getMonth() + 1)).slice(-2) + " " + date.getHours() + ":" + date.getMinutes();

    const setPlayingTrack = id => isPlaying => setPlayingTracksIds(playingTrackIds => {
        if (isPlaying)
            return playingTrackIds.indexOf(id) === -1 ? [...playingTrackIds, id] : playingTrackIds;
        else
            return playingTrackIds.indexOf(id) !== -1 ? playingTrackIds.filter(_id => _id !== id) : playingTrackIds;
    });

    const onTracksSelected = e => {
        const newSelectedTrackIds = [...e.target.options].filter(o => o.selected).map(o => o.value);
        setReadyTracksIds(readyTrackIds => readyTrackIds.filter(id => newSelectedTrackIds.indexOf(id) !== -1));
        setPlayingTracksIds(playingTrackIds => playingTrackIds.filter(id => newSelectedTrackIds.indexOf(id) !== -1));
        setSelectedTracksIds(newSelectedTrackIds);
        location.hash = btoa(JSON.stringify(newSelectedTrackIds));
    };

    const onResetClick = e => {
        e.preventDefault();
        if (confirm("Sicher? Dies löscht alle Aufnahmen."))
            post({reset: true}).then(() => location.reload());
    };

    const onPlayClick = () => {
        if (isPlaying)
            setPlayingTracksIds([]);
        else
            setPlayingTracksIds(selectedTrackIds);
    };

    return html`
        <button class="btn btn-outline-danger" style="float: right;" onclick=${onResetClick}>Alles löschen</button>
        <h4>Abmischen</h4>
        <select class=custom-select multiple style="clear: both; margin: 20px 0;" size=${selectedTracks.length > 0 ? 5 : 20} onchange=${onTracksSelected}>
            ${tracks.map(({id, name, register, song, date}) =>
                html`<option value=${id} selected=${selectedTrackIds.indexOf(id) !== -1}><strong>${formatDate(date)} ${song}</strong> ${name} (${register})</option>`)}
        </select>
        ${selectedTracks.length > 0 && html`
            <${PlayButton} isPlaying=${isPlaying} onClick=${onPlayClick} disabled=${!isReady} />
            ${selectedTracks.map(({id, name, register, song, date, md5, offset, gain}) => html`
                <${Track} key=${id} title=${html`<strong>${formatDate(date)} ${song}</strong> ${name} (${register})`}
                    src="tracks/${md5}.dat" offset=${parseFloat(offset)} gain=${parseFloat(gain)}
                    onOffsetUpdated=${() => {}} onGainUpdated=${() => {}}
                    isPlaying=${playingTrackIds.indexOf(id) !== -1} onSetIsPlaying=${setPlayingTrack(id)}
                    onReady=${addReadyTrack(id)} />
            `)}
        `}
    `
};

const App = () => html`
    <${Navigation} activeHref=${location.pathname.indexOf(".") !== -1 ? location.pathname : "index.html"} />
    <div class=container style="margin-bottom: 20px;">
        <br />
        ${location.pathname.indexOf("mix.html") !== -1
            ? html`<${Mix} path=/mix.html />`
            : html`<${Index} />`}
    </div>
`;

render(html`<${App} />`, document.body);