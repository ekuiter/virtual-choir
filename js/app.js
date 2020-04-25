// can be bundled with something like:
// parcel build js\app.js --out-dir js --out-file app.min.js --experimental-scope-hoisting
// this d Microsoft Edge

const {html, render, useState, useEffect, useRef} = window.htmPreact;
const snippetDuration = 25;

// localization
const translationMap = {
    en: {
        title: "Virtual Choir",
        language: "Language",
        en: "English",
        de: "Deutsch",
        record: "Record",
        mix: "Mix",
        listen: "Listen",
        admin: "Admin",
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
        testPermission: "Test permission",
        permissionMissing: "You did not grant the permission to start recording.",
        startRecording: "Start recording!",
        stopRecording: "Stop recording ...",
        recording: "Your recording",
        upload: "Upload",
        discard: "Discard",
        singleSong: "Please choose only recordings of a single song.",
        delete: "Delete",
        deleteSelected: "Delete selected",
        confirmDelete: "Sure? This will delete the recording.",
        confirmDeleteSelected: "Sure? This will delete the selected recordings.",
        microphoneSettings: "Microphone settings",
        browserSupport: "Browser support",
        info: "Info",
        nameHelp: "Your name so that you can identify your own recording.",
        registerHelp: "Determines your voice's balance when mixing to simulate a choir arrangement.",
        songHelp: "Choose the song you want to sing. This makes it easier to synchronize your recording.",
        playbackHelp: "Plays the song in the background while recording.",
        saveChanges: "Save changes",
        confirmClose: "There are unsaved changes.",
        download: "Download",
        backupSection: "Backup & restore data",
        backup: "Backup",
        restore: "Restore",
        confirmRestore: "Sure? This will replace all recordings.",
    },
    de: {
        title: "Virtueller Chor",
        language: "Sprache",
        en: "English",
        de: "Deutsch",
        record: "Aufnehmen",
        mix: "Abmischen",
        listen: "Anhören",
        admin: "Admin",
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
        permissionMissing: "Erlaubnis zur Aufnahme wurde nicht erteilt.",
        testPermission: "Berechtigung testen",
        startRecording: "Aufnahme starten!",
        stopRecording: "Aufnahme stoppen ...",
        recording: "Deine Aufnahme",
        upload: "Hochladen",
        discard: "Verwerfen",
        singleSong: "Bitte nur Aufnahmen eines einzelnen Songs wählen.",
        delete: "Löschen",
        deleteSelected: "Auswahl löschen",
        confirmDelete: "Sicher? Dies löscht die Aufnahme.",
        confirmDeleteSelected: "Sicher? Dies löscht alle ausgewählten Aufnahmen.",
        microphoneSettings: "Mikrofon-Einstellungen",
        browserSupport: "Browser-Unterstützung",
        info: "Info",
        nameHelp: "Dein Name, damit du die Aufnahme später wiederfinden kannst.",
        registerHelp: "Bestimmt die Balance deiner Stimme beim Abmischen, um eine Choraufstellung zu simulieren.",
        songHelp: "Wähle den Song aus, den du singen möchtest, um das Synchronisieren deiner Aufnahme zu erleichtern.",
        playbackHelp: "Spielt den Song bei der Aufnahme im Hintergrund ab.",
        saveChanges: "Änderungen speichern",
        confirmClose: "Nicht alle Änderungen wurden gespeichert.",
        download: "Herunterladen",
        backupSection: "Daten sichern & wiederherstellen",
        backup: "Sichern",
        restore: "Wiederherstellen",
        confirmRestore: "Sicher? Dies ersetzt alle Aufnahmen.",
    }
};

const language = localStorage.getItem("language") || config.defaultLanguage || "en";
const t = key => translationMap[language][key] || translationMap.en[key];

const formatDate = (date, sep = " ") => ("0" + date.getDate()).slice(-2) + "." + ("0" + (date.getMonth() + 1)).slice(-2) + "." +
    sep + ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2);

