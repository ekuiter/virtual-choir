import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import {loadScript} from "../helpers";
import Loading from "./Loading";

export default ({musicXml, playback, offset, isPlaying = false, onReady}) => {
    const [abcweb, setAbcweb] = useState();

    useEffect(() => {
        setAbcweb();
        Promise.all([loadScript("/abcweb.js"), fetch(musicXml)])
            .then(([_, xml]) => xml.text())
            .then(xmlText => abcwebInit(xmlText, playback, offset))
            .then(abcweb => {
                setAbcweb(abcweb);
                if (onReady)
                    onReady();
            });
    }, [musicXml, playback, offset]);

    useEffect(() => {
        if (abcweb) {
            if (isPlaying)
                abcweb.play();
            else
                abcweb.stop();
        }
    }, [isPlaying]);

    return (
        <>
            {!abcweb && <Loading />}
            <audio id="aud" muted />
            <div id="notation" style={!abcweb ? "visibility: hidden;" : ""} />
        </>
    );
};
