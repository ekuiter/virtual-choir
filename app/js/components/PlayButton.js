import {h, Fragment} from "preact";
import {t} from "../i18n";

const IconButton = ({onClick, icon, children, minWidth, isVisible = true, style = "height: 38px;", margin = "6px 6px 6px 0",
        invisibleMargin = "6px 0", className = "", ...props}) => (
    <button class={`btn btn-light ${className}`} onclick={onClick}
        style={`${style} ${isVisible ?
            `visibility: visible; min-width: ${minWidth}px; padding: 0 12px 0 6px; margin: ${margin};`
            : `visibility: hidden; width: 0; padding: 0; margin: ${invisibleMargin};`}`} {...props}>
        {isVisible && (
            <>
                <img src={icon} width="24" height="24" style="float: left; padding: 0 3px 0 0;" />
                {children}
            </>
        )}
    </button>
);

export default ({isPlaying, onClick, ...props}) =>
    isPlaying
        ? <IconButton icon="img/stop.svg" onClick={onClick} minWidth={120} {...props}>{t`stop`}</IconButton>
        : <IconButton icon="img/play.svg" onClick={onClick} minWidth={120} {...props}>{t`play`}</IconButton>;