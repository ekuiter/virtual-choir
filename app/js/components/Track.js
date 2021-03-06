import {h, Fragment} from "preact";
import {useState, useEffect, useRef} from "preact/hooks";
import Peaks from "../peaks.js/main";
import {t} from "../i18n";
import PlayButton from "./PlayButton";
import {makeToast} from "../helpers";

const fetchAudioBuffer = (() => {
    const cache = {};
    return (ctx, src) => {
        if (cache[src])
            return Promise.resolve(cache[src]);
        return fetch(src)
            .then(res => res.arrayBuffer())
            .then(arrayBuffer => new Promise((resolve, reject) => ctx.resume().then(() => ctx.decodeAudioData(arrayBuffer, resolve, reject))))
            .then(audioBuffer => cache[src] = audioBuffer)
            .catch(e => {
                makeToast(e.message);
            });
    };
})();

export default ({title, downloadTitle, setForId, src, dataUri, offset = 0.5, virtualOffset = 0.0, gain = 1, displaySeconds = 5.0, onReady,
    isPlaying, onSetIsPlaying, onOffsetUpdated, onGainUpdated, showPlayButton = true, showOverview = false,
    gainMin = 0.01, gainMax = 2, zoomHeight = 140, overviewHeight = 50, margin = 8, topDiff = 35}) => {
    const [peaks, setPeaks] = useState();
    const audioRef = useRef();
    const zoomviewRef = useRef();
    const overviewRef = useRef();
    const gainNodeRef = useRef();
    
    useEffect(() => {
        const ctx = new (AudioContext || webkitAudioContext)();
        const source = ctx.createMediaElementSource(audioRef.current);
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.gain.value = gain;
        source.connect(gainNodeRef.current);

        if (offset < 0) {
            offset *= -1;
            const delayNode = ctx.createDelay(offset);
            delayNode.delayTime.value = offset;
            gainNodeRef.current.connect(delayNode);
            delayNode.connect(ctx.destination);
        } else
            gainNodeRef.current.connect(ctx.destination);

        (dataUri ? Promise.resolve() : fetchAudioBuffer(ctx, src)).then(audioBuffer => {
            const options = {
                editable: !!onOffsetUpdated,
                containers: {
                    zoomview: zoomviewRef.current,
                    overview: overviewRef.current
                },
                mediaElement: audioRef.current,
                dataUri,
                zoomLevels: [256],
                points: [{
                    id: "offset",
                    time: offset >= 0 ? offset : 0,
                    editable: false
                }]
            };
            if (!dataUri && audioBuffer)
                options.webAudio = {audioContext: ctx, audioBuffer};
            else if (!dataUri && !audioBuffer) {
                const id = () => {};
                setPeaks({destroy: id, player: {seek: id, play: id, pause: id}, points: {getPoint: () => ({time: 0})}});
                onReady();
                return;
            }
            Peaks.init(options, (err, peaks) => {
                if (!err) {
                    peaks.views.getView("zoomview").setZoom({seconds: displaySeconds});
                    peaks.views.getView("zoomview").setStartTime(offset >= 0 ? offset : 0);
                    peaks.views.getView("zoomview").enableAutoScroll(false);
                    peaks.player.seek(peaks.points.getPoint("offset").time);
                    peaks.on("points.offsetUpdated", offset => {
                        console.log("offset = ", offset);
                        if (onSetIsPlaying)
                            onSetIsPlaying(false);
                        if (onOffsetUpdated)
                            onOffsetUpdated(offset);
                    });
                    setPeaks(peaks);
                    if (onReady)
                        onReady();
                }
            });
        });
        return () => peaks && peaks.destroy();
    }, []);

    useEffect(() => {
        if (peaks) {
            peaks.player.seek(peaks.points.getPoint("offset").time);
            if (isPlaying)
                peaks.player.play();
            else
                peaks.player.pause();
        }
    }, [isPlaying]);

    useEffect(() => {
        if (peaks) {
            const zoomView = peaks.views.getView("zoomview");
            zoomView._updateWaveform(zoomView.timeToPixels(offset + virtualOffset) - zoomView._width / 4, true);
            if (onSetIsPlaying)
                onSetIsPlaying(false);
        }
    }, [virtualOffset]);

    const onGainInput = e => {
        const gain = parseFloat(e.target.value);
        gainNodeRef.current.gain.value = parseFloat(e.target.value);
        if (onGainUpdated) {
            console.log("gain = ", gain);
            onGainUpdated(gain);
        }
    };

    return (
        <div style={`position: relative; border: 1px solid rgba(200, 200, 200, 0.5); border-radius: 6px; margin: ${margin}px 0;`}>
            <div style={peaks ? "display: none;" : "position: absolute; left: calc(50% - 50px);"}>
                <img src="/img/loading.gif" width="100" height="100" style="margin-top: 20px;" />
            </div>
            <audio src={src} ref={audioRef} onended={() => onSetIsPlaying && onSetIsPlaying(false)} />
            <div ref={zoomviewRef} style={`height: ${zoomHeight}px; ${peaks && onOffsetUpdated ? "cursor: move;" : ""}`} />
            {showOverview && <div ref={overviewRef} style={`height: ${overviewHeight}px; ${peaks && onOffsetUpdated ? "cursor: move;" : ""}`} />}
            <div style={peaks ? `${showOverview ? "" : `position: absolute; top: ${zoomHeight - topDiff}px; width: 100%;`} margin: 5px 0; display: flex; flex-basis: 1;`: "display: none;"}>
                <div class="form-group form-inline" style="margin-bottom: 0; flex-grow: 1;">
                    <strong style="padding: 0 20px 0 10px">{title}</strong>
                    {downloadTitle && (
                        <>
                            <a native download={`${downloadTitle}.mp3`} class="btn btn-sm btn-outline-primary my-2 my-sm-0" style="padding: 0.15rem 0.4rem; margin: 0;" href={src}>
                                {t`download`}
                            </a>
                            <form enctype="multipart/form-data" action="/php/app.php" method="post" class="form form-inline my-2 my-lg-0">
                                <input type="hidden" name="setFor" value={setForId} />
                                <input type="file" name="file" style="margin: 0 12px 0 12px; font-size: 12px;" />
                                <input type="submit" class="btn btn-outline-primary btn-sm" style="padding: 0.15rem 0.4rem; margin: 0;" value={t`replace`} />
                            </form>
                        </>
                    )}
                </div>
                <div class="form-group form-inline" style="margin-bottom: 0;">
                    <label>
                        <span style="margin-top: -3px; padding: 0 20px 0 10px;">{t`volume`}</span>
                        <input type="range" class="custom-range" min={gainMin} max={gainMax} step="0.01"
                            style={`margin: 0 ${showPlayButton ? "20px" : "10px"} 0 0;`} value={gain} oninput={onGainInput} />
                    </label>
                </div>
                <PlayButton isPlaying={isPlaying} isVisible={showPlayButton} margin="0 7px 0 0" invisibleMargin="0" className="btn-light btn-sm" style=""
                    onClick={() => onSetIsPlaying && onSetIsPlaying(!isPlaying)} />
            </div>
        </div>
    );
};