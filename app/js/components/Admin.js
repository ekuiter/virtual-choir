import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import {t, formatDate} from "../i18n";
import {post, fetchJson} from "../api";
import {route, deleteRecordingArrayBuffer, getName} from "../helpers";
import Loading from "./Loading";

export default ({config: {version}}) => {
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [hasFile, setHasFile] = useState();
    const [selectedTrackId, setSelectedTrackId] = useState();

    useEffect(() => {
        fetchJson({tracks: true})
            .then(tracks => tracks.map(({date, ...track}) => ({date: new Date(date), ...track})))
            .then(setTracks)
            .then(() => setLoading(false));
    }, []);

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

    const onResetClick = e => {
        e.preventDefault();
        if (confirm(t`confirmReset`))
            post({reset: true}).then(() => location.reload());
    };

    const onClearLocalStorageClick = () => {
        localStorage.clear();
        location.reload();
    };

    const track = tracks.find(({id}) => selectedTrackId === id);

    return (
        loading
        ? <Loading />
        : (
            <>
                <h4 style="margin-bottom: 15px;">
                    {t`admin`}
                    <span style="font-size: 1rem; padding-left: 10px;"><a href="https://www.youtube.com/watch?v=pXPXMxsXT28" target="_blank">π</a></span>
                </h4>

                <p>
                    <strong>Version</strong><br />
                    <a href="https://github.com/ekuiter/virtual-choir" target="_blank">ekuiter/virtual-choir</a> {formatDate(new Date(version))}
                </p>

                <p>
                    <strong>{t`browserSupport`}</strong><br />
                    ✔ Firefox 65-75, Chrome 79-81 (Windows 10, Ubuntu 18, macOS 14)<br />
                    ✔ Chrome 81 (Android 7)<br />
                    ✖ Internet Explorer, Edge 44 (Windows 10)<br />
                    ✖ Safari (macOS 14)
                </p>

                <p>
                    <strong>{t`microphoneSettings`}</strong> <button class="btn btn-outline-primary btn-sm" onclick={onTestClick} style="padding: 0.15rem 0.4rem; margin: -0.3rem 0 0 0.6rem;">{t`testPermission`}</button><br />
                    Chrome: <span style="font-family: monospace; font-size: 0.8rem; user-select: text;">chrome://settings/content/microphone</span><br />
                    Firefox: <span style="font-family: monospace; font-size: 0.8rem; user-select: text;">about:preferences#privacy</span>
                </p>
                <p></p>

                <strong>{t`localStorage`}</strong>
                <pre style="margin: 5px 0; font-size: 0.8rem;">
                    {Array.from({length: localStorage.length}, (_, i) => i)
                        .map(i => localStorage.key(i))
                        .map(key => `${key}=${localStorage.getItem(key)}\n`)}
                </pre>
                <p>
                    <button class="btn btn-outline-danger btn-sm" style="padding: 0.15rem 0.4rem; margin: 0;" onclick={onClearLocalStorageClick}>{t`clearLocalStorage`}</button>
                </p>

                <strong>{t`recordingStorage`}</strong>
                <form class="form form-inline my-2 my-lg-0" style="padding-top: 5px;">
                <button class="btn btn-sm btn-outline-success my-2 my-sm-0" style="padding: 0.15rem 0.4rem; margin: 0;" onClick={() => route("/last")}>
                        {t`loadLastRecording`}
                    </button>
                    <button class="btn btn-sm btn-outline-danger my-2 my-sm-0" style="padding: 0.15rem 0.4rem; margin: 0 0 0 0.3rem;" onClick={deleteRecordingArrayBuffer}>
                        {t`deleteLastRecording`}
                    </button>
                </form>
                <p></p>

                <strong>{t`setData`}</strong>
                <form action="/php/app.php" method="post" style="margin-top: 5px;">
                    <select class="custom-select-sm" name="setFor" style="margin-bottom: 5px;"
                        onchange={e => setSelectedTrackId([...e.target.options].filter(o => o.selected).map(o => o.value)[0])}>
                        <option></option>
                        {tracks
                            .map(({id, name, register, date, song}) => (
                                <option key={id} value={id} selected={selectedTrackId === id}>
                                    {formatDate(date)} | {song} | {getName(name, register)}
                                </option>
                            ))}
                    </select>
                    <div class="form-inline" style="margin-bottom: 5px;">
                        <input type="text" class="form-control mr-sm-2 form-control-sm" placeholder="song" name="song" value={track ? track.song : null} />
                        <input type="text" class="form-control mr-sm-2 form-control-sm" placeholder="name" name="name" value={track ? track.name : null} />
                        <input type="text" class="form-control mr-sm-2 form-control-sm" placeholder="register" name="register" value={track ? track.register : null} />
                    </div>
                    <div class="form-inline" style="margin-bottom: 5px;">
                        <input type="text" class="form-control mr-sm-2 form-control-sm" placeholder="songOffset" name="songOffset" value={track ? track.songOffset : null} />
                        <input type="text" class="form-control mr-sm-2 form-control-sm" placeholder="recordingOffset" name="recordingOffset" value={track ? track.recordingOffset : null} />
                        <input type="text" class="form-control mr-sm-2 form-control-sm" placeholder="gain" name="gain" value={track ? track.gain : null} />
                    </div>
                    <input type="submit" class="btn btn-outline-danger btn-sm" style="padding: 0.15rem 0.4rem; margin: 0;" value={t`save`} />
                </form>
                <p></p>

                <strong>{t`backupSection`}</strong>
                <form enctype="multipart/form-data" action="/php/app.php" method="post" class="form-inline" style="margin-top: 5px;">
                    <input type="hidden" name="backup" />
                    <input type="file" name="restore" accept=".zip" style="margin: 0 12px 0 0;" onChange={e => setHasFile(e.target.files.length > 0)} />
                    <input type="submit" class="btn btn-outline-danger btn-sm"  style="padding: 0.15rem 0.4rem; margin: 0 0 0 0.3rem;" onclick={onRestoreClick} value={hasFile ? t`restore` : t`backup`} />
                    <button class="btn btn-outline-danger btn-sm" style="padding: 0.15rem 0.4rem; margin: 0 0 0 0.3rem;" onclick={onResetClick}>{t`reset`}</button>
                </form>
            </>
        )
    );
};