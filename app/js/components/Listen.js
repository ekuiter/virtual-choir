import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import {t} from "../i18n";
import {post, fetchJson} from "../api";
import {route, decode} from "../helpers";
import Loading from "./Loading";

export default ({encodedMix}) => {
    const [loading, setLoading] = useState(true);
    const [mixes, setMixes] = useState([]);

    useEffect(() => {
        fetchJson({mixes: true})
            .then(setMixes)
            .then(() => setLoading(false));
    }, []);

    const mix = decode(encodedMix);

    const onDeleteClick = e => {
        e.preventDefault();
        if (confirm(t`confirmDelete`))
            post({deleteMix: mix}).then(() => location.href = "/listen");
    };

    return (
        <>
            <h4 style="margin-bottom: 15px;">{t`listen`}</h4>
            {loading
            ? <Loading />
            : (
                <>
                    <select style="margin-bottom: 15px;" class="custom-select" size="20"
                        onchange={e => route("/listen", e.target.value)}>
                        {mixes.map(_mix => <option value={_mix} selected={mix === _mix}>{_mix}</option>)}
                    </select>
                    {encodedMix && mixes.indexOf(mix) !== -1 && (
                        <div style="display: flex; align-items: center;">
                            <audio src={`/mixes/${mix}.mp3`} controls style="margin-right: 6px;" />
                            <button class="btn btn-outline-success" style="height: 40px; margin-right: 6px;" onclick={() => location.href = `/mixes/${mix}.mp3`}>
                                {t`download`}
                            </button>
                            <button class="btn btn-outline-danger" style="height: 40px;" onclick={onDeleteClick}>
                                {t`delete`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </>
    );
};