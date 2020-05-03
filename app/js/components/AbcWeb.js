import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import {loadScript} from "../helpers";
import Loading from "./Loading";

export default ({score, playback, offset, timing, isPlaying = false, onReady, cursor = "normal"}) => {
    const [abcWeb, setAbcWeb] = useState();

    useEffect(() => {
        setAbcWeb();
        if (score)
            Promise.all([loadScript("/abcweb.js"), fetch(score)])
                .then(([_, res]) => res.text())
                .then(abcOrXml => abcWebInit(abcOrXml, playback, offset, timing, cursor))
                .then(abcWeb => {
                    setAbcWeb(abcWeb);
                    if (onReady)
                        onReady();
                });
    }, [score, playback, offset, timing]);

    useEffect(() => {
        return () => abcWeb && abcWeb.destroy();
    });

    useEffect(() => {
        if (abcWeb)
            abcWeb.setCursor(cursor);
    }, [cursor]);

    useEffect(() => {
        if (abcWeb) {
            if (isPlaying)
                abcWeb.play();
            else
                abcWeb.stop();
        }
    }, [isPlaying]);

    return (
        <>
            {!abcWeb && <Loading />}
            <audio id="aud" muted />
            <div id="notation" style={!abcWeb ? "visibility: hidden;" : ""} />
        </>
    );
};
