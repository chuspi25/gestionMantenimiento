/**
 * Traducciones al castellano para el sistema
 */

export const translations = {
  // Navegación
  nav: {
    dashboard: 'Panel de Control',
    tasks: 'Tareas',
    createTask: 'Crear Tarea',
    users: 'Usuarios',
    createUser: 'Crear Usuario',
    reports: 'Informes',
    settings: 'Configuración'
  },
  
  // Dashboard
  dashboard: {
    title: 'Panel de Control',
    totalTasks: 'Total de Tareas',
    pendingTasks: 'Tareas Pendientes',
    inProgressTasks: 'En Progreso',
    completedTasks: 'Completadas',
    overdueTask: 'Tareas Vencidas',
    quickActions: 'Acciones Rápidas',
    createNewTask: 'Crear Nueva Tarea',
    viewAllTasks: 'Ver Todas las Tareas',
    generateReport: 'Generar Informe',
    refresh: 'Actualizar',
    loading: 'Cargando...'
  },
  
  // Tareas
  tasks: {
    title: 'Gestión de Tareas',
    createTask: 'Crear Nueva Tarea',
    editTask: 'Editar Tarea',
    viewTask: 'Ver Detalles',
    deleteTask: 'Eliminar Tarea',
    assignTask: 'Asignar Tarea',
    updateStatus: 'Actualizar Estado',
    filters: 'Filtros',
    search: 'Buscar tareas...',
    clearFilters: 'Limpiar Filtros',
    noTasks: 'No hay tareas disponibles',
    taskDetails: 'Detalles de la Tarea',
    
    // Campos
    taskTitle: 'Título',
    description: 'Descripción',
    type: 'Tipo',
    priority: 'Prioridad',
    status: 'Estado',
    assignedTo: 'Asignado a',
    createdBy: 'Creado por',
    location: 'Ubicación',
    dueDate: 'Fecha de Vencimiento',
    estimatedDuration: 'Duración Estimada (minutos)',
    requiredTools: 'Herramientas Requeridas',
    addTool: 'Agregar Herramienta',
    
    // Tipos
    types: {
      electrical: 'Eléctrico',
      mechanical: 'Mecánico'
    },
    
    // Prioridades
    priorities: {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente'
    },
    
    // Estados
    statuses: {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completada',
      cancelled: 'Cancelada'
    }
  },
  
  // Usuarios
  users: {
    title: 'Gestión de Usuarios',
    createUser: 'Crear Nuevo Usuario',
    editUser: 'Editar Usuario',
    viewUser: 'Ver Usuario',
    deleteUser: 'Eliminar Usuario',
    noUsers: 'No hay usuarios disponibles',
    
    // Campos
    name: 'Nombre',
    email: 'Correo Electrónico',
    role: 'Rol',
    status: 'Estado',
    active: 'Activo',
    inactive: 'Inactivo',
    lastLogin: 'Último Acceso',
    createdAt: 'Fecha de Creación',
    
    // Roles
    roles: {
      admin: 'Administrador',
      supervisor: 'Supervisor',
      operator: 'Operador'
    }
  },
  
  // Informes
  reports: {
    title: 'Informes y Reportes',
    generateReport: 'Generar Informe',
    exportPDF: 'Exportar PDF',
    exportExcel: 'Exportar Excel',
    exportCSV: 'Exportar CSV',
    clearFilters: 'Limpiar Filtros',
    dateRange: 'Rango de Fechas',
    startDate: 'Fecha Inicio',
    endDate: 'Fecha Fin',
    reportType: 'Tipo de Informe',
    
    // Tipos de informes
    types: {
      tasks: 'Informe de Tareas',
      users: 'Informe de Usuarios',
      performance: 'Informe de Rendimiento',
      maintenance: 'Informe de Mantenimiento'
    },
    
    // Estadísticas
    statistics: {
      totalTasks: 'Total de Tareas',
      completedTasks: 'Tareas Completadas',
      averageTime: 'Tiempo Promedio',
      efficiency: 'Eficiencia'
    }
  },
  
  // Configuración
  settings: {
    title: 'Configuración del Sistema',
    general: 'General',
    security: 'Seguridad',
    notifications: 'Notificaciones',
    appearance: 'Apariencia',
    save: 'Guardar Cambios',
    cancel: 'Cancelar',
    reset: 'Restablecer'
  },
  
  // Botones comunes
  buttons: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    view: 'Ver',
    create: 'Crear',
    update: 'Actualizar',
    refresh: 'Actualizar',
    search: 'Buscar',
    filter: 'Filtrar',
    clear: 'Limpiar',
    export: 'Exportar',
    import: 'Importar',
    download: 'Descargar',
    upload: 'Subir',
    close: 'Cerrar',
    back: 'Volver',
    next: 'Siguiente',
    previous: 'Anterior',
    confirm: 'Confirmar',
    yes: 'Sí',
    no: 'No'
  },
  
  // Mensajes
  messages: {
    success: {
      saved: 'Guardado exitosamente',
      created: 'Creado exitosamente',
      updated: 'Actualizado exitosamente',
      deleted: 'Eliminado exitosamente'
    },
    error: {
      generic: 'Ha ocurrido un error',
      notFound: 'No encontrado',
      unauthorized: 'No autorizado',
      validation: 'Error de validación',
      network: 'Error de conexión'
    },
    confirm: {
      delete: '¿Está seguro de que desea eliminar este elemento?',
      cancel: '¿Está seguro de que desea cancelar?',
      unsavedChanges: 'Tiene cambios sin guardar. ¿Desea continuar?'
    }
  },
  
  // Validación
  validation: {
    required: 'Este campo es requerido',
    email: 'Correo electrónico inválido',
    minLength: 'Longitud mínima: {min} caracteres',
    maxLength: 'Longitud máxima: {max} caracteres',
    min: 'Valor mínimo: {min}',
    max: 'Valor máximo: {max}',
    pattern: 'Formato inválido'
  },
  
  // Estados de carga
  loading: {
    loading: 'Cargando...',
    saving: 'Guardando...',
    deleting: 'Eliminando...',
    processing: 'Procesando...'
  },
  
  // Paginación
  pagination: {
    showing: 'Mostrando',
    of: 'de',
    results: 'resultados',
    page: 'Página',
    perPage: 'Por página'
  }
};

export default translations;
