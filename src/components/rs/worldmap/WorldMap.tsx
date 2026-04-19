import {
    MouseEvent,
    TouchEvent,
    WheelEvent,
    memo,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { useElementSize } from "usehooks-ts";

import { getMapSquareId } from "../../../rs/map/MapFileIndex";
import { clamp } from "../../../util/MathUtil";
import "./WorldMap.css";
import locationsImport from "./locations.json";

interface Location {
    name: string;
    coords: number[];
    size?: string;
}

interface LocationOption {
    value: string;
    label: string;
}

const locations: Location[] = locationsImport.locations;
const locationsMap: Record<string, Location> = {};
const locationOptions: LocationOption[] = [];

for (const location of locations) {
    const key = `${location.name} ${location.coords.join(",")}`;
    locationsMap[key] = location;
    locationOptions.push({
        value: key,
        label: location.name,
    });
}

interface Position {
    x: number;
    y: number;
}

const TILE_SIZES = [0.25, 0.375, 0.5, 0.75, 1, 2, 3, 4, 5, 6, 8, 10];

const DEFAULT_TILE_SIZE = 3;

const MAX_X = 100 * 64;
const MAX_Y = 200 * 64;

// TODO: Optimize by writing to 1 image

export interface WorldMapProps {
    onDoubleClick: (x: number, y: number) => void;

    getPosition: () => Position;
    loadMapImageUrl: (mapX: number, mapY: number) => string | undefined;
    markers?: WorldMapMarker[];
    interactionLabel?: string;
}

export interface WorldMapMarker {
    id: string;
    x: number;
    y: number;
    label?: string;
    tone?: "gold" | "cyan" | "rose";
    selected?: boolean;
}

export const WorldMap = memo(function WorldMap(props: WorldMapProps) {
    const { getPosition, loadMapImageUrl } = props;

    const [ref, { width = 0, height = 0 }] = useElementSize();
    const dragRef = useRef<HTMLDivElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState<Position>({ x: 0, y: 0 });
    // Track initial press position and whether a drag occurred beyond a small threshold
    const downPosRef = useRef<Position>({ x: 0, y: 0 });
    const didDragRef = useRef<boolean>(false);

    const [pos, setPos] = useState(getPosition);
    const [tileSizeIndex, setTileSizeIndex] = useState(TILE_SIZES.indexOf(DEFAULT_TILE_SIZE));

    const [images, setImages] = useState<JSX.Element[]>([]);

    const requestRef = useRef<number | undefined>();

    const tileSize = TILE_SIZES[tileSizeIndex];

    const cameraX = pos.x | 0;
    const cameraY = pos.y | 0;

    const halfWidth = (width / 2) | 0;
    const halfHeight = (height / 2) | 0;

    const animate = useCallback(
        (time: DOMHighResTimeStamp) => {
            const halfTileSize = tileSize / 2;
            const imageSize = 64 * tileSize;

            const mapX = pos.x >> 6;
            const mapY = pos.y >> 6;

            const x = halfWidth - (cameraX % 64) * tileSize - halfTileSize;
            const y = halfHeight - (cameraY % 64) * tileSize - halfTileSize;

            const renderStartX = -Math.ceil(x / imageSize) - 1;
            const renderStartY = -Math.ceil(y / imageSize) - 1;

            const renderEndX = Math.ceil((width - x) / imageSize) + 1;
            const renderEndY = Math.ceil((height - y) / imageSize) + 1;

            const images: JSX.Element[] = [];

            for (let rx = renderStartX; rx < renderEndX; rx++) {
                for (let ry = renderStartY; ry < renderEndY; ry++) {
                    const imageMapX = mapX + rx;
                    const imageMapY = mapY + ry;
                    const mapId = getMapSquareId(imageMapX, imageMapY);
                    const mapUrl = loadMapImageUrl(imageMapX, imageMapY);
                    if (mapUrl) {
                        images.push(
                            <img
                                key={mapId}
                                className={`worldmap-image ${imageMapX}_${imageMapY}`}
                                src={mapUrl}
                                alt=""
                                style={{
                                    left: x + rx * imageSize,
                                    bottom: y + ry * imageSize,
                                    width: imageSize,
                                    height: imageSize,
                                }}
                            />,
                        );
                    }
                }
            }

            setImages(images);

            requestRef.current = requestAnimationFrame(animate);
        },
        [
            cameraX,
            cameraY,
            halfHeight,
            halfWidth,
            height,
            loadMapImageUrl,
            pos.x,
            pos.y,
            tileSize,
            width,
        ],
    );

    useLayoutEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [animate]);

    const teleportAtPointer = (offsetX: number, offsetY: number) => {
        const deltaX = (offsetX - halfWidth) / tileSize + 0.5;
        const deltaY = (halfHeight - offsetY) / tileSize + 0.5;
        const worldX = cameraX + deltaX;
        const worldY = cameraY + deltaY;
        const tileX = Math.floor(worldX);
        const tileY = Math.floor(worldY);
        console.log(
            `[WorldMap] Pointer offset=(${offsetX | 0},${offsetY | 0}), world=(${worldX.toFixed(
                2,
            )},${worldY.toFixed(2)}), tile=(${tileX},${tileY})`,
        );
        props.onDoubleClick(worldX, worldY);
    };

    // Single-click teleport (ignore if a drag occurred)
    const onClick = (event: MouseEvent) => {
        if (didDragRef.current) {
            console.log("[WorldMap] Click ignored - drag detected");
            return;
        }

        console.log("[WorldMap] Click detected, teleporting...");
        const offsetX = event.nativeEvent.offsetX;
        const offsetY = event.nativeEvent.offsetY;
        teleportAtPointer(offsetX, offsetY);
    };

    function startDragging(startX: number, startY: number) {
        setIsDragging(true);
        setStartPos({
            x: startX,
            y: startY,
        });
        // setStartX(startX);
        // setStartY(startY);
    }

    const onMouseDown = (event: MouseEvent) => {
        const rect = dragRef.current?.getBoundingClientRect();
        const offsetX = rect?.left ?? 0;
        const offsetY = rect?.top ?? 0;
        const x = event.clientX - offsetX;
        const y = event.clientY - offsetY;
        didDragRef.current = false;
        downPosRef.current = { x, y };
        startDragging(x, y);
    };

    const onTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        const rect = dragRef.current?.getBoundingClientRect();
        const offsetX = rect?.left ?? 0;
        const offsetY = rect?.top ?? 0;
        startDragging(touch.clientX - offsetX, touch.clientY - offsetY);
    };

    const drag = (x: number, y: number) => {
        const { x: startX, y: startY } = startPos;

        const deltaX = (startX - x) / tileSize;
        const deltaY = (y - startY) / tileSize;

        startPos.x = x;
        startPos.y = y;
        setPos((pos) => {
            return {
                x: clamp(pos.x + deltaX, 0, MAX_X),
                y: clamp(pos.y + deltaY, 0, MAX_Y),
            };
        });
    };

    const onMouseMove = (event: MouseEvent) => {
        if (isDragging) {
            const rect = dragRef.current?.getBoundingClientRect();
            const offsetX = rect?.left ?? 0;
            const offsetY = rect?.top ?? 0;
            const x = event.clientX - offsetX;
            const y = event.clientY - offsetY;
            // Mark as a drag if moved more than a small threshold from initial down
            const dx0 = Math.abs(x - downPosRef.current.x);
            const dy0 = Math.abs(y - downPosRef.current.y);
            if (dx0 > 4 || dy0 > 4) didDragRef.current = true;

            drag(x, y);
        }
    };

    const onTouchMove = (event: TouchEvent) => {
        if (isDragging) {
            const touch = event.touches[0];
            const rect = dragRef.current?.getBoundingClientRect();
            const offsetX = rect?.left ?? 0;
            const offsetY = rect?.top ?? 0;
            const x = touch.clientX - offsetX;
            const y = touch.clientY - offsetY;
            const dx0 = Math.abs(x - downPosRef.current.x);
            const dy0 = Math.abs(y - downPosRef.current.y);
            if (dx0 > 4 || dy0 > 4) didDragRef.current = true;
            drag(x, y);
        }
    };

    const stopDragging = (event: MouseEvent | TouchEvent) => {
        setIsDragging(false);
    };

    // Touch tap-to-teleport support
    const onTouchEndTeleport = (event: TouchEvent) => {
        // If we didn't drag, interpret as a tap
        if (!didDragRef.current) {
            const rect = dragRef.current?.getBoundingClientRect();
            const offsetLeft = rect?.left ?? 0;
            const offsetTop = rect?.top ?? 0;
            const touch = event.changedTouches[0];
            if (touch) {
                const x = touch.clientX - offsetLeft;
                const y = touch.clientY - offsetTop;
                teleportAtPointer(x, y);
            }
        }
        setIsDragging(false);
    };

    const zoom = (delta: number) => {
        const newIndex = clamp(tileSizeIndex + delta, 0, TILE_SIZES.length - 1);
        setTileSizeIndex(newIndex);
        return TILE_SIZES[newIndex];
    };

    const onMouseWheel = (event: WheelEvent) => {
        const offsetX = event.nativeEvent.offsetX;
        const offsetY = event.nativeEvent.offsetY;

        const deltaX = (offsetX - halfWidth) / tileSize;
        const deltaY = (halfHeight - offsetY) / tileSize;

        const newSize = zoom(-Math.sign(event.deltaY));

        const newDeltaX = (offsetX - halfWidth) / newSize;
        const newDeltaY = (halfHeight - offsetY) / newSize;

        setPos((pos) => {
            return {
                x: clamp(pos.x + deltaX - newDeltaX, 0, MAX_X),
                y: clamp(pos.y + deltaY - newDeltaY, 0, MAX_Y),
            };
        });
    };

    const zoomOut = () => {
        zoom(-1);
    };

    const zoomIn = () => {
        zoom(1);
    };

    const borderWidth = MAX_X * tileSize;
    const borderHeight = MAX_Y * tileSize;

    const borderOffsetX = cameraX * tileSize;
    const borderOffsetY = cameraY * tileSize;
    const markers = props.markers ?? [];
    const interactionLabel = props.interactionLabel ?? "Click to teleport";

    return (
        <div className="worldmap-container">
            <div className="worldmap" ref={ref}>
                {images}
                {markers.map((marker) => {
                    const left = halfWidth + (marker.x - cameraX) * tileSize - 6;
                    const bottom = halfHeight + (marker.y - cameraY) * tileSize - 6;
                    return (
                        <div
                            key={marker.id}
                            className={`worldmap-marker tone-${marker.tone ?? "gold"}${
                                marker.selected ? " selected" : ""
                            }`}
                            style={{ left, bottom }}
                            title={marker.label}
                        />
                    );
                })}
                {/* <div className=""
                style={{
                    position: "absolute",
                    left: halfWidth - 2,
                    bottom: halfHeight - 2,
                    width: 4,
                    height: 4,
                    backgroundColor: "cyan",
                    // zIndex: 10,
                }}
            ></div> */}
                <div
                    className="worldmap-border"
                    style={{
                        position: "absolute",
                        left: halfWidth - borderOffsetX,
                        bottom: halfHeight - borderOffsetY,
                        width: borderWidth,
                        height: borderHeight,
                    }}
                ></div>
                <div
                    className={`worldmap-drag ${isDragging ? "dragging" : ""}`}
                    onClick={onClick}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={stopDragging}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEndTeleport}
                    onWheel={onMouseWheel}
                    onMouseLeave={stopDragging}
                    title={interactionLabel}
                    ref={dragRef}
                ></div>
            </div>
            <div className="worldmap-footer rs-border rs-background">
                <span className="flex hide-mobile"></span>
                <span className="worldmap-zoom-buttons flex align-right">
                    <div className="worldmap-zoom-button worldmap-zoom-out" onClick={zoomOut}></div>
                    <div className="worldmap-zoom-button worldmap-zoom-in" onClick={zoomIn}></div>
                </span>
            </div>
        </div>
    );
});
