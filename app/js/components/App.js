import {h, Fragment} from "preact";
import Router from "preact-router";
import Match from "preact-router/match";
import Navigation from "./Navigation";
import Mix from "./Mix";
import Listen from "./Listen";
import Admin from "./Admin";
import Record from "./Record";
import Loading from "./Loading";
import NotFound from "./NotFound";
import {useLocalStorage} from "../helpers";

export default ({config}) => {
    const [song, setSong] = useLocalStorage("song");

    return (
        !config
            ? (
                <>
                    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
                        <a class="navbar-brand" href="/">&nbsp;</a>
                        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent"
                            aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                            <span class="navbar-toggler-icon" />
                        </button>
                        <div class="collapse navbar-collapse" id="navbarSupportedContent">
                        </div>
                    </nav>
                    <Loading margin={40} />
                </>
            )
            : (
                <>
                    <Match>
                        {({path}) => <Navigation path={path} config={config} />}
                    </Match>
                    <div class="container" style="padding-top: 25px; margin-bottom: 20px;">
                        <Router>
                            <Mix path="/mix/:encodedSong?/:encodedTrackIds?" config={config} defaultSong={song} />
                            <Listen path="/listen/:encodedMix?" />
                            <Admin path="/admin" config={config} />
                            <Record path="/" config={config} song={song} setSong={setSong} />
                            <NotFound default />
                        </Router>
                    </div>
                </>
            )
    );
};