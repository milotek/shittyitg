/**
 * Every distance in the engine is in cells, and one cell is one arrow width: the noteskin's tap
 * mesh spans 64 source units, and that span is the definition. Nothing here knows a pixel exists.
 */

export const COLUMNS = 4
export const COLUMN_X = [-1.5, -0.5, 0.5, 1.5] as const

/** Screen y grows downward, so an upscroll receptor sits above the field's centre. */
export const RECEPTOR_Y = -1.95
export const REVERSE_RECEPTOR_Y = 2.27

/** The height the viewport shows, and the denominator every mod that scales with the field uses. */
export const FIELD_HEIGHT = 7.5

/** How far past and ahead of the receptors, in scroll offset, arrows are still drawn. */
export const DRAW_BEHIND = -2
export const DRAW_AHEAD = 11

/** Where sudden and hidden fade, measured from the receptors. */
export const FADE_LINE = FIELD_HEIGHT / 3
export const FADE_WIDTH = FIELD_HEIGHT / 12

/**
 * Camera distance for the perspective warp: a 45 degree vertical field of view over the field's
 * height, the angle StepMania's own camera uses.
 */
export const CAMERA_DISTANCE = FIELD_HEIGHT / 2 / Math.tan(Math.PI / 8)
