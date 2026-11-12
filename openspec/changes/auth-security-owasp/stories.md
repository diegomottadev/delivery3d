# User Stories: auth-security-owasp

## Story 1: Inicio de Sesión Seguro
Como operador del taller,
quiero ingresar con mi usuario y contraseña a través de una pantalla de login protegida,
para que solo el personal autorizado pueda ver y gestionar pedidos y movimientos de caja.

## Story 2: Protección contra Ataques de Autenticación
Como administrador del sistema,
quiero que las contraseñas estén hasheadas de forma robusta y que los tokens JWT expiren en un plazo determinado,
para mitigar accesos no autorizados y robos de sesión conforme a las normas de OWASP.

## Story 3: Cierre de Sesión y Control de Identidad
Como operador,
quiero poder cerrar mi sesión con un clic en la barra superior y ver mi nombre de usuario reflejado en el sistema,
para tener certeza de qué operador está firmando las transacciones.
