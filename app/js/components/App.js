import {h, Fragment} from "preact";
import Navigation from "./Navigation";
import Mix from "./Mix";
import Listen from "./Listen";
import Admin from "./Admin";
import Record from "./Record";

export default () => (
    <>
        <Navigation activeHref={location.pathname.indexOf(".") !== -1 ? location.pathname : "index.html"} />
        <div class="container" style="margin-bottom: 20px;">
            <br />
            {location.pathname.indexOf("mix.html") !== -1
                ? <Mix />
                : location.pathname.indexOf("listen.html") !== -1
                    ? <Listen />
                    : location.pathname.indexOf("admin.html") !== -1
                        ? <Admin />
                        : <Record />}
        </div>
    </>
);