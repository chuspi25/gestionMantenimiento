// Utilidades de validación para el frontend
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
export function validateRequired(value) {
    return value.trim().length > 0;
}
export function validatePassword(password) {
    return password.length >= 6;
}
export function validateTaskForm(form) {
    const errors = [];
    if (!validateRequired(form.title)) {
        errors.push('El título es requerido');
    }
    if (!validateRequired(form.description)) {
        errors.push('La descripción es requerida');
    }
    if (!validateRequired(form.location)) {
        errors.push('La ubicación es requerida');
    }
    if (form.estimatedDuration <= 0) {
        errors.push('La duración estimada debe ser mayor a 0');
    }
    if (!form.dueDate) {
        errors.push('La fecha límite es requerida');
    }
    return errors;
}
export function validateUserForm(form) {
    const errors = [];
    if (!validateRequired(form.name)) {
        errors.push('El nombre es requerido');
    }
    if (!validateEmail(form.email)) {
        errors.push('El email no es válido');
    }
    if (!validatePassword(form.password)) {
        errors.push('La contraseña debe tener al menos 6 caracteres');
    }
    return errors;
}
