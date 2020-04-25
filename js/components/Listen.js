import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import {t} from "../i18n";
import {post} from "../api";

export default () => {
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

    return (
        <>
            <h4 style="margin-bottom: 15px;">{t`listen`}</h4>
            <select style="margin-bottom: 15px;" class="custom-select" size="20" onchange={onMixChanged}>
                {mixes.map(_mix => <option value={_mix} selected={mix === _mix}>{_mix}</option>)}
            </select>
            {mix && (
                <div style="display: flex; align-items: center;">
                    <audio src={`mixes/${mix}.mp3`} controls style="margin-right: 6px;" />
                    <button class="btn btn-outline-success" style="height: 40px; margin-right: 6px;" onclick={() => location.href = `mixes/${mix}.mp3`}>
                        {t`download`}
                    </button>
                    <button class="btn btn-outline-danger" style="height: 40px;" onclick={onDeleteClick}>
                        {t`delete`}
                    </button>
                </div>
            )}
        </>
    );
};