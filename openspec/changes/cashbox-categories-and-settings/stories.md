# User Stories: cashbox-categories-and-settings

## Story 1: Sembrado y Consulta de Categorías Normalizadas
Como operador del taller,
quiero que las formas de ingresos y egresos sugeridas (`seña`, `saldo_pedido`, `extraordinario`, `otro`, `filamento`, `repuestos`, `servicios`, `embalaje`, `mantenimiento`, `otro`) estén persistidas en la base de datos relacional,
para que el sistema no dependa de opciones fijas en el código.

## Story 2: Registro de Nuevas Formas de Ingresos y Egresos
Como administrador del taller,
quiero poder crear nuevas categorías de ingresos (ej. "venta_insumos", "clases_3d") o de egresos (ej. "software_cad", "marketing") desde una pantalla de Configuración de Caja,
para adaptar el control financiero al crecimiento de mi negocio.

## Story 3: Selección Dinámica en Modales de Caja Diaria
Como operador del taller,
quiero que al registrar un ingreso o egreso en el módulo de caja, el desplegable me ofrezca las categorías activas vigentes consultadas desde el backend,
para clasificar mis operaciones con los datos actualizados del catálogo.

## Story 4: Desacoplamiento de la Configuración de Caja en el Menú
Como usuario del sistema,
quiero un elemento dedicado "Configuración de Caja" en el menú de navegación separado de la configuración del taller,
para acceder rápidamente a los parámetros y catálogos financieros sin mezclarlo con las constantes de impresión 3D.
