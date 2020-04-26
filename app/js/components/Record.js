import {h, Fragment} from "preact";
import {useState, useRef} from "preact/hooks";
import RecordRTC from "recordrtc";
import {t} from "../i18n";
import {uploadTrack} from "../api";
import PlayButton from "./PlayButton";
import Track from "./Track";

const songs = server.config.songs;
const registers = server.config.registers;

export default ({recordingTimeout = 500}) => {
    if (localStorage.getItem("song") && ![localStorage.getItem("song")] ||
        localStorage.getItem("register") && !registers[localStorage.getItem("register")])
        localStorage.clear();

    const [name, setName] = useState(localStorage.getItem("name"));
    const [register, setRegister] = useState(localStorage.getItem("register"));
    const [song, setSong] = useState(localStorage.getItem("song"));
    const [score, setScore] = useState(localStorage.getItem("score") !== "false");
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
        ((songs[song].registerOffsets && songs[song].registerOffsets[register]) || songs[song].offset);
    const getRecordingTrackOffset = () => recordingTrackOffset ||
        ((songs[song].registerOffsets && songs[song].registerOffsets[register]) || songs[song].offset);

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
                localStorage.setItem("score", score ? "true" : "false");
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

    return (
        <>
            <h4 style="margin-bottom: 15px;">{t`record`}</h4>
            <form class="form form-inline my-2 my-lg-0" onsubmit={onRecordSubmit}>
                <input type="text" class="form-control mr-sm-2" placeholder={t`name`} value={name} disabled={recordDisabled} onchange={e => setName(e.target.value)} title={t`nameHelp`} />
                <select class="custom-select" class="form-control mr-sm-2" disabled={recordDisabled} onchange={e => setRegister(e.target.value)} title={t`registerHelp`}>
                    <option>{t`register`}</option>
                    {Object.keys(registers).map(_register => (
                        <option value={typeof registers[_register].value !== "undefined" ? "" + registers[_register].value : _register} selected={register === _register}>
                            {_register}
                        </option>
                    ))}
                </select>
                <select class="custom-select" class="form-control mr-sm-2" disabled={recordDisabled} onchange={e => setSong(e.target.value)} title={t`songHelp`}>
                    <option>{t`song`}</option>
                    {Object.keys(songs).map((_song) => <option value={_song} selected={song === _song}>{_song}</option>)}
                </select>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="score" checked={score} disabled={recordDisabled || (song && songs[song].pdf === false)}
                        onchange={e => setScore(e.target.checked)} title={t`scoreHelp`} />
                    <label class="form-check-label" for="score" style="margin-right: 1rem; user-select: none;" title={t`scoreHelp`}>{t`score`}</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="playback" checked={playback} disabled={recordDisabled} onchange={e => setPlayback(e.target.checked)} title={t`playbackHelp`} />
                    <label class="form-check-label" for="playback" style="margin-right: 1rem; user-select: none;" title={t`playbackHelp`}>{t`playback`}</label>
                </div>
                <input type="submit" class={`btn ${busy || recordingUri ? "btn-outline-secondary" : recorder ? "btn-outline-danger" : "btn-outline-success"} my-2 my-sm-0`} 
                    value={recorder ? t`stopRecording` : t`startRecording`} disabled={busy || recordingUri} />
            </form>
            {song && !recordingUri && (
                <>
                    <br />
                    {score && songs[song].pdf !== false && (
                        <iframe src={typeof songs[song].pdf === "string" ? songs[song].pdf : `songs/${song}.pdf`}
                            style="width: 100%; height: 100vh;" frameborder="0">
                        </iframe>
                    )}
                    <audio src={`songs/${song}.mp3`} ref={playbackRef} />
                </>
            )}
            {recordingUri && (
                <>
                    <Track title={song} src={`songs/${song}.mp3`} dataUri={`songs/${song}.json`}
                        offset={getSongTrackOffset()} gain={songTrackGain}
                        onOffsetUpdated={setSongTrackOffset} onGainUpdated={setSongTrackGain}
                        isPlaying={isPlaying} onSetIsPlaying={setIsPlaying} showPlayButton={false}
                        onReady={() => setIsSongTrackReady(true)} margin={20} />
                    <Track title={t`recording`} src={recordingUri} offset={getRecordingTrackOffset()} gain={recordingTrackGain}
                        onOffsetUpdated={setRecordingTrackOffset} onGainUpdated={setRecordingTrackGain}
                        isPlaying={isPlaying} onSetIsPlaying={setIsPlaying} showPlayButton={false}
                        onReady={() => setIsRecordingTrackReady(true)} margin={20} />
                    <PlayButton isPlaying={isPlaying} onClick={() => setIsPlaying(!isPlaying)} disabled={uploadDisabled} />
                    <button class="btn btn-outline-success" style="margin-right: 6px;" disabled={uploadDisabled} onclick={onUploadClick}>{t`upload`}</button>
                    <button class="btn btn-outline-danger" onclick={onDiscardClick}>{t`discard`}</button>
                </>
            )}
        </>
    );
};