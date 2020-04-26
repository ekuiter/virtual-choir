import {route as _route} from "preact-router";

const encode = str => encodeURIComponent(btoa(str));

const _atob = str => {
    try {
        return atob(str);
    } catch (err) {}
};

export const decode = (str, parseJson = false) => {
    if (!str)
        return;

    const decoded = _atob(decodeURIComponent(str));
    if (!decoded)
        return;
    return parseJson ? JSON.parse(decoded) : decoded;
};

export const route = (path, ...params) =>
    _route(path + params.reduce((acc, val) => acc + "/" + encode(val), ""));