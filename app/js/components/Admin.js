import {h, Fragment} from "preact";
import {useState} from "preact/hooks";
import {t, formatDate} from "../i18n";
import {post} from "../api";
import {route, deleteRecordingArrayBuffer} from "../helpers";

export default ({config: {version}}) => {
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

    const onResetClick = e => {
        e.preventDefault();
        if (confirm(t`confirmReset`))
            post({reset: true}).then(() => location.reload());
    };

    const onClearLocalStorageClick = () => {
        localStorage.clear();
        location.reload();
    };

    return (
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
            <strong>{t`backupSection`}</strong>
            <form enctype="multipart/form-data" action="/php/app.php" method="post" class="form-inline" style="margin-top: 5px;">
                <input type="hidden" name="backup" />
                <input type="file" name="restore" accept=".zip" style="margin: 0 12px 0 0;" onChange={e => setHasFile(e.target.files.length > 0)} />
                <input type="submit" class="btn btn-outline-danger btn-sm"  style="padding: 0.15rem 0.4rem; margin: 0 0 0 0.3rem;" onclick={onRestoreClick} value={hasFile ? t`restore` : t`backup`} />
                <button class="btn btn-outline-danger btn-sm" style="padding: 0.15rem 0.4rem; margin: 0 0 0 0.3rem;" onclick={onResetClick}>{t`reset`}</button>
            </form>
            <p></p>
            <strong>{t`setRecordingOffset`}</strong>
            <form action="/php/app.php" method="post" target="_blank" class="form-inline" style="margin-top: 5px;">
                <input type="text" class="form-control mr-sm-2 form-control-sm" placeholder="setFor" name="setFor" />
                <input type="text" class="form-control mr-sm-2 form-control-sm" placeholder="recordingOffset" name="recordingOffset" />
                <input type="submit" class="btn btn-outline-danger btn-sm" style="padding: 0.15rem 0.4rem; margin: 0;" value={t`save`} />
            </form>
            <p></p>
            <strong>{t`recordingStorage`}</strong>
            <form class="form form-inline my-2 my-lg-0" style="padding-top: 5px;">
            <button class="btn btn-sm btn-outline-success my-2 my-sm-0" style="padding: 0.15rem 0.4rem; margin: 0;" onClick={() => route("/last")}>
                    {t`loadLastRecording`}
                </button>
                <button class="btn btn-sm btn-outline-danger my-2 my-sm-0" style="padding: 0.15rem 0.4rem; margin: 0 0 0 0.3rem;" onClick={deleteRecordingArrayBuffer}>
                    {t`deleteLastRecording`}
                </button>
            </form>
        </>
    );
};