const {html, render, useState, useEffect, useRef} = window.htmPreact;
const Peaks = window.peaks;
const snippetDuration = 25;

// localization
const translationMap = {
    en: {
        record: "Record",
        mix: "Mix",
        stop: "Stop",
        play: "Play",
        volume: "Volume",
        name: "Your name",
        register: "Your register",
        song: "Which song?",
        playback: "Playback",
        nameMissing: "Please type in a name!",
        registerMissing: "Please choose a register!",
        songMissing: "Please choose a song!",
        permissionMissing: "Your permission is required to start recording.",
        startRecording: "Start recording!",
        stopRecording: "Stop recording ...",
        recording: "Your recording",
        upload: "Upload",
        discard: "Discard",
        singleSong: "Please choose only recordings of a single song.",
        reset: "Delete all",
        deleteSelected: "Delete selected",
        confirmReset: "Sure? This will delete all recordings.",
        confirmDeleteSelected: "Sure? This will delete the selected recordings."
    },
    de: {
        record: "Aufnehmen",
        mix: "Abmischen",
        stop: "Stoppen",
        play: "Abspielen",
        volume: "Lautstärke",
        name: "Dein Name",
        register: "Deine Stimmlage",
        song: "Welcher Song?",
        playback: "Playback",
        nameMissing: "Bitte einen Namen eingeben!",
        registerMissing: "Bitte eine Stimmlage auswählen!",
        songMissing: "Bitte einen Song auswählen!",
        permissionMissing: "Deine Erlaubnis wird benötigt, um die Aufnahme zu starten.",
        startRecording: "Aufnahme starten!",
        stopRecording: "Aufnahme stoppen ...",
        recording: "Deine Aufnahme",
        upload: "Hochladen",
        discard: "Verwerfen",
        singleSong: "Bitte nur Aufnahmen eines einzelnen Songs wählen.",
        reset: "Alles löschen",
        deleteSelected: "Auswahl löschen",
        confirmReset: "Sicher? Dies löscht alle Aufnahmen.",
        confirmDeleteSelected: "Sicher? Dies löscht alle ausgewählten Aufnahmen."
    }
};

const t = key => translationMap[config.language || "en"][key];

// navigation
const navigation = [
    {title: t`record`, href: "index.html"},
    {title: t`mix`, href: "mix.html"},
    {title: "GitHub", href: "https://github.com/ekuiter/virtual-choir"}
];

// API
function post(params) {
    const data = new FormData();
    for (const key in params)
        data.append(key, params[key]);
    return window.fetch("php/app.php", {method: "POST", body: data});
}

