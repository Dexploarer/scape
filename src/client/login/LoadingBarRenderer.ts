/**
 * OSRS-style Loading Bar Renderer
 * Matches GameEngine.java drawInitial()
 *
 * Used during cache download before LoginRenderer is available.
 * Also used by LoginRenderer during asset loading phase.
 */

export const LOADING_BAR = {
    WIDTH: 304,
    HEIGHT: 34,
    COLOR: "#8c1111",
    CONTENT_WIDTH: 765,
    CONTENT_HEIGHT: 503,
    BAR_Y: 240,
} as const;

/**
 * Draw OSRS-style loading bar to a canvas 2D context
 */
export function drawLoadingBar(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    progress: number,
    text: string,
    title: string = "RuneScape is loading - please wait...",
): void {
    // Clear to black
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    // Calculate content area position (horizontally centered, top-aligned)
    const contentX = Math.floor((width - LOADING_BAR.CONTENT_WIDTH) / 2);
    const contentY = 0;

    // Calculate bar position
    const barX = contentX + Math.floor((LOADING_BAR.CONTENT_WIDTH - LOADING_BAR.WIDTH) / 2);
    const barY = contentY + LOADING_BAR.BAR_Y - LOADING_BAR.HEIGHT / 2;

    // Draw title
    ctx.font = "bold 13px Helvetica, Arial, sans-serif";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(title, barX + LOADING_BAR.WIDTH / 2, barY - 8);

    // Outer red border
    ctx.strokeStyle = LOADING_BAR.COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, LOADING_BAR.WIDTH - 1, LOADING_BAR.HEIGHT - 1);

    // Inner black border
    ctx.strokeStyle = "black";
    ctx.strokeRect(barX + 1.5, barY + 1.5, LOADING_BAR.WIDTH - 3, LOADING_BAR.HEIGHT - 3);

    // Black background
    ctx.fillStyle = "black";
    ctx.fillRect(barX + 2, barY + 2, LOADING_BAR.WIDTH - 4, LOADING_BAR.HEIGHT - 4);

    // Red progress fill (percent * 3 pixels, max 300)
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const fillWidth = Math.floor(clampedProgress * 3);
    if (fillWidth > 0) {
        ctx.fillStyle = LOADING_BAR.COLOR;
        ctx.fillRect(barX + 2, barY + 2, fillWidth, LOADING_BAR.HEIGHT - 4);
    }

    // Progress text
    ctx.font = "bold 13px Helvetica, Arial, sans-serif";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, barX + LOADING_BAR.WIDTH / 2, barY + LOADING_BAR.HEIGHT / 2);
}
