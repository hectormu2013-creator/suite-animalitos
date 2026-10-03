# Proyecto: Pronosticador de Animalitos (Gestión de Riesgo y POS)

## 📌 Resumen del Proyecto
Sistema integral para la optimización de venta de animalitos (iniciando con **Guácharo Activo**), control de riesgo financiero mediante arbitraje de números agotados y desarrollo de una plataforma propia de venta.

---

## 🎯 Objetivos Principales

### Fase 1: Bot de Detección de Agotados y Bloqueo de Riesgo (Inmediato)
1. **Computadora dedicada:** Se ejecutará en la máquina local de la taquilla de forma 100% autónoma.
2. **Ciclo de tiempo:**
   - Debe ejecutarse exactamente **27 minutos antes de cada sorteo** de Guácharo Activo (minuto `:33` para sorteos a la hora en punto).
3. **Módulo Lector (PremierPluss Nuevo - Desktop Windows):**
   - Toma foco de la ventana de PremierPluss.
   - Selecciona el sorteo correspondiente de Guácharo Activo.
   - Marca todos los animales e ingresa 100 Bs para validar topes.
   - Extrae la lista de números/animales que rebotan como "Agotados".
   - **Medida de seguridad crítica:** Cancela/limpia la pantalla de inmediato (sin confirmar venta ni imprimir ticket).
4. **Módulo Bloqueador (Triple 7 - Plataforma Web):**
   - Ingresa automáticamente al panel web de Triple 7 (usando Playwright / Puppeteer / API).
   - Bloquea los números agotados para ese sorteo específico (tope 0 Bs o bloqueo directo).
5. **Módulo de Notificación:**
   - Envío de alerta instantánea por **Telegram Bot** con el reporte del sorteo y los números bloqueados.

---

### Fase 2: Plataforma Propia de Venta de Animalitos (Mediano Plazo)
*Alternativa superior a PremierPluss Nuevo.*
1. **Taquilla Ultrarrápida (POS Web / PWA):**
   - 100% operable con teclado numérico (sin ratón).
   - Impresión térmica instantánea (ESC/POS 58mm / 80mm).
   - Tickets con firma criptográfica (QR / Hash antifraude).
2. **Motor de Riesgo Inteligente:**
   - Topes por animalito y por sorteo.
   - Reaseguro automático ("Pase de jugada" automático a plataformas externas cuando se llena un número).
3. **Panel Administrativo y Móvil:**
   - Métricas de ventas y riesgo en vivo desde el celular.
   - Escrutinio y liquidación automática de premios al ingresar el resultado ganador.

---

## 🛠 Entorno y Rutas
* **Directorio del Proyecto:** `C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos`
* **Recursos existentes de referencia:**
  - `..\premierpluss_nuevo_automation\` (Automatizaciones previas)
  - `..\triple7_automation\` (Automatizaciones web previas)

---

## 📋 Pasos Pendientes al Regresar
1. Detallar secuencia exacta de atajos/teclas en PremierPluss para simular y cancelar la jugada.
2. Definir URL y flujo de bloqueo en la web de Triple 7.
3. Crear el token del Bot de Telegram para recibir alertas en el móvil.
