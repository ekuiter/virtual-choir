import {h, Fragment} from "preact";
import Router from "preact-router";
import Match from "preact-router/match";
import AsyncRoute from "preact-async-route";
import Navigation from "./Navigation";
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
                            <AsyncRoute path="/"
                                getComponent={() => import("./Record").then(module => module.default)}
                                config={config} song={song} setSong={setSong} />
                            <AsyncRoute path="/last"
                                getComponent={() => import("./Record").then(module => module.default)}
                                config={config} song={song} setSong={setSong} loadLastRecording={true} />
                            <AsyncRoute path="/mix/:encodedSong?/:encodedTrackIds?"
                                getComponent={() => import("./Mix").then(module => module.default)}
                                config={config} defaultSong={song} />
                            <AsyncRoute path="/listen/:encodedMix?"
                                getComponent={() => import("./Listen").then(module => module.default)} />
                            <AsyncRoute path="/admin"
                                getComponent={() => import("./Admin").then(module => module.default)}
                                config={config} />
                            <NotFound default />
                        </Router>
                    </div>
                </>
            )
    );
};