const uploadTrack = (blobUri, name, register, song, songOffset, recordingOffset, gain) =>
    fetch(blobUri)
        .then(res => res.blob())
        .then(blob => post({
            name, register, song, songOffset, recordingOffset, gain,
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
    return (ctx, src) => {
        if (cache[src])
            return Promise.resolve(cache[src]);
        return fetch(src)
            .then(res => res.arrayBuffer())
            .then(arrayBuffer => new Promise(resolve => ctx.resume().then(() => ctx.decodeAudioData(arrayBuffer, resolve))))
            .then(duration
                ? audioBuffer => {
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

// React hook for debounced API calls
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(
      () => {
        const timeout = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timeout);
      },
      [value]
    );
    return debouncedValue;
  }

// React components
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
        ? html`<${IconButton} icon="img/stop.svg" onClick=${onClick} ...${props}>${t`stop`}<//>`
        : html`<${IconButton} icon="img/play.svg" onClick=${onClick} ...${props}>${t`play`}<//>`;

const Track = ({title, src, offset = 0.5, gain = 1, displaySeconds = 5.0, onReady,
    isPlaying, onSetIsPlaying, onOffsetUpdated, onGainUpdated, showPlayButton = true,
    gainMin = 0.01, gainMax = 2}) => {
    const [peaks, setPeaks] = useState();
    const audioRef = useRef();
    const zoomviewRef = useRef();
    const gainNodeRef = useRef();
    
    useEffect(() => {
        const ctx = new (AudioContext || webkitAudioContext)();
        const source = ctx.createMediaElementSource(audioRef.current);
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.gain.value = gain;
        source.connect(gainNodeRef.current);

        if (offset < 0) {
            offset *= -1;
            const delayNode = ctx.createDelay(offset);
            delayNode.delayTime.value = offset;
            gainNodeRef.current.connect(delayNode);
            delayNode.connect(ctx.destination);
        } else
            gainNodeRef.current.connect(ctx.destination);

        Promise.all([
            new Promise(resolve => require(["main"], resolve)),
            fetchAudioBuffer(ctx, src)
        ]).then(([Peaks, audioBuffer]) => {
            const options = {
                editable: !!onOffsetUpdated,
                containers: {
                    zoomview: zoomviewRef.current
                },
                mediaElement: audioRef.current,
                webAudio: {
                    audioContext: ctx,
                    audioBuffer
                },
                zoomLevels: [1],
                points: [{
                    id: "offset",
                    time: offset >= 0 ? offset : 0,
                    editable: false
                }]
            };
            Peaks.init(options, (err, peaks) => {
                if (!err) {
                    peaks.views.getView("zoomview").setZoom({seconds: displaySeconds});
                    peaks.views.getView("zoomview").setStartTime(offset >= 0 ? offset : 0);
                    peaks.views.getView("zoomview").enableAutoScroll(false);
                    peaks.player.seek(peaks.points.getPoint("offset").time);
                    peaks.on("points.offsetUpdated", offset => {
                        console.log("offset = ", offset);
                        if (onSetIsPlaying)
                            onSetIsPlaying(false);
                        if (onOffsetUpdated)
                            onOffsetUpdated(offset);
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
        if (onGainUpdated) {
            console.log("gain = ", gain);
            onGainUpdated(gain);
        }
    };

    return html`
        <h5 style="margin-top: 20px;">${title}</h5>
        <div style=${peaks ? "display: none;" : "position: absolute; left: calc(50% - 50px);"}>
            <img src="img/loading.gif" width="100" height="100" style="margin-top: 20px;" />
        </div>
        <audio src=${src} ref=${audioRef} onended=${() => onSetIsPlaying && onSetIsPlaying(false)} />
        <div ref=${zoomviewRef} style="height: 140px; ${peaks && onOffsetUpdated ? "cursor: move;" : ""}" />
        <div style=${peaks ? "display: flex;" : "display: none;"}>
            ${showPlayButton && html`<${PlayButton} isPlaying=${isPlaying} onClick=${() => onSetIsPlaying && onSetIsPlaying(!isPlaying)} />`}
            <div class="form-group form-inline">
                <label style="margin-top: 6px;">
                    <span style="margin-top: -3px; padding: 0 20px 0 10px;">${t`volume`}</span>
                    <input type=range class=custom-range min=${gainMin} max=${gainMax} step=0.01
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
    const [playback, setPlayback] = useState(localStorage.getItem("playback") !== "false");
    const [busy, setBusy] = useState();
    const [recorder, setRecorder] = useState();
    const [recordingUri, setRecordingUri] = useState();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSongTrackReady, setIsSongTrackReady] = useState(false);
    const [isRecordingTrackReady, setIsRecordingTrackReady] = useState(false);
    const [songTrackOffset, setSongTrackOffset] = useState();
    const [recordingTrackOffset, setRecordingTrackOffset] = useState();
    const [songTrackGain, setSongTrackGain] = useState(1);
    const [recordingTrackGain, setRecordingTrackGain] = useState(1);
    const playbackRef = useRef();

    const getSongTrackOffset = () => songTrackOffset ||
        ((config.songs[song].registerOffsets && config.songs[song].registerOffsets[register]) || config.songs[song].offset);
    const getRecordingTrackOffset = () => recordingTrackOffset ||
        ((config.songs[song].registerOffsets && config.songs[song].registerOffsets[register]) || config.songs[song].offset);

    const onRecordSubmit = e => {
        e.preventDefault();
        if (!recorder) {
            if (!name)
                alert(t`nameMissing`);
            else if (!register)
                alert(t`registerMissing`);
            else if (!song)
                alert(t`songMissing`);
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
                }, () => {
                    setBusy(false);
                    window.alert(t`permissionMissing`);
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
        setBusy(true);
        const gain = !isNaN(recordingTrackGain / songTrackGain) ? recordingTrackGain / songTrackGain : 1;
        uploadTrack(recordingUri, name, register, song, getSongTrackOffset(), getRecordingTrackOffset(), gain)
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
        <h4 style="margin-bottom: 15px;">${t`record`}</h4>
        <p style="font-size: 0.8rem; color: #555;">
            Version: 2019-04-23 11:50<br />
            ☑ Firefox 65-75, Chrome 79-81 (Windows 10, Ubuntu 18, macOS 14)<br />
            ☑ Chrome 81 (Android 7)<br />
            ☒ Internet Explorer, Edge 44 (Windows 10)<br />
            ☒ Safari (macOS 14)
        </span>
        <form class="form form-inline my-2 my-lg-0" onsubmit=${onRecordSubmit}>
            <input type=text class="form-control mr-sm-2" placeholder=${t`name`} pattern="[A-Za-z0-9]+" value=${name} disabled=${recordDisabled} onchange=${e => setName(e.target.value)} />
            <select class=custom-select class="form-control mr-sm-2" disabled=${recordDisabled} onchange=${e => setRegister(e.target.value)}>
                <option>${t`register`}</option>
                ${Object.keys(config.registers).map(_register => html`
                    <option value=${typeof config.registers[_register].value !== "undefined" ? "" + config.registers[_register].value : _register} selected=${register === _register}>
                        ${_register}
                    </option>
                `)}
            </select>
            <select class=custom-select class="form-control mr-sm-2" disabled=${recordDisabled} onchange=${e => setSong(e.target.value)}>
                <option>${t`song`}</option>
                ${Object.keys(config.songs).map((_song) => html`
                    <option value=${_song} selected=${song === _song}>${_song}</option>
                `)}
            </select>
            <div class=form-check>
                <input class=form-check-input type=checkbox id=playback checked=${playback} disabled=${recordDisabled} onchange=${e => setPlayback(e.target.checked)} />
                <label class=form-check-label for=playback style="margin-right: 1rem; user-select: none;">${t`playback`}</label>
            </div>
            <input type=submit class="btn ${busy || recordingUri ? "btn-outline-secondary" : recorder ? "btn-outline-danger" : "btn-outline-success"} my-2 my-sm-0" 
                value=${recorder ? t`stopRecording` : t`startRecording`} disabled=${busy || recordingUri} />
        </form>
        ${song && !recordingUri && html`
            <br />
            <iframe src="songs/${song}.pdf" style="width: 100%; height: 100vh;" frameborder="0"></iframe>
            <audio src="songs/${song}.mp3" ref=${playbackRef} />
        `}
        ${recordingUri && html`
            <${Track} title=${song} src="songs/${song}.mp3" offset=${getSongTrackOffset()} gain=${songTrackGain}
                onOffsetUpdated=${setSongTrackOffset} onGainUpdated=${setSongTrackGain}
                isPlaying=${isPlaying} onSetIsPlaying=${setIsPlaying} showPlayButton=${false}
                onReady=${() => setIsSongTrackReady(true)} />
            <${Track} title=${t`recording`} src=${recordingUri} offset=${getRecordingTrackOffset()} gain=${recordingTrackGain}
                onOffsetUpdated=${setRecordingTrackOffset} onGainUpdated=${setRecordingTrackGain}
                isPlaying=${isPlaying} onSetIsPlaying=${setIsPlaying} showPlayButton=${false}
                onReady=${() => setIsRecordingTrackReady(true)} />
            <p />
            <${PlayButton} isPlaying=${isPlaying} onClick=${() => setIsPlaying(!isPlaying)} disabled=${uploadDisabled} />
            <button class="btn btn-outline-success" style="margin-right: 6px;" disabled=${uploadDisabled} onclick=${onUploadClick}>${t`upload`}</button>
            <button class="btn btn-outline-danger" onclick=${onDiscardClick}>${t`discard`}</button>
        `}
    `;
};

const Mix = ({debounceApiCalls = 250}) => {
    const [selectedTrackIds, setSelectedTracksIds] = useState([]);
    const [readyTracksIds, setReadyTracksIds] = useState([]);
    const [playingTrackIds, setPlayingTracksIds] = useState([]);
    const [songTrackPlaying, setSongTrackPlaying] = useState();
    const [songTrackReady, setSongTrackReady] = useState();
    const [songTrackGain, setSongTrackGain] = useState(1);
    const [pendingApiCall, setPendingApiCall] = useState();
    const debouncedPendingApiCall = useDebounce(pendingApiCall, debounceApiCalls);

    useEffect(() => {
        if (location.hash)
            setSelectedTracksIds(JSON.parse(atob(location.hash.substr(1))));
    }, []);

    useEffect(() => {
        if (debouncedPendingApiCall)
            post(debouncedPendingApiCall).then(() => setPendingApiCall());
    }, [debouncedPendingApiCall]);

    const getSelectedSong = () => {
        const track = tracks.find(track => track.id === selectedTrackIds[0]);
        if (track)
            return track.song;
    };

    const isReady = songTrackReady === getSelectedSong() && selectedTrackIds.length === readyTracksIds.length;
    const isPlaying = songTrackPlaying === getSelectedSong() || playingTrackIds.length > 0;
    const getSelectedTracks = selectedTrackIds => selectedTrackIds.map(id => tracks.find(track => track.id === id));
    const addReadyTrack = id => () => setReadyTracksIds(readyTracksIds => [...readyTracksIds, id]);
    const formatDate = date => ("0" + date.getDate()).slice(-2) + "." + ("0" + (date.getMonth() + 1)).slice(-2) +
        " " + ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2);
    const onlyUnique = (value, index, self) => self.indexOf(value) === index;
    const getHash = (_selectedTrackIds = selectedTrackIds) => btoa(JSON.stringify(_selectedTrackIds));
    const getName = (name, register) => register !== "null" ? html`<span>${name} <em>${register}</em></span>` : html`<span>${name}</span>`;

    const setPlayingTrack = id => isPlaying => setPlayingTracksIds(playingTrackIds => {
        if (isPlaying)
            return playingTrackIds.indexOf(id) === -1 ? [...playingTrackIds, id] : playingTrackIds;
        else
            return playingTrackIds.indexOf(id) !== -1 ? playingTrackIds.filter(_id => _id !== id) : playingTrackIds;
    });

    const onTracksSelected = e => {
        const newSelectedTrackIds = [...e.target.options].filter(o => o.selected).map(o => o.value);
        if (getSelectedTracks(newSelectedTrackIds).map(({song}) => song).filter(onlyUnique).length > 1)
            window.alert(t`singleSong`);
        else {
            setReadyTracksIds(readyTrackIds => readyTrackIds.filter(id => newSelectedTrackIds.indexOf(id) !== -1));
            setPlayingTracksIds([]);
            setSongTrackPlaying(null);
            setSelectedTracksIds(newSelectedTrackIds);
            location.hash = getHash(newSelectedTrackIds);
        }
    };

    const onResetClick = e => {
        e.preventDefault();
        if (confirm(t`confirmReset`))
            post({reset: true}).then(() => location.href = "mix.html");
    };

    const onDeleteSelectedClick = e => {
        e.preventDefault();
        if (confirm(t`confirmDeleteSelected`))
            post({deleteSelected: getHash()}).then(() => location.href = "mix.html");
    };

    const onPlayClick = e => {
        e.preventDefault();
        if (isPlaying) {
            setPlayingTracksIds([]);
            setSongTrackPlaying(null);
        } else {
            setPlayingTracksIds(selectedTrackIds);
            setSongTrackPlaying(getSelectedSong());
        }
    };

    return html`
        <button class="btn btn-outline-danger" style="float: right;" onclick=${onResetClick}>${t`reset`}</button>
        ${selectedTrackIds.length > 0 && html`
            <button class="btn btn-outline-danger" style="float: right; margin-right: 6px;" onclick=${onDeleteSelectedClick}>${t`deleteSelected`}</button>
        `}
        <h4>${t`mix`}</h4>
        <select class=custom-select multiple style="clear: both; margin: 20px 0;" size=${selectedTrackIds.length > 0 ? 6 : 20} onchange=${onTracksSelected}>
            ${tracks.map(({id, name, register, song, date}) =>
                html`<option value=${id} selected=${selectedTrackIds.indexOf(id) !== -1}><strong>${formatDate(date)} ${song}</strong> ${getName(name, register)}</option>`)}
        </select>
        ${selectedTrackIds.length > 0 && html`
            <form action=php/app.php method=post class=form-inline style="margin: 10px 0.3rem;">
            <${PlayButton} isPlaying=${isPlaying} onClick=${onPlayClick} disabled=${!isReady} />
                <input type=hidden name=mix value=${getHash()} />
                <label class=form-check-label style="margin: 0 15px;">
                    <input class="form-check-input" type="checkbox" name="playback" />
                    <span>${t`playback`}</span>
                </label>
                <label style="margin-top: 6px;">
                    <span style="margin-top: -5px; padding: 0 20px 0 10px;">${t`volume`}</span>
                    <input type=range class=custom-range name=gain min=0 max=10 step=0.01 value=5 style="margin: 0 20px 0 0;" />
                </label>
                <input type="submit" class="btn btn-outline-success my-2 my-sm-0" value=${t`mix`} />
            </form>
            <${Track} key=${getSelectedSong()} title=${getSelectedSong()} src="songs/${getSelectedSong()}.mp3" offset=${config.songs[getSelectedSong()].offset}
                gain=${songTrackGain} gainMin=0 gainMax=5 onGainUpdated=${setSongTrackGain} isPlaying=${songTrackPlaying === getSelectedSong()}
                onSetIsPlaying=${isPlaying => setSongTrackPlaying(isPlaying && getSelectedSong())}
                onReady=${() => setSongTrackReady(getSelectedSong())} />
            ${getSelectedTracks(selectedTrackIds).map(track => {
                const {id, name, register, song, md5, songOffset, recordingOffset, gain} = track;

                const onOffsetUpdated = offset => {
                    track.recordingOffset = offset + (parseFloat(songOffset) - config.songs[song].offset);
                    setPendingApiCall({"setFor": id, "recordingOffset": track.recordingOffset});
                };

                const onGainUpdated = gain => {
                    track.gain = gain;
                    setPendingApiCall({"setFor": id, "gain": track.gain});
                };

                return html`
                    <${Track} key=${id} title=${getName(name, register)}
                        src="tracks/${md5}.dat"
                        offset=${parseFloat(recordingOffset) - (parseFloat(songOffset) - config.songs[song].offset)}
                        gain=${parseFloat(gain)} gainMin=0 gainMax=5
                        onOffsetUpdated=${onOffsetUpdated} onGainUpdated=${onGainUpdated}
                        isPlaying=${playingTrackIds.indexOf(id) !== -1} onSetIsPlaying=${setPlayingTrack(id)}
                        onReady=${addReadyTrack(id)} />
                `;
            })}
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