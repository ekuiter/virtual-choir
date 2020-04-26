import {h, Fragment} from "preact";
import {t, getLanguages, getLanguage, setLanguage} from "../i18n";

const navigation = () => [
    {title: t`record`, href: "/"},
    {title: t`mix`, href: "/mix"},
    {title: t`listen`, href: "/listen"}
];

const sideNavigation = () => [
    {title: "π", href: "/admin"}
];

export default ({config: {title}, path}) => (
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <a class="navbar-brand" href="/">{title || t`title`}</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent"
            aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon" />
        </button>
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
            <ul class="navbar-nav mr-auto">
                {navigation().map(({title, href}) => (
                    <li class={`nav-item ${(href === "/" ? path === href : path.startsWith(href)) ? "active" : ""}`}>
                        <a class="nav-link" href={href}>{title}</a>
                    </li>
                ))}
            </ul>
            <ul class="navbar-nav" style="margin-right: 12px;">
                {sideNavigation().map(({title, href}) => (
                    <li class={`nav-item ${(href === "/" ? path === href : path.startsWith(href)) ? "active" : ""}`}>
                        <a class="nav-link" href={href}>{title}</a>
                    </li>
                ))}
            </ul>
            <form class="form-inline my-2 my-lg-0">
                <select class="custom-select" class="form-control mr-sm-2" onchange={e => setLanguage(e.target.value)} title={t`language`}>
                    {getLanguages().map(language => (
                        <option value={language} selected={getLanguage() === language}>
                            {t(language)}
                        </option>
                    ))}
                </select>
            </form>
        </div>
    </nav>
);