const setLanguage = language => {
    localStorage.setItem("language", language);
    location.reload();

};

// navigation
const navigation = [
    {title: t`record`, href: "index.html"},
    {title: t`mix`, href: "mix.html"},
    {title: t`listen`, href: "listen.html"},
    {title: "π", href: "admin.html"}
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
        <a class=navbar-brand href=index.html>${config.title || t`title`}</a>
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
            <form class="form-inline my-2 my-lg-0">
                <select class=custom-select class="form-control mr-sm-2" onchange=${e => setLanguage(e.target.value)} title=${t`language`}>
                    ${Object.keys(translationMap).map(_language => html`
                        <option value=${_language} selected=${language === _language}>
                            ${t(_language)}
                        </option>
                    `)}
                </select>
            </form>
        </div>
    </nav>
`;

const IconButton = ({onClick, icon, children, minWidth, isVisible = true, style = "height: 38px;", margin = "6px 6px 6px 0",
        invisibleMargin = "6px 0", className = "", ...props}) => html `
    <button class="btn btn-light ${className}" onclick=${onClick}
        style="${style} ${isVisible ?
            `visibility: visible; min-width: ${minWidth}px; padding: 0 12px 0 6px; margin: ${margin};`
            : `visibility: hidden; width: 0; padding: 0; margin: ${invisibleMargin};`}" ...${props}>
        ${isVisible && html`
            <img src=${icon} width="24" height="24" style="float: left; padding: 0 3px 0 0;" />
            ${children}
        `}
    </button>
`;

const PlayButton = ({isPlaying, onClick, ...props}) =>
    isPlaying
        ? html`<${IconButton} icon="img/stop.svg" onClick=${onClick} minWidth=120 ...${props}>${t`stop`}<//>`
        : html`<${IconButton} icon="img/play.svg" onClick=${onClick} minWidth=120 ...${props}>${t`play`}<//>`;

