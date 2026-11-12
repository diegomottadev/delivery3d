# Especificación Funcional: Sistema de Gestión de Pedidos y Caja para Taller 3D

## 1. Visión General y Objetivos
* Desarrollar una aplicación web para centralizar la gestión de pedidos de impresión 3D y el control financiero del taller.
* Reemplazar las notas informales en papel, memoria y chats dispersos por un flujo estructurado con trazabilidad completa.

## 2. Stack Tecnológico
* **Backend:** Python con [Flask](https://flask.palletsprojects.com/en/stable/) (API REST modular).
* **Frontend:** React, estructurado sobre la plantilla local `/home/diegomotta/Descargas/babylon-react-8.0.1`.
* **Persistencia:** Base de datos relacional administrada mediante MySQL.
* **Seguridad:** Autenticación basada en tokens JWT con cifrado robusto de contraseñas (`bcrypt` / `werkzeug.security`) y protección de rutas.

## 3. Flujo Operativo de Pedidos (Bambu Lab A1)
* **Recepción y Alta Manual:**
  * Registro de prospectos recibidos vía WhatsApp o Instagram DM.
  * Captura de datos básicos: nombre/apodo del cliente, contacto, descripción de la pieza o enlace/archivo de referencia.
* **Módulo de Cotización Integrado (Basado en [calculadora3d.com.ar/?i=1](https://www.calculadora3d.com.ar/?i=1)):**
  * **Variables del laminador (Bambu Studio):**
    * Peso final de la pieza (gramos).
    * Tiempo estimado de máquina (horas y minutos).
  * **Variables de costo y taller (específicas para Bambu Lab A1):**
    * Costo del filamento por kilogramo + porcentaje de desperdicio/purga.
    * Consumo eléctrico: potencia activa de la A1 (Watts) $\times$ valor del kWh.
    * Amortización de máquina y mantenimiento/desgaste por hora de uso.
    * Costo de mano de obra y preparación inicial.
    * Margen de ganancia neto deseado (%).
  * **Salida del cálculo:** Generación automática de costo de producción y precio de venta final sugerido.
* **Ciclo de Vida y Estados del Pedido:**
  1. `Nuevo / Por cotizar`: Mensaje entrante registrado.
  2. `Presupuestado`: Datos del slicer cargados y valor final informado al cliente.
  3. `Aprobado / En cola`: Confirmación del cliente con registro opcional de seña/anticipo.
  4. `Imprimiendo`: Pieza en producción activa dentro de la Bambu A1.
  5. `Listo`: Impresión finalizada, lista para retiro o despacho.
  6. `Entregado / Cobrado`: Pedido finalizado con saldo cancelado.

## 4. Control Financiero y Caja Diaria
* **Ingresos:**
  * Cobro de señas/anticipos y pagos finales vinculados directamente al `order_id` con un solo clic.
  * Registro de ingresos extraordinarios no asociados a órdenes.
* **Egresos:**
  * Compra de bobinas de filamento (PLA, PETG, etc.), repuestos de la A1 (nozzles, placas, extrusores), electricidad e insumos de empaque.
* **Balance:**
  * Cálculo dinámico del saldo en caja en tiempo real (Ingresos acumulados - Egresos acumulados).

## 5. Diseño de Interfaz (Split-Screen Dashboard)
* **Panel Izquierdo — Tablero Operativo de Pedidos:**
  * Visualización por columnas o tarjetas según estado (`Nuevos` ➔ `Presupuestados` ➔ `Imprimiendo` ➔ `Listos`).
  * Acceso directo al modal de cálculo rápido (cargador de parámetros de Bambu Studio) dentro de cada tarjeta.
  * Botón destacado para dar de alta una nueva orden.
* **Panel Derecho — Módulo Financiero de Caja:**
  * Widget superior con el saldo total disponible y balances del período.
  * Acceso rápido a botones de acción: `+ Registrar Ingreso/Cobro` y `- Registrar Egreso`.
  * Listado cronológico de los últimos movimientos registrados.

Actúa como un arquitecto de bases de datos relacionales Senior y especialista en backend con Python/Flask, SQLAlchemy y MySQL (motor InnoDB).

Necesito diseñar el esquema de base de datos relacional en MySQL para una aplicación web de gestión de taller de impresión 3D (Bambu Lab A1) y control de caja diaria.

REQUISITO OBLIGATORIO:
El modelo de datos debe cumplir rigurosamente con las Formas Normales hasta la Cuarta Forma Normal (1FN, 2FN, 3FN y 4FN/BCNF) para evitar cualquier tipo de redundancia, anomalías de inserción, actualización o borrado:

1. Primera Forma Normal (1FN):
   - Atributos 100% atómicos (sin cadenas concatenadas, JSONs desnormalizados ni listas en celdas).
   - Clave primaria (PK) definida en cada tabla (AUTO_INCREMENT INT o BIGINT).

2. Segunda Forma Normal (2FN):
   - Eliminar dependencias parciales. Todas las columnas no clave dependen de la clave primaria completa (especialmente en tablas asociativas/intermedias).

3. Tercera Forma Normal (3FN):
   - Eliminar dependencias transitivas. Ninguna columna depende de otra que no sea la clave primaria (los cálculos monetarios derivados de la fórmula de Bambu A1 se desglosan en parámetros unitarios o snapshot histórico sin campos calculados redundantes).

4. Cuarta Forma Normal (4FN / BCNF):
   - Eliminar dependencias multivaluadas independientes (por ejemplo, piezas/modelos STL solicitados en un pedido frente a los filamentos/colores utilizados se modelan en entidades de relación separadas para no cruzar atributos multivaluados).

ENTIDADES Y CONTEXTO DEL NEGOCIO A MODELAR (MYSQL / INNODB):
- users: Gestión de usuarios del sistema (username UNIQUE, password_hash VARCHAR(255), auditoría).
- clients: Clientes con origen (ENUM('whatsapp', 'instagram_dm', 'otro')), teléfono/WhatsApp, username de Instagram y notas.
- materials: Stock/catálogo de filamentos (marca, tipo ENUM('PLA', 'PETG', 'ABS', 'TPU', 'otro'), color, costo_por_kg DECIMAL(10,2)).
- orders: Encabezado del pedido (client_id FK, user_id FK, status ENUM('nuevo', 'presupuestado', 'aprobado', 'imprimiendo', 'listo', 'entregado', 'cancelado'), fecha).
- order_items: Detalle de piezas a imprimir por pedido para cumplir 4FN (descripción de pieza/enlace STL, material_id FK, peso_gramos DECIMAL(8,2), tiempo_impresion_minutos INT, cantidad INT).
- order_quotes: Parámetros del snapshot de cotización basados en Bambu A1 y calculadora3d.com.ar (costo_kwh DECIMAL(8,2), watts_consumo DECIMAL(6,2), costo_hora_maquina DECIMAL(8,2), porcentaje_falla DECIMAL(5,2), margen_ganancia DECIMAL(5,2), precio_final_cotizado DECIMAL(10,2)).
- cash_movements: Caja (tipo ENUM('ingreso', 'egreso'), monto DECIMAL(10,2), categoria VARCHAR(60), order_id FK NULLABLE, user_id FK, created_at).

REQUISITOS TÉCNICOS ESPECÍFICOS PARA MYSQL:
- Motor de almacenamiento: InnoDB en todas las tablas con soporte para FOREIGN KEY y transacciones.
- Charset y Collation: utf8mb4 / utf8mb4_unicode_ci.
- Tipos de moneda y pesos: DECIMAL estricto (evitar FLOAT/DOUBLE para dinero).
- Restricciones ON DELETE y ON UPDATE bien fundamentadas (ej. RESTRICT o CASCADE según aplique).

ENTREGABLES REQUERIDOS:
1. Justificación de Normalización: Breve explicación técnica de cómo se cumplen 1FN, 2FN, 3FN y 4FN en este esquema.
2. Script DDL SQL para MySQL (CREATE TABLE con PK, FK, CHECKs e índices).
3. Modelos en Python usando Flask-SQLAlchemy configurados para MySQL (con PyMySQL o mysqlclient).