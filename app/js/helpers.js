import {useState, useEffect} from "preact/hooks";
import {route as _route} from "preact-router";

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