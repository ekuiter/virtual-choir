import {h, Fragment} from "preact";
import {useState, useEffect} from "preact/hooks";
import {route as _route} from "preact-router";
import {get, set, del} from "idb-keyval";

export const getRecordingArrayBuffer = () => get("recordingArrayBuffer");

export const setRecordingArrayBuffer = arrayBuffer => set("recordingArrayBuffer", arrayBuffer);

export const deleteRecordingArrayBuffer = () => del("recordingArrayBuffer");

export const useRepeat = (fn, deps = [], delay = 5000) => {
    useEffect(
      () => {
        const timeout = setInterval(fn, delay);
        fn(true);
        return () => clearInterval(timeout);
      },
      deps
    );
};

export const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(
      () => {
        const timeout = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timeout);
      },
      [value]
    );
    return debouncedValue;
};

export const useLocalStorage = (key, fn = val => val, initialValue = null) => {
    const [value, setValue] = useState(localStorage.getItem(key) !== null ? fn(localStorage.getItem(key)) : initialValue);
    return [value, newValue => {
        localStorage.setItem(key, newValue);
        setValue(newValue);
    }];
};

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

export const getName = (name, register) => register !== "null" ? <span>{name}, <em>{register}</em></span> : <span>{name}</span>;
export const getPlainName = (name, register) => register !== "null" ? `${name}, ${register}` : name;

export const makeToast = (message, name = "Notice") => {
    const e = new Error(message);
    e.name = name;
    window.onerror(null, null, null, null, e);
};