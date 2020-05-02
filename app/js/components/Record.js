import {h, Fragment} from "preact";
import {useState, useRef, useEffect} from "preact/hooks";
import RecordRTC, {invokeSaveAsDialog} from "recordrtc";
import {t} from "../i18n";
import {uploadTrack} from "../api";
import PlayButton from "./PlayButton";
import Track from "./Track";
import {useLocalStorage, getRecordingArrayBuffer, setRecordingArrayBuffer} from "../helpers";

export default ({config: {songs, registers, useAudiowaveform}, song, setSong, recordingTimeout = 500, loadLastRecording = false}) => {
    const [name, setName] = useLocalStorage("name");
    const [register, setRegister] = useLocalStorage("register");
    const [score, setScore] = useLocalStorage("score", val => val === "true", true);
    const [playback, setPlayback] = useLocalStorage("playback", val => val === "true", true);
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

    useEffect(() => {
        if (loadLastRecording)
            getRecordingArrayBuffer().then(arrayBuffer =>
                arrayBuffer && setRecordingUri(URL.createObjectURL(new Blob([arrayBuffer]))));
    }, []);

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
                recorder.getBlob().arrayBuffer().then(setRecordingArrayBuffer);
            });
        }
    };

    const onUploadClick = () => {
        setBusy(true);
        setIsPlaying(false);
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

    const onDownloadRecordingClick = () =>
        recordingUri &&
            fetch(recordingUri)
                .then(res => res.blob())
                .then(blob => invokeSaveAsDialog(blob, song));

    const recordDisabled = busy || recorder || recordingUri;
    const uploadDisabled = busy || !isSongTrackReady || !isRecordingTrackReady;
    const hasScore = song && !!songs[song].score;
    const hasMuseScore = song && !!songs[song].museScore;
    const _score = hasScore && (typeof songs[song].score === "string" ? songs[song].score : `/songs/${song}.pdf`);
    const museScore = hasMuseScore && (typeof songs[song].museScore === "string" ? songs[song].museScore : `/songs/${song}.mscz`);

    return (
        <>
            <h4 style="margin-bottom: 15px;">{t`record`}</h4>
            <form class="form form-inline my-2 my-lg-0" onsubmit={onRecordSubmit}>
                <a class="btn" style="cursor: inherit;">{t`aboutYou`}</a>
                <input type="text" class="form-control mr-sm-2" placeholder={t`name`} value={name} disabled={recordDisabled} onchange={e => setName(e.target.value)} title={t`nameHelp`} />
                <select class="custom-select" class="form-control mr-sm-2" disabled={recordDisabled} onchange={e => setRegister(e.target.value)} title={t`registerHelp`}>
                    <option>{t`register`}</option>
                    {Object.keys(registers).map(_register => (
                        <option key={_register} value={typeof registers[_register].value !== "undefined" ? "" + registers[_register].value : _register} selected={register === _register}>
                            {_register}
                        </option>
                    ))}
                </select>
            </form>
            <p></p>
            {name && register &&
                <>
                <form class="form form-inline my-2 my-lg-0" onsubmit={onRecordSubmit}>
                        <a class="btn" style="cursor: inherit;">{t`record`}</a>
                        <select class="custom-select" class="form-control mr-sm-2" disabled={recordDisabled} onchange={e => setSong(e.target.value)} title={t`songHelp`}>
                            <option>{t`song`}</option>
                            {Object.keys(songs).map((_song) => <option key={_song} value={_song} selected={song === _song}>{_song}</option>)}
                        </select>
                        {song && (
                            <>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="score" checked={score} disabled={recordDisabled || !hasScore}
                                        onchange={e => setScore(e.target.checked)} title={t`scoreHelp`} />
                                    <label class="form-check-label" for="score" style="margin-right: 1rem; user-select: none;" title={t`scoreHelp`}>{t`score`}</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="playback" checked={playback} disabled={recordDisabled} onchange={e => setPlayback(e.target.checked)} title={t`playbackHelp`} />
                                    <label class="form-check-label" for="playback" style="margin-right: 1rem; user-select: none;" title={t`playbackHelp`}>{t`playback`}</label>
                                </div>
                                <input type="submit" class={`btn ${busy || recordingUri ? "btn-outline-secondary" : recorder ? "btn-outline-danger" : "btn-outline-success"} my-2 my-sm-0`} 
                                    value={recorder ? t`stopRecording` : t`startRecording`} disabled={busy || recordingUri} />
                            </>
                        )}
                    </form>
                    {song && (
                        <>
                            <p></p>
                            <form class="form form-inline my-2 my-lg-0" onsubmit={onRecordSubmit}>
                                <a class="btn" style="cursor: inherit;">{t`download`}</a>
                                <a native download={`${song}.${_score ? _score.split(".").pop() : ""}`} class={`btn btn-outline-primary ${!hasScore ? "disabled" : ""}`}
                                    style="margin-right: 6px;" href={_score}>{t`score`}</a>
                                <a native download={`${song}.mp3`} class="btn btn-outline-primary"
                                    style="margin-right: 6px;" href={`/songs/${song}.mp3`}>{t`playback`}</a>
                                {hasMuseScore && (
                                    <a native download={`${song}.mscz`} class={`btn btn-outline-primary`}
                                        style="margin-right: 6px;" href={museScore}>{t`museScore`}</a>
                                )}
                                {recordingUri &&
                                    <button class="btn btn-outline-primary" onclick={onDownloadRecordingClick}>{t`recording`}</button>}
                            </form>
                        </>
                    )}
                    {song && !recordingUri && (
                        <>
                            <br />
                            {score && hasScore && (
                                <iframe src={_score}
                                    style="width: 100%; height: 100vh;" frameborder="0">
                                </iframe>
                            )}
                            <audio src={`/songs/${song}.mp3`} ref={playbackRef} />
                        </>
                    )}
                    {recordingUri && (
                        <>
                            <Track title={song} src={`/songs/${song}.mp3`} dataUri={useAudiowaveform && `/songs/${song}.json`}
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
                </>}
        </>
    );
};