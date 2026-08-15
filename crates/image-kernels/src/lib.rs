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
}
