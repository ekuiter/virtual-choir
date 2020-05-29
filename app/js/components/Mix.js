import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import {t, formatDate} from "../i18n";
import {post, fetchJson} from "../api";
import PlayButton from "./PlayButton";
import Track from "./Track";
import Loading from "./Loading";
import {decode, route, useDebounce, useRepeat, getName, getPlainName} from "../helpers";

export default ({config: {songs, useAudiowaveform, defaultMixGain}, encodedSong, encodedTrackIds, defaultSong, debounceApiCalls = 500}) => {
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [busy, setBusy] = useState(false);
    const [readyTrackIds, setReadyTrackIds] = useState([]);
    const [playingTrackIds, setPlayingTrackIds] = useState([]);
    const [songTrackPlaying, setSongTrackPlaying] = useState();
    const [songTrackReady, setSongTrackReady] = useState();
    const [songTrackGain, setSongTrackGain] = useState(1);
    const [pendingApiCalls, setPendingApiCalls] = useState([]);
    const [pendingApiCall, setPendingApiCall] = useState();
    const [virtualSongTrackOffset, setVirtualSongTrackOffset] = useState(0);
    const [mixPlayback, setMixPlayback] = useState(false);
    const [mixGain, setMixGain] = useState(defaultMixGain || 3);
    const debouncedPendingApiCall = useDebounce(pendingApiCall, debounceApiCalls);
    const song = decode(encodedSong) || defaultSong;
    const selectedTrackIds = decode(encodedTrackIds, true) || [];
    const isReady = songTrackReady === song && selectedTrackIds.length === readyTrackIds.length;
    const isPlaying = songTrackPlaying === song || playingTrackIds.length > 0;
    const getSelectedTracks = selectedTrackIds => selectedTrackIds.map(id => tracks.find(track => track.id === id));
    const addReadyTrack = id => () => setReadyTrackIds(readyTrackIds => [...readyTrackIds, id]);
    const addPendingApiCall = pendingApiCall => setPendingApiCalls(pendingApiCalls => [...pendingApiCalls, pendingApiCall]);

    const updateTracks = initial =>
        selectedTrackIds.length === 0 || initial
            ? fetchJson({tracks: true})
                .then(tracks => tracks.map(({date, ...track}) => ({date: new Date(date), ...track})))
                .then(setTracks)
                .then(() => setLoading(false))
            : null;

    useRepeat(updateTracks, [encodedTrackIds]);

    useEffect(() => {
        if (debouncedPendingApiCall) {
            setBusy(false);
            addPendingApiCall(debouncedPendingApiCall);
        }
    }, [debouncedPendingApiCall]);

    useEffect(() => {
        window.onbeforeunload = pendingApiCalls.length > 0 && (() => t`confirmClose`);
    }, [pendingApiCalls]);

    const setPlayingTrack = id => isPlaying => setPlayingTrackIds(playingTrackIds => {
        if (isPlaying)
            return playingTrackIds.indexOf(id) === -1 ? [...playingTrackIds, id] : playingTrackIds;
        else
            return playingTrackIds.indexOf(id) !== -1 ? playingTrackIds.filter(_id => _id !== id) : playingTrackIds;
    });

    const onSongSelected = e => {
        setReadyTrackIds([]);
        setPlayingTrackIds([]);
        setSongTrackPlaying(null);
        route("/mix", e.target.value);
    };

    const onTracksSelected = e => {
        const newSelectedTrackIds = [...e.target.options].filter(o => o.selected).map(o => o.value);
        setReadyTrackIds(readyTrackIds => readyTrackIds.filter(id => newSelectedTrackIds.indexOf(id) !== -1));
        setPlayingTrackIds([]);
        setSongTrackPlaying(null);
        route("/mix", song, JSON.stringify(newSelectedTrackIds));
    };

    const onDeleteSelectedClick = e => {
        e.preventDefault();
        if (confirm(t`confirmDeleteSelected`))
            post({deleteSelected: JSON.stringify(selectedTrackIds)}).then(() => route("/mix")).then(updateTracks);
    };

    const onPlayClick = e => {
        e.preventDefault();
        if (isPlaying) {
            setPlayingTrackIds([]);
            setSongTrackPlaying(null);
        } else {
            setPlayingTrackIds(selectedTrackIds);
            setSongTrackPlaying(song);
        }
    };

    const onMixSubmit = e => {
        e.preventDefault();
        location.href = `/php/app.php?mix=${JSON.stringify(selectedTrackIds)}${mixPlayback ? "&playback" : ""}&gain=${mixGain}`;
    };

    const onSaveChangesClick = e => {
        e.preventDefault();
        setBusy(true);
        pendingApiCalls
            .reduce((promise, pendingApiCall) => promise.then(() => post(pendingApiCall)), Promise.resolve())
            .then(() => {
                setPendingApiCalls([]);
                setBusy(false);
            });
    };

    const mp3 = song && (typeof songs[song].playback !== "undefined" ? (songs[song].playback === false ? `/songs/none.mp3` : songs[song].playback) : `/songs/${song}.mp3`);
    const json = song && (typeof songs[song].playback !== "undefined" ? (songs[song].playback === false ? `/songs/none.json` : songs[song].playback.replace(".mp3", ".json")) : `/songs/${song}.json`);

    return (
        <>
            <h4 style="margin-bottom: 15px;">{t`mix`}</h4>
            <form class="form-inline">
                <select class="custom-select" class="form-control mr-sm-2" name="song" onchange={onSongSelected}>
                    <option>{t`song`}</option>
                    {Object.keys(songs).map((_song) => <option key={_song} value={_song} selected={song === _song}>{_song}</option>)}
                </select>
                <button class="btn btn-outline-danger" style={selectedTrackIds.length > 0 ? "" : "visibility: hidden;"} onclick={onDeleteSelectedClick}>
                    {t`deleteSelected`}
                </button>
            </form>
            {song && songs.hasOwnProperty(song) && (
                loading
                ? <Loading />
                : (
                    <>
                        <select class="custom-select" multiple size={window.screen.width >= 800 ? 2 : 1} onchange={onTracksSelected}
                            style={window.screen.width >= 800 ? "margin-bottom: 15px; min-height: 200px; height: calc(100vh - 550px);" : ""}
                            style={`clear: both; margin: 15px 0; ${window.screen.width >= 800 ? `min-height: 200px; height: ${selectedTrackIds.length > 0 ? 0 : "calc(100vh - 250px)"};` : ""}`}>
                            {tracks
                                .filter(track => track.song === song)
                                .map(({id, name, register, date}) => (
                                    <option key={id} value={id} selected={selectedTrackIds.indexOf(id) !== -1}>
                                        <strong>{formatDate(date)}</strong> | {getName(name, register)}
                                    </option>
                                ))}
                        </select>
                        {selectedTrackIds.length > 0 && (
                            <>
                                <div style="display: flex; flex-basis: 1;" onSubmit={onMixSubmit}>
                                    <div class="form-group form-inline" style="margin-bottom: 0; flex-grow: 1;">
                                        <form class="form-inline">
                                            <label class="form-check-label" style="margin: 2px 5px 0 0;" title={t`playbackHelp`}>
                                                <input class="form-check-input" type="checkbox" checked={mixPlayback} onchange={e => setMixPlayback(e.target.checked)} />
                                                <span>{t`playback`}</span>
                                            </label>
                                            <label style="margin-top: 6px;">
                                                <span style="margin-top: -5px; padding: 0 20px 0 10px;">{t`volume`}</span>
                                                <input type="range" class="custom-range" min="0" max="10" step="0.01" value={mixGain}
                                                    oninput={e => setMixGain(parseFloat(e.target.value))} style="margin: 0 20px 0 0;" />
                                            </label>
                                            <input type="submit" class="btn btn-outline-success my-2 my-sm-0" value={t`mix`} disabled={busy} />
                                            <button class="btn btn-outline-primary" style={pendingApiCalls.length > 0 ? "margin-left: 6px;" : "display: none;"}
                                                onclick={onSaveChangesClick} disabled={busy}>
                                                {t`saveChanges`}
                                            </button>
                                        </form>
                                    </div>
                                    <div class="form-group form-inline" style="margin-bottom: 0;">
                                        <PlayButton isPlaying={isPlaying} onClick={onPlayClick} disabled={!isReady || busy} />
                                    </div>
                                </div>
                                <Track src={mp3} dataUri={useAudiowaveform && json}
                                    key={song} title={song} offset={songs[song].offset} virtualOffset={virtualSongTrackOffset}
                                    gain={songTrackGain} gainMin={0} gainMax={5} onGainUpdated={setSongTrackGain} isPlaying={songTrackPlaying === song}
                                    onSetIsPlaying={isPlaying => setSongTrackPlaying(isPlaying && song)}
                                    onReady={() => setSongTrackReady(song)}
                                    showOverview={true}
                                    onOffsetUpdated={offset => setVirtualSongTrackOffset(songs[song].virtualOffset = (offset - songs[song].offset))} />
                                {getSelectedTracks(selectedTrackIds).map(track => {
                                    const {id, name, register, song, md5, songOffset, recordingOffset, gain} = track;

                                    const onOffsetUpdated = offset => {
                                        track.recordingOffset = offset - (songs[song].virtualOffset || 0) + (parseFloat(songOffset) - songs[song].offset);
                                        setBusy(true);
                                        setPendingApiCall({"setFor": id, "recordingOffset": track.recordingOffset});
                                    };

                                    const onGainUpdated = gain => {
                                        track.gain = gain;
                                        setBusy(true);
                                        setPendingApiCall({"setFor": id, "gain": track.gain});
                                    };

                                    return (
                                        <Track key={id} title={getName(name, register)}
                                            downloadTitle={getPlainName(name, register)} setForId={id}
                                            src={`/tracks/${md5}.mp3`}
                                            dataUri={useAudiowaveform && `/tracks/${md5}.json`}
                                            offset={parseFloat(recordingOffset) - (parseFloat(songOffset) - (songs[song].offset))}
                                            virtualOffset={virtualSongTrackOffset}
                                            gain={parseFloat(gain)} gainMin="0" gainMax="5"
                                            onOffsetUpdated={onOffsetUpdated} onGainUpdated={onGainUpdated}
                                            isPlaying={playingTrackIds.indexOf(id) !== -1} onSetIsPlaying={setPlayingTrack(id)}
                                            onReady={addReadyTrack(id)}
                                            showOverview={true} />
                                    );
                                })}
                            </>
                        )}
                    </>
                )
            )}
        </>
    );
};