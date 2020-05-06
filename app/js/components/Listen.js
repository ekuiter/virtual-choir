import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import {t} from "../i18n";
import {post, fetchJson} from "../api";
import {route, decode, useRepeat} from "../helpers";
import Loading from "./Loading";

export default ({encodedMix, config: {renameMixTitle}}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [mixes, setMixes] = useState([]);
    const [pendingMixName, setPendingMixName] = useState();

    useEffect(() => {
        setPendingMixName();
    }, [encodedMix]);

    const updateMixes = () =>
        fetchJson({mixes: true})
            .then(setMixes)
            .then(() => setIsLoading(false));

    useRepeat(() => {
        if (!isEditing)
            updateMixes();
    }, [isEditing]);

    const mix = decode(encodedMix);

    const onRenameSubmit = e => {
        e.preventDefault();
        const to = pendingMixName || mix;
        post({renameMix: mix, to}).then(updateMixes).then(() => route("/listen", to));
    }

    const onDeleteClick = e => {
        e.preventDefault();
        if (confirm(t`confirmDelete`))
            post({deleteMix: mix}).then(updateMixes).then(() => route("/listen"));
    };

    return (
        <>
            <h4 style="margin-bottom: 15px;">{t`listen`}</h4>
            {isLoading
            ? <Loading />
            : (
                <>
                    <select style="margin-bottom: 15px;" class="custom-select" size="20"
                        onchange={e => route("/listen", e.target.value)}>
                        {mixes.map(_mix => <option key={_mix} value={_mix} selected={mix === _mix}>{_mix}</option>)}
                    </select>
                    {encodedMix && mixes.indexOf(mix) !== -1 && (
                        <>
                            {renameMixTitle && (
                                <form class="form form-inline my-2 my-lg-0" style="padding-bottom: 10px;" onsubmit={onRenameSubmit}>
                                    <input type="text" class="form-control mr-sm-2" value={pendingMixName || mix} style="width: 50%;"
                                        onfocus={() => setIsEditing(true)}
                                        onblur={() => setIsEditing(false)}
                                        onchange={e => setPendingMixName(e.target.value)} />
                                    <input type="submit" class="btn btn-outline-primary my-2 my-sm-0" value={t`rename`} />
                                </form>
                            )}
                            <div style="display: flex; align-items: center;">
                                <audio src={`/mixes/${mix}.mp3`} controls style="width: 50%; margin-right: 6px;" autoplay />
                                <button class="btn btn-outline-success" style="height: 40px; margin-right: 6px;" onclick={() => location.href = `/mixes/${mix}.mp3`}>
                                    {t`download`}
                                </button>
                                <button class="btn btn-outline-danger" style="height: 40px;" onclick={onDeleteClick}>
                                    {t`delete`}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </>
    );
};