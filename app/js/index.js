import "bootstrap";
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import {h, Fragment, render} from "preact";
import {t, setDefaultLanguage} from "./i18n";
import App from "./components/App";
import {fetchJson} from "./api";

render(<App />, document.body);

fetchJson({config: true}).then(config => {
    setDefaultLanguage(config.defaultLanguage);
    if (localStorage.getItem("song") && !config.songs.hasOwnProperty(localStorage.getItem("song")) ||
        localStorage.getItem("register") && localStorage.getItem("register") !== "null" &&
        !config.registers.hasOwnProperty(localStorage.getItem("register"))) {
        localStorage.clear();
        location.reload();
    } else {
        document.title = config.title || t`title`;
        render(<App config={config} />, document.body);
    }
});