const Track = ({title, src, offset = 0.5, gain = 1, displaySeconds = 5.0, onReady,
    isPlaying, onSetIsPlaying, onOffsetUpdated, onGainUpdated, showPlayButton = true,
    gainMin = 0.01, gainMax = 2, height = 140, margin = 8, topDiff = 35}) => {
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
        <div style="position: relative; border: 1px solid rgba(200, 200, 200, 0.5); border-radius: 6px; margin: ${margin}px 0;">
            <div style=${peaks ? "display: none;" : "position: absolute; left: calc(50% - 50px);"}>
                <img src="img/loading.gif" width="100" height="100" style="margin-top: 20px;" />
            </div>
            <audio src=${src} ref=${audioRef} onended=${() => onSetIsPlaying && onSetIsPlaying(false)} />
            <div ref=${zoomviewRef} style="height: ${height}px; ${peaks && onOffsetUpdated ? "cursor: move;" : ""}" />
            <div style=${peaks ? `position: absolute; top: ${height - topDiff}px; width: 100%; display: flex; flex-basis: 1;`: "display: none;"}>
                <div class="form-group form-inline" style="margin-bottom: 0; flex-grow: 1;">
                    <strong style="padding: 0 20px 0 10px">${title}</strong>
                </div>
                <div class="form-group form-inline" style="margin-bottom: 0;">
                    <label>
                        <span style="margin-top: -3px; padding: 0 20px 0 10px;">${t`volume`}</span>
                        <input type=range class=custom-range min=${gainMin} max=${gainMax} step=0.01
                            style="margin: 0 ${showPlayButton ? "20px" : "10px"} 0 0;" value=${gain} oninput=${onGainInput} />
                    </label>
                </div>
                <${PlayButton} isPlaying=${isPlaying} isVisible=${showPlayButton} margin="0 7px 0 0" invisibleMargin="0" className=btn-sm style=""
                    onClick=${() => onSetIsPlaying && onSetIsPlaying(!isPlaying)} />
            </div>
        </div>
    `;
};

const Record = ({recordingTimeout = 500}) => {
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
                    window.setTimeout(() => {
                        setBusy(false);
                        setRecorder(recorder);
                    }, recordingTimeout);
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
        <form class="form form-inline my-2 my-lg-0" onsubmit=${onRecordSubmit}>
            <input type=text class="form-control mr-sm-2" placeholder=${t`name`} value=${name} disabled=${recordDisabled} onchange=${e => setName(e.target.value)} title=${t`nameHelp`} />
            <select class=custom-select class="form-control mr-sm-2" disabled=${recordDisabled} onchange=${e => setRegister(e.target.value)} title=${t`registerHelp`}>
                <option>${t`register`}</option>
                ${Object.keys(config.registers).map(_register => html`
                    <option value=${typeof config.registers[_register].value !== "undefined" ? "" + config.registers[_register].value : _register} selected=${register === _register}>
                        ${_register}
                    </option>
                `)}
            </select>
            <select class=custom-select class="form-control mr-sm-2" disabled=${recordDisabled} onchange=${e => setSong(e.target.value)} title=${t`songHelp`}>
                <option>${t`song`}</option>
                ${Object.keys(config.songs).map((_song) => html`
                    <option value=${_song} selected=${song === _song}>${_song}</option>
                `)}
            </select>
            <div class=form-check>
                <input class=form-check-input type=checkbox id=playback checked=${playback} disabled=${recordDisabled} onchange=${e => setPlayback(e.target.checked)} title=${t`playbackHelp`} />
                <label class=form-check-label for=playback style="margin-right: 1rem; user-select: none;" title=${t`playbackHelp`}>${t`playback`}</label>
            </div>
            <input type=submit class="btn ${busy || recordingUri ? "btn-outline-secondary" : recorder ? "btn-outline-danger" : "btn-outline-success"} my-2 my-sm-0" 
                value=${recorder ? t`stopRecording` : t`startRecording`} disabled=${busy || recordingUri} />
        </form>
        ${song && !recordingUri && html`
            <br />
            ${config.songs[song].pdf !== false && html`
                <iframe src=${typeof config.songs[song].pdf === "string" ? config.songs[song].pdf : `songs/${song}.pdf`}
                    style="width: 100%; height: 100vh;" frameborder="0">
                </iframe>
            `}
            <audio src="songs/${song}.mp3" ref=${playbackRef} />
        `}
        ${recordingUri && html`
            <${Track} title=${song} src="songs/${song}.mp3" offset=${getSongTrackOffset()} gain=${songTrackGain}
                onOffsetUpdated=${setSongTrackOffset} onGainUpdated=${setSongTrackGain}
                isPlaying=${isPlaying} onSetIsPlaying=${setIsPlaying} showPlayButton=${false}
                onReady=${() => setIsSongTrackReady(true)} margin=20 />
            <${Track} title=${t`recording`} src=${recordingUri} offset=${getRecordingTrackOffset()} gain=${recordingTrackGain}
                onOffsetUpdated=${setRecordingTrackOffset} onGainUpdated=${setRecordingTrackGain}
                isPlaying=${isPlaying} onSetIsPlaying=${setIsPlaying} showPlayButton=${false}
                onReady=${() => setIsRecordingTrackReady(true)} margin=20 />
            <${PlayButton} isPlaying=${isPlaying} onClick=${() => setIsPlaying(!isPlaying)} disabled=${uploadDisabled} />
            <button class="btn btn-outline-success" style="margin-right: 6px;" disabled=${uploadDisabled} onclick=${onUploadClick}>${t`upload`}</button>
            <button class="btn btn-outline-danger" onclick=${onDiscardClick}>${t`discard`}</button>
        `}
    `;
};

