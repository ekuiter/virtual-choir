import {h, Fragment} from "preact";
import {useState} from "preact/hooks";
import {t, formatDate} from "../i18n";
import {post} from "../api";

export default () => {
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
            post({reset: true}).then(() => location.href = "admin.html");
    };

    return (
        <>
            <h4 style="margin-bottom: 15px;">
                {t`admin`}
                <span style="font-size: 1rem; padding-left: 10px;"><a href="https://www.youtube.com/watch?v=pXPXMxsXT28">π</a></span>
            </h4>
            <p>
                <strong>Version</strong><br />
                <a href="https://github.com/ekuiter/virtual-choir">ekuiter/virtual-choir</a> {formatDate(version)}
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
            <strong>{t`backupSection`}</strong>
            <form enctype="multipart/form-data" action="php/app.php" method="post" class="form-inline">
                <input type="hidden" name="backup" />
                <input type="file" name="restore" accept=".zip" style="margin: 0 12px 0 0;" onChange={e => setHasFile(e.target.files.length > 0)} />
                <input type="submit" class="btn btn-outline-danger" style="margin-right: 6px;" onclick={onRestoreClick} value={hasFile ? t`restore` : t`backup`} />
                <button class="btn btn-outline-danger" onclick={onResetClick}>{t`reset`}</button>
            </form>
        </>
    );
};