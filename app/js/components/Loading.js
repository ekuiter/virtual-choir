import {h, Fragment} from "preact";

export default ({margin = 20}) => (
    <>
        <div style="position: absolute; left: calc(50% - 50px);">
            <img src="/img/loading.gif" width="100" height="100" style={`margin-top: ${margin}px;`} />
        </div>
    </>
);