const Mix = ({debounceApiCalls = 500}) => {
    const initialSong = location.hash ? JSON.parse(atob(location.hash.substr(1)))[0] : [];
    const initialSelectedTrackIds = location.hash ? JSON.parse(atob(location.hash.substr(1)))[1] : [];

    const [busy, setBusy] = useState(false);
    const [song, setSong] = useState(initialSong);
    const [selectedTrackIds, setSelectedTrackIds] = useState(initialSelectedTrackIds);
    const [readyTrackIds, setReadyTrackIds] = useState([]);
    const [playingTrackIds, setPlayingTrackIds] = useState([]);
    const [songTrackPlaying, setSongTrackPlaying] = useState();
    const [songTrackReady, setSongTrackReady] = useState();
    const [songTrackGain, setSongTrackGain] = useState(1);
    const [pendingApiCalls, setPendingApiCalls] = useState([]);
    const [pendingApiCall, setPendingApiCall] = useState();
    const debouncedPendingApiCall = useDebounce(pendingApiCall, debounceApiCalls);

    useEffect(() => {
        const onHashChange = () => {
            setSong(JSON.parse(atob(location.hash.substr(1)))[0]);
            setSelectedTrackIds(JSON.parse(atob(location.hash.substr(1)))[1]);
        }
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
        if (debouncedPendingApiCall) {
            setBusy(false);
            addPendingApiCall(debouncedPendingApiCall);
        }
    }, [debouncedPendingApiCall]);

    useEffect(() => {
        window.onbeforeunload = pendingApiCalls.length > 0 && (() => t`confirmClose`);
    }, [pendingApiCalls]);

    const isReady = songTrackReady === song && selectedTrackIds.length === readyTrackIds.length;
    const isPlaying = songTrackPlaying === song || playingTrackIds.length > 0;
    const getSelectedTracks = selectedTrackIds => selectedTrackIds.map(id => tracks.find(track => track.id === id));
    const addReadyTrack = id => () => setReadyTrackIds(readyTrackIds => [...readyTrackIds, id]);
    const addPendingApiCall = pendingApiCall => setPendingApiCalls(pendingApiCalls => [...pendingApiCalls, pendingApiCall]);
    const getHash = (_song = song, _selectedTrackIds = selectedTrackIds) => btoa(JSON.stringify([_song, _selectedTrackIds]));
    const getName = (name, register) => register !== "null" ? html`<span>${name}, <em>${register}</em></span>` : html`<span>${name}</span>`;

    const setPlayingTrack = id => isPlaying => setPlayingTrackIds(playingTrackIds => {
        if (isPlaying)
            return playingTrackIds.indexOf(id) === -1 ? [...playingTrackIds, id] : playingTrackIds;
        else
            return playingTrackIds.indexOf(id) !== -1 ? playingTrackIds.filter(_id => _id !== id) : playingTrackIds;
    });

    const onSongSelected = e => {
        const newSong = e.target.value;
        setSong(newSong);
        setReadyTrackIds([]);
        setPlayingTrackIds([]);
        setSongTrackPlaying(null);
        setSelectedTrackIds([]);
        location.hash = getHash(newSong, []);
    };

    const onTracksSelected = e => {
        const newSelectedTrackIds = [...e.target.options].filter(o => o.selected).map(o => o.value);
        setReadyTrackIds(readyTrackIds => readyTrackIds.filter(id => newSelectedTrackIds.indexOf(id) !== -1));
        setPlayingTrackIds([]);
        setSongTrackPlaying(null);
        setSelectedTrackIds(newSelectedTrackIds);
        location.hash = getHash(song, newSelectedTrackIds);
    };

    const onDeleteSelectedClick = e => {
        e.preventDefault();
        if (confirm(t`confirmDeleteSelected`))
            post({deleteSelected: getHash()}).then(() => location.href = "mix.html");
    };

    const onPlayClick = e => {
        e.preventDefault();
        if (isPlaying) {
            setPlayingTrackIds([]);
            setSongTrackPlaying(null);
        } else {
            setPlayingTrackIds(selectedTrackIds);
            setSongTrackPlaying(song);
        }
    };

    const onSaveChangesClick = e => {
        e.preventDefault();
        setBusy(true);
        pendingApiCalls
            .reduce((promise, pendingApiCall) => promise.then(() => post(pendingApiCall)), Promise.resolve())
            .then(() => {
                setPendingApiCalls([]);
                setBusy(false);
            });
    };

    return html`
        <h4 style="margin-bottom: 15px;">${t`mix`}</h4>
        <form class=form-inline>
            <select class=custom-select class="form-control mr-sm-2" name=song onchange=${onSongSelected}>
                <option>${t`song`}</option>
                ${Object.keys(config.songs).map((_song) => html`
                    <option value=${_song} selected=${song === _song}>${_song}</option>
                `)}
            </select>
            <button class="btn btn-outline-danger" style=${selectedTrackIds.length > 0 ? "" : "visibility: hidden;"} onclick=${onDeleteSelectedClick}>
                ${t`deleteSelected`}
            </button>
        </form>
        ${song && config.songs.hasOwnProperty(song) && html`
            <select class=custom-select multiple style="clear: both; margin: 15px 0;" size=${selectedTrackIds.length > 0 ? 6 : 20} onchange=${onTracksSelected}>
                ${tracks
                    .filter(track => track.song === song)
                    .map(({id, name, register, date}) =>
                    html`<option value=${id} selected=${selectedTrackIds.indexOf(id) !== -1}><strong>${formatDate(date)}</strong> | ${getName(name, register)}</option>`)}
            </select>
            ${selectedTrackIds.length > 0 && html`
                <div style="display: flex; flex-basis: 1;">
                    <div class="form-group form-inline" style="margin-bottom: 0; flex-grow: 1;">
                        <form action=php/app.php method=post class=form-inline>
                            <input type=hidden name=mix value=${getHash()} />
                            <label class=form-check-label style="margin: 2px 5px 0 0;" title=${t`playbackHelp`}>
                                <input class="form-check-input" type="checkbox" name="playback" />
                                <span>${t`playback`}</span>
                            </label>
                            <label style="margin-top: 6px;">
                                <span style="margin-top: -5px; padding: 0 20px 0 10px;">${t`volume`}</span>
                                <input type=range class=custom-range name=gain min=0 max=10 step=0.01 value=3 style="margin: 0 20px 0 0;" />
                            </label>
                            <input type="submit" class="btn btn-outline-success my-2 my-sm-0" value=${t`mix`} />
                            <button class="btn btn-outline-primary" style=${pendingApiCalls.length > 0 ? "margin-left: 6px;" : "display: none;"}
                                onclick=${onSaveChangesClick} disabled=${busy}>
                                ${t`saveChanges`}
                            </button>
                        </form>
                    </div>
                    <div class="form-group form-inline" style="margin-bottom: 0;">
                        <${PlayButton} isPlaying=${isPlaying} onClick=${onPlayClick} disabled=${!isReady} />
                    </div>
                </div>
                <${Track} key=${song} title=${song} src="songs/${song}.mp3" offset=${config.songs[song].offset}
                    gain=${songTrackGain} gainMin=0 gainMax=5 onGainUpdated=${setSongTrackGain} isPlaying=${songTrackPlaying === song}
                    onSetIsPlaying=${isPlaying => setSongTrackPlaying(isPlaying && song)}
                    onReady=${() => setSongTrackReady(song)} />
                ${getSelectedTracks(selectedTrackIds).map(track => {
                    const {id, name, register, song, md5, songOffset, recordingOffset, gain} = track;

                    const onOffsetUpdated = offset => {
                        track.recordingOffset = offset + (parseFloat(songOffset) - config.songs[song].offset);
                        setBusy(true);
                        setPendingApiCall({"setFor": id, "recordingOffset": track.recordingOffset});
                    };

                    const onGainUpdated = gain => {
                        track.gain = gain;
                        setBusy(true);
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
        `}
    `
};

const Listen = () => {
    const [mix, setMix] = useState(location.hash ? atob(location.hash.substr(1)) : null);

    useEffect(() => {
        const onHashChange = () => setMix(atob(location.hash.substr(1)));
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    const onMixChanged = e => {
        const newMix = e.target.value;
        setMix(newMix);
        location.hash = btoa(newMix);
    };

    const onDeleteClick = e => {
        e.preventDefault();
        if (confirm(t`confirmDelete`))
            post({deleteMix: btoa(mix)}).then(() => location.href = "listen.html");
    };

    return html`
        <h4 style="margin-bottom: 15px;">${t`listen`}</h4>
        <select style="margin-bottom: 15px;" class=custom-select size=20 onchange=${onMixChanged}>
            ${mixes.map(_mix =>
                html`<option value=${_mix} selected=${mix === _mix}>${_mix}</option>`)}
        </select>
        ${mix && html`
            <div style="display: flex; align-items: center;">
                <audio src="mixes/${mix}.mp3" controls style="margin-right: 6px;" />
                <button class="btn btn-outline-success" style="height: 40px; margin-right: 6px;" onclick=${() => location.href = `mixes/${mix}.mp3`}>
                    ${t`download`}
                </button>
                <button class="btn btn-outline-danger" style="height: 40px;" onclick=${onDeleteClick}>
                    ${t`delete`}
                </button>
            </div>
        `}
    `;
};

const Admin = () => {
    const [hasFile, setHasFile] = useState();

    const onTestClick = e => {
        e.preventDefault();
        navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(
            stream => window.alert("permission granted: " + stream),
            err => window.alert("permission denied: " + err));
    };

    const onRestoreClick = e => {
        if (hasFile && !confirm(t`confirmRestore`))
            e.preventDefault();
    };

    return html`
        <h4 style="margin-bottom: 15px;">
            ${t`admin`}
            <span style="font-size: 1rem; padding-left: 10px;"><a href="https://www.youtube.com/watch?v=pXPXMxsXT28">π</a></span>
        </h4>
        <p>
            <strong>Version</strong><br />
            <a href="https://github.com/ekuiter/virtual-choir">ekuiter/virtual-choir</a> ${formatDate(version)}
        </p>
        <p>
            <strong>${t`browserSupport`}</strong><br />
            ✔ Firefox 65-75, Chrome 79-81 (Windows 10, Ubuntu 18, macOS 14)<br />
            ✔ Chrome 81 (Android 7)<br />
            ✖ Internet Explorer, Edge 44 (Windows 10)<br />
            ✖ Safari (macOS 14)
        </p>
        <p>
            <strong>${t`microphoneSettings`}</strong> <button class="btn btn-outline-primary btn-sm" onclick=${onTestClick} style="padding: 0.15rem 0.4rem; margin: -0.3rem 0 0 0.6rem;">${t`testPermission`}</button><br />
            Chrome: <span style="font-family: monospace; font-size: 0.8rem; user-select: text;">chrome://settings/content/microphone</span><br />
            Firefox: <span style="font-family: monospace; font-size: 0.8rem; user-select: text;">about:preferences#privacy</span>
        </p>
        <strong>${t`backupSection`}</strong>
        <form enctype=multipart/form-data action=php/app.php method=post class=form-inline>
            <input type=hidden name=backup />
            <input type=file name=restore accept=.zip style="margin: 0 12px 0 0;" onChange=${e => setHasFile(e.target.files.length > 0)} />
            <input type=submit class="btn btn-outline-danger" onclick=${onRestoreClick} value=${hasFile ? t`restore` : t`backup`} />
        </form>
    `;
};

const App = () => html`
    <${Navigation} activeHref=${location.pathname.indexOf(".") !== -1 ? location.pathname : "index.html"} />
    <div class=container style="margin-bottom: 20px;">
        <br />
        ${location.pathname.indexOf("mix.html") !== -1
            ? html`<${Mix} />`
            : location.pathname.indexOf("listen.html") !== -1
                ? html`<${Listen} />`
                : location.pathname.indexOf("admin.html") !== -1
                    ? html`<${Admin} />`
                    : html`<${Record} />`}
    </div>
`;

document.title = config.title || t`title`;
render(html`<${App} />`, document.body);