import {h, Fragment} from "preact";
import Router from "preact-router";
import Match from "preact-router/match";
import AsyncRoute from "preact-async-route";
import Navigation from "./Navigation";
import Loading from "./Loading";
import NotFound from "./NotFound";
import {useLocalStorage} from "../helpers";
import {t} from "../i18n";
import {useEffect, useRef, useState} from "preact/hooks";
import $ from "jquery";

export default ({config}) => {
    const [song, setSong] = useLocalStorage("song");
    const [toastTitle, setToastTitle] = useState();
    const [toastMessage, setToastMessage] = useState();
    const toastRef = useRef();

    const showToast = className => {
        $(toastRef.current).toast("show");
        $(toastRef.current).find(".toast-body, .toast-header").addClass(className);
        window.setTimeout(() => $(toastRef.current).find(".toast-body, .toast-header").removeClass(className), 300);
    };

    useEffect(() => {
        if (toastRef.current) {
            $(toastRef.current).toast({delay: 4000});
            window.onerror = (_1, _2, _3, _4, e) => {
                setToastTitle(e.name === "Notice" ? t`notice` : t`error`);
                setToastMessage(e.message);
                showToast(e.name === "Notice" ? "flash-notice" : "flash-warning");
            };
            window.onunhandledrejection = e => {
                setToastTitle("Unhandled Rejection");
                setToastMessage(e.reason);
                showToast("flash-warning");
            };
        }

        if ((window.navigator.userAgent.indexOf("MSIE ") > -1 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) ||
        navigator.userAgent.indexOf("Edge/") > -1 ||
        (window.navigator.userAgent.indexOf("Safari") > -1 && window.navigator.userAgent.indexOf("Chrome") === -1)) {
            setToastTitle(t`warning`);
            setToastMessage(t`browserWarning`);
            showToast("flash-warning");
        }
    }, [config]);

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
                <div>
                    <div class="toast" ref={toastRef} style="position: absolute; top: 76px; right: 20px; z-index: 99;">
                        <div class="toast-header">
                        <strong class="mr-auto">{toastTitle}</strong>
                        <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                        </div>
                        <div class="toast-body">{toastMessage}</div>
                    </div>
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
                                getComponent={() => import("./Listen").then(module => module.default)}
                                config={config} />
                            <AsyncRoute path="/admin"
                                getComponent={() => import("./Admin").then(module => module.default)}
                                config={config} />
                            <NotFound default />
                        </Router>
                    </div>
                </div>
            )
    );
};