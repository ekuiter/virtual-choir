import {h, Fragment} from "preact";
import {useState, useEffect, useRef} from "preact/hooks";
import {t} from "../i18n";
import {post, fetchJson} from "../api";
import {route, decode, useRepeat, useLocalStorage} from "../helpers";
import Loading from "./Loading";

export default ({encodedMix, config: {renameMixTitle, simplifiedMixTitle}}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [mixes, setMixes] = useState([]);
    const [imageError, setImageError] = useState(false);
    const [pendingMixName, setPendingMixName] = useState();
    const [filter, setFilter] = useLocalStorage("filter");
    const [sortByDate, setSortByDate] = useLocalStorage("sortByDate", val => val === "true", false);
    const [onlyStarred, setOnlyStarred] = useLocalStorage("onlyStarred", val => val === "true", false);
    const [onlyLatest, setOnlyLatest] = useLocalStorage("onlyLatest", val => val === "true", false);

    useEffect(() => {
        setImageError();
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

    const getSong = mix => mix.replace(/\d{4}-\d{2}-\d{2}/, "").replace(/\(!\)/, "").trim();

    const getDate = mix => {
        const match = mix.match(/\d{4}-\d{2}-\d{2}/);
        return match ? +new Date(match[0]) : 0;
    }

    const sortAndFilter = mixes => {
        let _mixes = filter ? mixes.filter(mix => mix.toLowerCase().includes(filter.toLowerCase())) : mixes;
        _mixes = sortByDate ? [..._mixes].sort((a, b) => getDate(b) - getDate(a)) : _mixes;
        _mixes = onlyStarred ? _mixes.filter(mix => mix.includes("!")) : _mixes;
        _mixes = onlyLatest ? _mixes.filter((mix, i, arr) => arr.findIndex(_mix => getSong(_mix) === getSong(mix)) === i) : _mixes;
        return _mixes;
    };

    const onSortAndFilterSubmit = e => {
        e.preventDefault();
        const mix = sortAndFilter(mixes)[0];
        if (mix)
            route("/listen", mix);
    };

    const hasStarred = mixes.find(mix => mix.includes("!"));

    return (
        <>
            <h4 style="margin-bottom: 15px;">{t`listen`}</h4>
            {isLoading
            ? <Loading />
            : (
                <>
                    <form class="form form-inline my-2 my-lg-0" onsubmit={onSortAndFilterSubmit}>
                        <div class="form-check" style=" margin-bottom: 0.8rem; margin-right: 0.5rem;">
                            <input type="text" class="form-control mr-sm-2" placeholder={t`filter`} value={filter}
                                oninput={e => setFilter(e.target.value)} onkeydown={e => e.keyCode === 27 && setFilter("")} />
                        </div>
                        <div class="form-check" style=" margin-bottom: 0.8rem;">
                            {simplifiedMixTitle && (
                                <>
                                    <input class="form-check-input" type="checkbox" id="sortByDate" checked={sortByDate} onchange={e => setSortByDate(e.target.checked)} />
                                    <label class="form-check-label" for="sortByDate" style="margin-right: 1rem;">{t`sortByDate`}</label>
                                </>
                            )}
                            {hasStarred && (
                                <>
                                    <input class="form-check-input" type="checkbox" id="onlyStarred" checked={onlyStarred} onchange={e => setOnlyStarred(e.target.checked)} />
                                    <label class="form-check-label" for="onlyStarred" style="margin-right: 1rem;">{t`onlyStarred`}</label>
                                </>
                            )}
                            <input class="form-check-input" type="checkbox" id="onlyLatest" checked={onlyLatest} onchange={e => setOnlyLatest(e.target.checked)} />
                            <label class="form-check-label" for="onlyLatest">{t`onlyLatest`}</label>
                        </div>
                    </form>
                    <select class="custom-select" size={window.screen.width >= 800 ? 2 : 1}
                        style={window.screen.width >= 800 ? "margin-bottom: 15px; min-height: 200px; height: calc(100vh - 550px);" : ""}
                        onchange={e => route("/listen", e.target.value)}>
                        {sortAndFilter(mixes).map(_mix => <option key={_mix} value={_mix} selected={mix === _mix}>{_mix}</option>)}
                    </select>
                    {encodedMix && mixes.indexOf(mix) !== -1 && (
                        <>
                            {!imageError && (
                                <img src={`/mixes/${mix}.png`} alt={mix}
                                    style="padding-bottom: 10px; width: 100%;" onerror={() => setImageError(true)} />
                            )}
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