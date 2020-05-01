import {h, Fragment} from "preact";
import {t, getLanguages, getLanguage, setLanguage} from "../i18n";

const navigation = metaNavigation => {
    let nav = [
        {title: t`record`, path: "/"},
        {title: t`mix`, path: "/mix"},
        {title: t`listen`, path: "/listen"}
    ];
    if (metaNavigation)
        nav = nav.concat(metaNavigation);
    return nav;
};

const sideNavigation = () => [
    {title: "π", path: "/admin"}
];

const itemToNode = path => item => {
    if (item.dropdown)
        return (
            <li key={item.dropdown} class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    {item.dropdown}
                </a>
                <div class="dropdown-menu" aria-labelledby="navbarDropdown">
                    {item.items.map(item => <a key={item.path} class="dropdown-item" href={item.path} target={item.target}>{item.title}</a>)}
                </div>
            </li>
        );
    else
        return (
            <li key={item.path} class={`nav-item ${(item.path === "/" ? path === item.path : path.startsWith(item.path)) ? "active" : ""}`}>
                <a class="nav-link" href={item.path} target={item.target}>{item.title}</a>
            </li>
        );
};

export default ({config: {title, metaNavigation}, path}) => (
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <a class="navbar-brand" href="/">{title || t`title`}</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent"
            aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon" />
        </button>
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
            <ul class="navbar-nav mr-auto">
                {navigation(metaNavigation).map(itemToNode(path))}
            </ul>
            <ul class="navbar-nav" style="margin-right: 12px;">
                {sideNavigation().map(itemToNode(path))}
            </ul>
            <form class="form-inline my-2 my-lg-0">
                <select class="custom-select" class="form-control mr-sm-2" onchange={e => setLanguage(e.target.value)} title={t`language`}>
                    {getLanguages().map(language => (
                        <option key={language} value={language} selected={getLanguage() === language}>
                            {t(language)}
                        </option>
                    ))}
                </select>
            </form>
        </div>
    </nav>
);