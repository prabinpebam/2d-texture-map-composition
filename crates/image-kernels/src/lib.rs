const SCALAR_EPSILON: f32 = 1.0e-7;

pub fn linear_dodge(backdrop: f32, source: f32) -> f32 {
    (backdrop + source).clamp(0.0, 1.0)
}

pub fn divide(backdrop: f32, source: f32) -> f32 {
    if source <= SCALAR_EPSILON {
        1.0
    } else {
        (backdrop / source).clamp(0.0, 1.0)
    }
}

pub fn extract_mask(red: f32, green: f32, blue: f32, alpha: f32, source: u32, invert: bool) -> f32 {
    let value = match source {
        0 => 0.2126 * red + 0.7152 * green + 0.0722 * blue,
        1 => alpha,
        2 => red,
        3 => green,
        4 => blue,
        _ => 0.0,
    }
    .clamp(0.0, 1.0);
    if invert { 1.0 - value } else { value }
}

#[unsafe(no_mangle)]
pub extern "C" fn allocate_f32(length: usize) -> *mut f32 {
    let mut values = vec![0.0_f32; length];
    let pointer = values.as_mut_ptr();
    std::mem::forget(values);
    pointer
}

#[unsafe(no_mangle)]
/// # Safety
///
/// `pointer` must have been returned by `allocate_f32` for exactly `length`
/// elements and must not have been deallocated previously.
pub unsafe extern "C" fn deallocate_f32(pointer: *mut f32, length: usize) {
    if pointer.is_null() || length == 0 {
        return;
    }

    unsafe {
        drop(Vec::from_raw_parts(pointer, length, length));
    }
}

#[unsafe(no_mangle)]
/// # Safety
///
/// `pointer` must reference `length` initialized, writable `f32` elements for
/// the duration of this call.
pub unsafe extern "C" fn linear_dodge_tile_f32(pointer: *mut f32, length: usize, source: f32) {
    if pointer.is_null() || length == 0 {
        return;
    }

    let values = unsafe { std::slice::from_raw_parts_mut(pointer, length) };
    for value in values {
        *value = linear_dodge(*value, source);
    }
}

#[unsafe(no_mangle)]
/// # Safety
///
/// `pointer` must reference `pixel_count * 4` initialized, writable RGBA `f32`
/// elements. The first `pixel_count` elements contain the mask after this call.
pub unsafe extern "C" fn extract_mask_rgba_f32(
    pointer: *mut f32,
    pixel_count: usize,
    source: u32,
    invert: bool,
) {
    if pointer.is_null() || pixel_count == 0 {
        return;
    }
    let values = unsafe { std::slice::from_raw_parts_mut(pointer, pixel_count * 4) };
    for pixel_index in 0..pixel_count {
        let offset = pixel_index * 4;
        values[pixel_index] = extract_mask(
            values[offset],
            values[offset + 1],
            values[offset + 2],
            values[offset + 3],
            source,
            invert,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linear_dodge_clamps_both_boundaries() {
        assert_eq!(linear_dodge(-0.5, 0.25), 0.0);
        assert_eq!(linear_dodge(0.25, 0.5), 0.75);
        assert_eq!(linear_dodge(0.75, 0.5), 1.0);
    }

    #[test]
    fn divide_handles_zero_and_clamps_high_values() {
        assert_eq!(divide(0.5, 0.0), 1.0);
        assert_eq!(divide(0.25, 0.5), 0.5);
        assert_eq!(divide(0.75, 0.5), 1.0);
    }

    #[test]
    fn tile_kernel_updates_values_in_place() {
        let mut values = [0.0_f32, 0.25, 0.75, 1.0];
        unsafe {
            linear_dodge_tile_f32(values.as_mut_ptr(), values.len(), 0.25);
        }
        assert_eq!(values, [0.25, 0.5, 1.0, 1.0]);
    }

    #[test]
    fn mask_catalog_matches_linear_channel_contract() {
        let rgba = [0.25, 0.5, 0.75, 0.4];
        assert!(
            (extract_mask(rgba[0], rgba[1], rgba[2], rgba[3], 0, false) - 0.4649).abs() <= 1.0e-6
        );
        assert_eq!(
            extract_mask(rgba[0], rgba[1], rgba[2], rgba[3], 1, false),
            0.4
        );
        assert_eq!(
            extract_mask(rgba[0], rgba[1], rgba[2], rgba[3], 2, false),
            0.25
        );
        assert_eq!(
            extract_mask(rgba[0], rgba[1], rgba[2], rgba[3], 3, false),
            0.5
        );
        assert_eq!(
            extract_mask(rgba[0], rgba[1], rgba[2], rgba[3], 4, false),
            0.75
        );
        assert_eq!(
            extract_mask(rgba[0], rgba[1], rgba[2], rgba[3], 1, true),
            0.6
        );
    }
}
