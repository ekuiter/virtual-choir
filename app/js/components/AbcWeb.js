import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import {loadScript} from "../helpers";
import Loading from "./Loading";

export default ({score, playback, offset, isPlaying = false, onReady}) => {
    const [abcWeb, setAbcWeb] = useState();

    useEffect(() => {
        setAbcWeb();
        Promise.all([loadScript("/abcweb.js"), fetch(score)])
            .then(([_, res]) => res.text())
            .then(abcOrXml => abcWebInit(abcOrXml, playback, offset))
            .then(abcWeb => {
                setAbcWeb(abcWeb);
                if (onReady)
                    onReady();
            });
    }, [score, playback, offset]);

    useEffect(() => {
        return () => abcWeb && abcWeb.destroy();
    });

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
