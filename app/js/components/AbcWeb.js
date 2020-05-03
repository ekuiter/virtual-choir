import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import Loading from "./Loading";
import $ from "jquery";

export default ({score, playback, offset, timing, isPlaying = false, onReady, cursor = "normal"}) => {
    const [abcWeb, setAbcWeb] = useState();

    useEffect(() => {
        setAbcWeb();
        if (score)
            Promise.all([import("../abcweb/abcweb"), fetch(score)])
                .then(([module, res]) => Promise.all([Promise.resolve(module.default), res.text()]))
                .then(([abcWebInit, abcOrXml]) => abcWebInit(abcOrXml, playback, offset, timing, cursor))
                .then(abcWeb => {
                    setAbcWeb(abcWeb);
                    if (onReady)
                        onReady();
                });
    }, [score, playback, offset, timing]);

    useEffect(() => (() => $(window).unbind("resize")), []);
    useEffect(() => abcWeb && abcWeb.setCursor(cursor), [cursor]);

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
