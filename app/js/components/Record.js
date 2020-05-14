import {h, Fragment} from "preact";
import {useState, useRef, useEffect} from "preact/hooks";
import RecordRTC, {invokeSaveAsDialog} from "recordrtc";
import {t} from "../i18n";
import {uploadTrack} from "../api";
import PlayButton, {IconButton} from "./PlayButton";
import Track from "./Track";
import {useLocalStorage, getRecordingArrayBuffer, setRecordingArrayBuffer, makeToast} from "../helpers";
import AbcWeb from "./AbcWeb";

export default ({config: {songs, registers, useAudiowaveform, useXml2Abc}, song, setSong, recordingTimeout = 1500, loadLastRecording = false}) => {
    const [name, setName] = useLocalStorage("name");
    const [register, setRegister] = useLocalStorage("register");
    const [score, setScore] = useState("abcWeb");
    const [playback, setPlayback] = useLocalStorage("playback", val => val === "true", true);
    const [abcWebCursor, setAbcWebCursor] = useLocalStorage("abcWebCursor", val => val, "normal");
    const [busy, setBusy] = useState();
    const [recorder, setRecorder] = useState();
    const [recordingUri, setRecordingUri] = useState();
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSongTrackReady, setIsSongTrackReady] = useState(false);
    const [isRecordingTrackReady, setIsRecordingTrackReady] = useState(false);
    const [isAbcWebReady, setIsAbcWebReady] = useState(false);
    const [songTrackOffset, setSongTrackOffset] = useState();
    const [recordingTrackOffset, setRecordingTrackOffset] = useState();
    const [songTrackGain, setSongTrackGain] = useState(1);
    const [recordingTrackGain, setRecordingTrackGain] = useState(1);
    const [showOptions, setShowOptions] = useState(false);
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
                makeToast(t`nameMissing`, "Error");
            else if (!register)
                makeToast(t`registerMissing`, "Error");
            else if (!song)
                makeToast(t`songMissing`, "Error");
            else {
                setBusy(true);
                navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(stream => {
                    const recorder = RecordRTC(stream, {type: "audio"});
                    recorder.startRecording();
                    if (playback && playbackRef.current) {
                        playbackRef.current.currentTime = 0;
                        playbackRef.current.play();
                    }
                    setIsRecording(true);
                    window.setTimeout(() => {
                        setBusy(false);
                        setRecorder(recorder);
                    }, recordingTimeout);
                    makeToast(t`recordingStarted`);
            }, () => {
                    setBusy(false);
                    makeToast(t`permissionMissing`, "Error");
                });
            }
        } else {
            setBusy(true);
            if (playback && playbackRef.current)
                playbackRef.current.pause();
            setIsRecording(false);
            recorder.stopRecording(() => {
                const internalRecorder = recorder.getInternalRecorder().getInternalRecorder();
                internalRecorder._stream.getTracks().forEach(track => track.stop());
                setBusy(false);
                setRecorder();
                setRecordingUri(recorder.toURL());
                recorder.getBlob().arrayBuffer().then(setRecordingArrayBuffer);
                makeToast(t`recordingDone`);
            });
        }
    };

    const onUploadClick = () => {
        setBusy(true);
        setIsPlaying(false);
        const gain = !isNaN(recordingTrackGain / songTrackGain) ? recordingTrackGain / songTrackGain : 1;
        makeToast(t`uploadStarted`);
        uploadTrack(recordingUri, name, register, song, getSongTrackOffset(), getRecordingTrackOffset(), gain)
            .then(onDiscardClick)
            .then(() => setBusy(false))
            .then(() => makeToast(t`uploadDone`));
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
        makeToast(t`recordingDiscarded`);
    };

    const onDownloadRecordingClick = () =>
        recordingUri &&
            fetch(recordingUri)
                .then(res => res.blob())
                .then(blob => invokeSaveAsDialog(blob, song));

    const onOptionsClicked = e => {
        e.preventDefault();
        setShowOptions(showOptions => !showOptions);
    };

    const recordDisabled = busy || recorder || recordingUri || (score === "abcWeb" && isAbcWebReady !== song);
    const recordButtonDisabled = busy || recordingUri || (score === "abcWeb" && isAbcWebReady !== song);
    const uploadDisabled = busy || !isSongTrackReady || !isRecordingTrackReady;
    const hasScore = song && !!songs[song].score;
    const hasMuseScore = song && !!songs[song].museScore;
    const hasAbcWeb = song && !!songs[song].abcWeb;
    const _score = hasScore && (typeof songs[song].score === "string" ? (songs[song].score === "*.txt" ? `/songs/${song}.txt` : songs[song].score) : `/songs/${song}.pdf`);
    const museScore = hasMuseScore && (typeof songs[song].museScore === "string" ? songs[song].museScore : `/songs/${song}.mscz`);
    const abcWeb = hasAbcWeb && (typeof songs[song].abcWeb === "string" ? songs[song].abcWeb : `/songs/${song}.${useXml2Abc ? "abc" : "musicxml"}`);

    useEffect(() => {
        if (song && hasAbcWeb)
            setScore("abcWeb");
        else if (song && hasScore)
            setScore("score");
        else
            setScore("none");
    }, [song]);

    return (
        <>
            <h4 style="margin-bottom: 15px;">{t`record`}</h4>
            <form class="form form-inline my-2 my-lg-0" onsubmit={onRecordSubmit}>
                <input type="text" class="form-control mr-sm-2" placeholder={t`name`} value={name} disabled={recordDisabled} onchange={e => setName(e.target.value)} title={t`nameHelp`} />
                <select class="custom-select" class="form-control mr-sm-2" disabled={recordDisabled} onchange={e => setRegister(e.target.value)} title={t`registerHelp`}>
                    <option>{t`register`}</option>
                    {Object.keys(registers).map(_register => (
                        <option key={_register} value={typeof registers[_register].value !== "undefined" ? "" + registers[_register].value : _register}
                            selected={register === (typeof registers[_register].value !== "undefined" ? "" + registers[_register].value : _register)}>
                            {_register}
                        </option>
                    ))}
                </select>
                {name && register && (
                    <>
                        <select class="custom-select" class="form-control mr-sm-2" disabled={recordDisabled} onchange={e => setSong(e.target.value)} title={t`songHelp`}>
                            <option>{t`song`}</option>
                            {Object.keys(songs).map((_song) => <option key={_song} value={_song} selected={song === _song}>{_song}</option>)}
                        </select>
                        {song && (
                            <>
                                <input type="submit" class={`btn ${busy || recordingUri ? "btn-outline-secondary" : recorder ? "btn-outline-danger" : "btn-outline-success"} my-2 my-sm-0`} 
                                    value={recorder ? t`stopRecording` : t`startRecording`}
                                    disabled={recordButtonDisabled}
                                    style="margin-right: 12px;" />
                                <IconButton icon={showOptions ? "/img/gear-fill.svg" : "/img/gear.svg"} onClick={onOptionsClicked} className="">&nbsp;{t`options`}</IconButton>
                            </>
                        )}
                    </>
                )}
            </form>
            {name && register &&
                <>
                    {song && showOptions && (
                        <>
                            <p></p>
                            <form class="form form-inline my-2 my-lg-0" onsubmit={onRecordSubmit}>
                                <div class="form-check" style="margin-left: 0.5rem;">
                                    <input class="form-check-input" type="checkbox" id="playback"
                                        checked={playback} disabled={recordDisabled} onchange={e => setPlayback(e.target.checked)} title={t`playbackHelp`} />
                                    <label class="form-check-label" for="playback" style="margin-right: 1rem; user-select: none;" title={t`playbackHelp`}>{t`playback`}</label>
                                </div>
                                <select class="custom-select" class="form-control mr-sm-2" disabled={recordDisabled}
                                    onchange={e => setScore(e.target.value)} title={t`scoreHelp`}>
                                    <option value="none" selected={score === "none"}>{t`scoreNone`}</option>
                                    <option value="score" selected={score === "score"} disabled={!hasScore}>{t`scoreScore`}</option>
                                    <option value="abcWeb" selected={score === "abcWeb"} disabled={!hasAbcWeb}>{t`scoreAbcWeb`}</option>
                                </select>
                                {score === "abcWeb" && (
                                    <select class="custom-select" class="form-control mr-sm-2" disabled={recordButtonDisabled}
                                        onchange={e => setAbcWebCursor(e.target.value)} title={t`cursorHelp`}>
                                        <option value="none" selected={abcWebCursor === "none"}>{t`cursorNone`}</option>
                                        <option value="normal" selected={abcWebCursor === "normal"}>{t`cursorNormal`}</option>
                                        <option value="note" selected={abcWebCursor === "note"}>{t`cursorNote`}</option>
                                    </select>
                                )}
                                <a native download={`${song}.mp3`} class="btn btn-outline-primary" style="margin-right: 6px;" href={`/songs/${song}.mp3`}>
                                    {t`playback`}
                                </a>
                                {hasScore && (
                                    <a native download={`${song}.${_score ? _score.split(".").pop() : ""}`} class="btn btn-outline-primary" style="margin-right: 6px;" href={_score}>
                                        {t`score`}
                                    </a>
                                )}
                                {hasMuseScore && (
                                    <a native download={`${song}.mscz`} class="btn btn-outline-primary" style="margin-right: 6px;" href={museScore}>
                                        {t`museScore`}
                                    </a>
                                )}
                                {recordingUri &&
                                    <button class="btn btn-outline-primary" onclick={onDownloadRecordingClick}>{t`recording`}</button>}
                            </form>
                        </>
                    )}
                    {song && !recordingUri && (
                        <>
                            <br />
                            {score === "score" && hasScore && (
                                <iframe src={_score}
                                    style="width: 100%; height: 95vh;" frameborder="0">
                                </iframe>
                            )}
                            {score === "abcWeb" && hasAbcWeb && !loadLastRecording && (
                                <AbcWeb key={abcWeb} score={abcWeb} playback={`/songs/${song}.mp3`}
                                    offset={songs[song].abcWebOffset || 0} timing={songs[song].abcWebTiming}
                                    isPlaying={isAbcWebReady === song && isRecording} onReady={setIsAbcWebReady(song)} cursor={abcWebCursor} />
                            )}
                            <audio src={`/songs/${song}.mp3`} ref={playbackRef} />
                        </>
                    )}
                    {recordingUri && (
                        <>
                            <p style="margin: 1rem 0 0.5rem 0;">
                                {t`syncHelp`}
                            </p>
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