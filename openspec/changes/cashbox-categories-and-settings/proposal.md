# Change Proposal: cashbox-categories-and-settings

## 1. Context & Motivation
El módulo de caja diaria (`cashbox`) actualmente valida categorías a través de un conjunto estático/hardcodeado en código (`VALID_CATEGORIES`), y el frontend utiliza opciones fijas en sus modales de ingreso y egreso.

Para cumplir estrictamente con los principios de normalización relacional (1FN a 4FN/BCNF) y permitir que el taller agregue a futuro nuevas formas de ingresos y egresos sin alterar el código fuente, se deben crear tablas dedicadas de catálogo en la base de datos MySQL:
- `cash_income_categories`: Formas/categorías de ingresos (seña, saldo_pedido, extraordinario, otro, etc.).
- `cash_expense_categories`: Formas/categorías de egresos (filamento, repuestos, servicios, embalaje, mantenimiento, otro, etc.).

Además, se requiere una pantalla dedicada de configuración de caja (`/cashbox/settings`), accesible desde el menú principal de navegación de forma separada de la configuración del taller (`/settings`), para administrar (visualizar, crear, activar/desactivar) estas categorías.

## 2. Goals
1. **Normalización Relacional (1FN-4FN/BCNF):** Tablas de catálogo independientes con clave primaria entera autoincremental, código único atómico, nombre descriptivo, marcas de sistema/activación y relaciones referenciales con `cash_movements`.
2. **Sembrado de Categorías Sugeridas:**
   - Ingresos: `seña`, `saldo_pedido`, `extraordinario`, `otro`.
   - Egresos: `filamento`, `repuestos`, `servicios`, `embalaje`, `mantenimiento`, `otro`.
3. **Endpoints REST de Categorías:** CRUD para listar categorías activas (usadas en modales de caja) y administrar todas las categorías desde la configuración.
4. **Carga Dinámica en Modales de Caja:** Sustituir opciones fijas por consulta dinámica a los endpoints de categorías en `CashboxView`.
5. **Configuración de Caja en UI:** Pantalla `CashboxSettingsView` con tablas interactivas para gestionar formas de ingresos y formas de egresos.

## 3. Non-Goals
- Eliminación física (`HARD DELETE`) de categorías que posean movimientos asociados (se utiliza baja lógica / `is_active` para preservar integridad referencial y auditoría histórica).
- Edición del código (`code`) de categorías marcadas como `is_system=True` (`seña` y `saldo_pedido`), ya que están vinculadas a la lógica transaccional de pedidos.
