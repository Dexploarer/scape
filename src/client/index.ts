/**
 * Client Module - Core client state and visual components
 */

export {
    ClientState,
    clientState,
    MOUSE_CROSS_NONE,
    MOUSE_CROSS_RED,
    MOUSE_CROSS_YELLOW,
} from "./ClientState";
export type { ClientEntity } from "./ClientState";

export {
    renderMouseCross,
    getMouseCrossStyle,
    getMouseCrossColor,
    shouldRenderMouseCross,
} from "./MouseCross";

export {
    shouldRenderDestinationMarker,
    getDestinationLocal,
    getDestinationWorld,
    tileToScreen,
    renderDestinationFlag,
    clearDestinationMarker,
    setDestinationMarker,
    getDestinationMarkerStyle,
    getDestinationMarkerState,
} from "./DestinationMarker";
export type { DestinationMarkerState } from "./DestinationMarker";
