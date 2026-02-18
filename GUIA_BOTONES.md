# 🔘 Guía de Botones Unificados

## Estilos de Botones Disponibles

### 1. Botones Primarios (Azul) 🔵
**Uso**: Acciones principales, envío de formularios, confirmaciones

**Clases**:
- `.primary-button`
- `.login-button`
- `.action-button`
- `.view-task-btn`
- `.retry-button`
- `button[type="submit"]`
- `.btn-primary`

**Estilo**:
- Fondo: Gradiente azul (#3b82f6 → #2563eb)
- Texto: Blanco
- Hover: Azul más claro con elevación
- Sombra: Azul suave

**Ejemplo**:
```html
<button class="primary-button">Guardar</button>
<button type="submit">Enviar</button>
```

---

### 2. Botones Secundarios (Naranja) 🟠
**Uso**: Acciones secundarias, crear, agregar, limpiar

**Clases**:
- `.secondary-button`
- `.add-tool-button`
- `.clear-filters-button`
- `.create-button`
- `.btn-secondary`

**Estilo**:
- Fondo: Gradiente naranja (#f97316 → #ea580c)
- Texto: Blanco
- Hover: Naranja más claro con elevación
- Sombra: Naranja suave

**Ejemplo**:
```html
<button class="secondary-button">Crear Usuario</button>
<button class="add-tool-button">Agregar Herramienta</button>
```

---

### 3. Botones de Éxito (Verde) 🟢
**Uso**: Guardar, confirmar, completar, actualizar estado

**Clases**:
- `.success-button`
- `.save-button`
- `.confirm-button`
- `.status-button`
- `.btn-success`

**Estilo**:
- Fondo: Gradiente verde (#16a34a → #15803d)
- Texto: Blanco
- Hover: Verde más claro con elevación
- Sombra: Verde suave

**Ejemplo**:
```html
<button class="save-button">Guardar Cambios</button>
<button class="confirm-button">Confirmar</button>
```

---

### 4. Botones de Peligro (Rojo) 🔴
**Uso**: Eliminar, cancelar, rechazar

**Clases**:
- `.danger-button`
- `.delete-button`
- `.remove-button`
- `.cancel-button`
- `.btn-danger`

**Estilo**:
- Fondo: Gradiente rojo (#dc2626 → #b91c1c)
- Texto: Blanco
- Hover: Rojo más claro con elevación
- Sombra: Roja suave

**Ejemplo**:
```html
<button class="delete-button">Eliminar</button>
<button class="cancel-button">Cancelar</button>
```

---

### 5. Botones de Contorno (Outline) ⚪
**Uso**: Acciones alternativas, logout, volver

**Clases**:
- `.outline-button`
- `.logout-button`
- `.back-button`
- `.btn-outline`

**Estilo**:
- Fondo: Transparente
- Borde: Azul 2px
- Texto: Azul
- Hover: Fondo azul, texto blanco

**Ejemplo**:
```html
<button class="outline-button">Volver</button>
<button class="logout-button">Cerrar Sesión</button>
```

---

### 6. Botones Ghost (Transparentes) 👻
**Uso**: Cerrar, limpiar búsqueda, mostrar/ocultar

**Clases**:
- `.ghost-button`
- `.close-button`
- `.toggle-password`
- `.clear-search-button`
- `.btn-ghost`

**Estilo**:
- Fondo: Transparente
- Sin borde
- Texto: Gris
- Hover: Fondo gris claro

**Ejemplo**:
```html
<button class="close-button">✕</button>
<button class="toggle-password">👁️</button>
```

---

### 7. Botones de Actualizar (Cyan) 🔄
**Uso**: Refrescar datos, recargar

**Clases**:
- `.refresh-button`
- `.reload-button`
- `.btn-refresh`

**Estilo**:
- Fondo: Gradiente cyan (#0891b2 → #0e7490)
- Texto: Blanco
- Hover: Rotación 180° con elevación
- Sombra: Cyan suave

**Ejemplo**:
```html
<button class="refresh-button">🔄 Actualizar</button>
```

---

### 8. Botones de Exportación 📄
**Uso**: Exportar PDF, Excel, CSV

**Clases**:
- `.export-button` (base)
- `.pdf-button` (hover rojo)
- `.excel-button` (hover verde)
- `.csv-button` (hover azul)

**Estilo**:
- Fondo: Blanco
- Borde: Gris
- Hover: Color específico según tipo

**Ejemplo**:
```html
<button class="export-button pdf-button">📄 PDF</button>
<button class="export-button excel-button">📊 Excel</button>
<button class="export-button csv-button">📋 CSV</button>
```

---

### 9. Botones de Edición (Amarillo) ✏️
**Uso**: Editar, modificar

**Clases**:
- `.edit-button`
- `.modify-button`
- `.btn-edit`

**Estilo**:
- Fondo: Gradiente amarillo/naranja (#f59e0b → #d97706)
- Texto: Blanco
- Hover: Amarillo más claro con elevación

**Ejemplo**:
```html
<button class="edit-button">✏️ Editar</button>
```

---

### 10. Botones de Acción de Tareas 📋
**Uso**: Ver, editar, cambiar estado de tareas

**Clases**:
- `.task-action-button` (base)
- `.view-button` (hover azul)
- `.edit-button` (hover naranja)
- `.status-button` (hover verde)

**Estilo**:
- Fondo: Blanco
- Borde: Gris
- Hover: Color específico según acción

**Ejemplo**:
```html
<button class="task-action-button view-button">Ver</button>
<button class="task-action-button edit-button">Editar</button>
<button class="task-action-button status-button">Estado</button>
```

---

## Tamaños de Botones

### Pequeño
```html
<button class="primary-button btn-sm">Pequeño</button>
```
- Padding: 0.5rem 1rem
- Font-size: 0.813rem
- Min-height: 36px

### Normal (por defecto)
```html
<button class="primary-button">Normal</button>
```
- Padding: 0.75rem 1.5rem
- Font-size: 0.875rem
- Min-height: 44px

### Grande
```html
<button class="primary-button btn-lg">Grande</button>
```
- Padding: 1rem 2rem
- Font-size: 1rem
- Min-height: 52px

---

## Variantes Especiales

### Ancho Completo
```html
<button class="primary-button btn-block">Ancho Completo</button>
```

### Solo Icono
```html
<button class="primary-button btn-icon">🔍</button>
```

### Con Estado de Carga
```html
<button class="primary-button button-loading">Cargando...</button>
```

### Botón Flotante (FAB)
```html
<button class="fab-button">+</button>
<button class="fab-button secondary">📋</button>
```

---

## Grupos de Botones

### Horizontal
```html
<div class="button-group horizontal">
    <button class="primary-button">Guardar</button>
    <button class="outline-button">Cancelar</button>
</div>
```

### Vertical
```html
<div class="button-group vertical">
    <button class="primary-button">Opción 1</button>
    <button class="secondary-button">Opción 2</button>
    <button class="outline-button">Opción 3</button>
</div>
```

---

## Características Comunes

### ✨ Efectos
- **Hover**: Elevación de 2px + sombra más intensa
- **Active**: Escala 0.98 (efecto de presión)
- **Brillo**: Línea de luz que cruza al hacer hover
- **Disabled**: Opacidad 0.5 + cursor not-allowed

### 📱 Responsive
- En móvil (<768px): Botones principales a ancho completo
- Tamaño táctil mínimo: 44px x 44px
- Grupos de botones se apilan verticalmente

### ♿ Accesibilidad
- Focus visible con outline azul
- Touch-action: manipulation
- User-select: none
- Min-height: 44px (estándar Apple HIG)

### 🌙 Modo Oscuro
- Ajuste automático de colores
- Mejor contraste en fondos oscuros
- Botones outline y ghost adaptados

---

## Mejores Prácticas

1. **Usa el botón correcto para cada acción**:
   - Primario: Acción principal de la página
   - Secundario: Acciones alternativas
   - Peligro: Solo para acciones destructivas

2. **Máximo 2 botones primarios por vista**:
   - Evita confusión sobre la acción principal

3. **Agrupa botones relacionados**:
   - Usa `.button-group` para acciones relacionadas

4. **Incluye iconos cuando sea apropiado**:
   - Mejora la comprensión visual
   - Usa emojis o iconos SVG

5. **Proporciona feedback**:
   - Usa `.button-loading` durante operaciones asíncronas
   - Deshabilita botones cuando no sean aplicables

6. **Mantén consistencia**:
   - Usa las mismas clases para las mismas acciones
   - No mezcles estilos personalizados

---

## Ejemplos de Uso Común

### Formulario de Creación
```html
<div class="form-actions button-group">
    <button type="submit" class="primary-button">Crear Tarea</button>
    <button type="button" class="outline-button">Cancelar</button>
</div>
```

### Acciones de Tarjeta
```html
<div class="task-card-actions">
    <button class="task-action-button view-button">Ver</button>
    <button class="task-action-button edit-button">Editar</button>
    <button class="task-action-button status-button">Completar</button>
</div>
```

### Exportación de Datos
```html
<div class="export-actions button-group horizontal">
    <button class="export-button pdf-button">📄 PDF</button>
    <button class="export-button excel-button">📊 Excel</button>
    <button class="export-button csv-button">📋 CSV</button>
</div>
```

### Dashboard
```html
<div class="quick-actions">
    <button class="primary-button">Crear Tarea</button>
    <button class="secondary-button">Ver Todas</button>
    <button class="refresh-button">🔄 Actualizar</button>
</div>
```

---

## Migración de Botones Antiguos

Si tienes botones con estilos antiguos, simplemente agrega las nuevas clases:

```html
<!-- Antes -->
<button class="old-button">Guardar</button>

<!-- Después -->
<button class="primary-button">Guardar</button>
```

Todos los botones heredarán automáticamente el nuevo estilo moderno y consistente.
