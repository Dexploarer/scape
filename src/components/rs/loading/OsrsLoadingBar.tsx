import "./OsrsLoadingBar.css";

interface OsrsLoadingBarProps {
    /** Optional title text displayed above the loading bar */
    title?: string;
    /** Optional text displayed inside the bar (defaults to percentage) */
    text?: string;
    progress: number;
}

/**
 * OSRS Loading Bar
 *
 * Structure (from reference):
 * - Outer: 304x34 with red border (#8C1111)
 * - Inner: 302x32 black border at (1,1)
 * - Progress: red fill at (2,2), width = percent * 3 (max 300px), height 30px
 * - Remainder: black fill
 * - Text: white Helvetica Bold 13pt, centered
 */
export function OsrsLoadingBar({ title, text, progress }: OsrsLoadingBarProps): JSX.Element {
    // Progress width: percent * 3 pixels (max 300 for 100%)
    // Clamp progress to 0-100 range
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const progressWidth = clampedProgress * 3;

    return (
        <div className="loading-bar-container">
            {title && <div className="loading-bar-title">{title}</div>}
            <div className="loading-bar">
                <div className="loading-bar-inner">
                    <div className="loading-bar-progress" style={{ width: `${progressWidth}px` }} />
                </div>
                <div className="loading-bar-text">{text ?? `${clampedProgress}%`}</div>
            </div>
        </div>
    );
}
