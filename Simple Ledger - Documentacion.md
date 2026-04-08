# Simple Ledger — Documentación

Contabilidad personal dentro de [Obsidian](https://obsidian.md), inspirada en [ledger-cli](https://ledger-cli.org/). Registra ingresos, gastos, transferencias y deudas usando contabilidad de doble entrada — todo guardado como texto plano en tu vault.

---

## Primeros pasos

1. Haz click en el ícono de **billetera** en la barra lateral izquierda para abrir el panel
2. Haz click en **+ Nuevo** para agregar tu primera transacción
3. Listo — tus datos se guardan automáticamente en un archivo `.ledger` dentro del vault

---

## Panel lateral

Muestra un resumen en tiempo real de tus finanzas:

| Sección | Descripción |
|---------|-------------|
| **Tarjetas de resumen** | Ingresos, gastos y balance del mes actual |
| **Árbol de cuentas** | Jerarquía de cuentas con su balance, con color según el tipo |
| **Transacciones recientes** | Lista paginada — click en cualquier fila para editar |

---

## Panel central (Dashboard)

Ábrelo con el ícono de gráfico de barras en la barra lateral o desde la paleta de comandos.

Incluye:
- **Filtros** — rango de fechas, cuenta y búsqueda por texto
- **Filtros rápidos** — Hoy / Este mes / Este año / Todo
- **Tarjetas** — ingresos del mes, gastos del mes, total activos, total deudas
- **Gráficos** — flujo de caja o gráfico de distribución tipo dona
- **Lista de transacciones** — tarjetas con fecha, concepto, cuentas y monto; click para editar
- **Panel de cuentas** — balance por cuenta con colores semánticos

### Gráficos

| Modo | Descripción |
|------|-------------|
| **Flujo de caja** | Barras diarias de ingresos/gastos + línea de neto acumulado |
| **Distribución** | Gráfico de dona por cuenta (gastos o ingresos) |

Controles del gráfico de dona:
- **Tipo** — Gastos o Ingresos
- **Nivel 1** — sub-cuentas de primer nivel (ej: `Comida`, `Transporte`)
- **Nivel 2** — sub-cuentas más detalladas (ej: `Comida:Restaurantes`, `Comida:Supermercado`)

---

## Panel de cuentas

Ábrelo con el ícono de **edificio** en la barra lateral o desde la paleta de comandos.

Muestra tres tarjetas de resumen: **Patrimonio neto**, **Total Activos** y **Total Deudas**. Cada tarjeta tiene un botón ⓘ que explica exactamente cómo se calcula el valor y lista las cuentas que lo componen.

Debajo, las cuentas se listan por categoría (Activos, Pasivos, Ingresos, Gastos) con:
- Balance actual
- Flujo del mes (este mes vs. el anterior)
- Sparkline de los últimos 6 meses
- Historial completo de transacciones al expandir una cuenta

---

## Agregar transacciones

Haz click en **+ Nuevo** para abrir el formulario:

| Campo | Descripción |
|-------|-------------|
| **Fecha** | Fecha de la transacción (por defecto: hoy) |
| **Descripción** | Nombre o concepto (ej: "Supermercado", "Salario Marzo") |
| **Monto** | Cantidad en tu moneda |
| **Tipo** | Gasto, Ingreso o Transferencia |
| **Destino** | Cuenta donde va el dinero |
| **Origen** | Cuenta de donde sale el dinero |
| **Estado** | Confirmado (`*`), Pendiente (`!`) o Sin marcar |
| **Notas** | Nota opcional para la transacción |

### Tipos de transacción

- **Gasto**: Dinero que sale de un activo hacia una cuenta de gastos
  - Ejemplo: Compra supermercado → `Gastos:Comida` ← `Activos:Banco`
- **Ingreso**: Dinero que entra a un activo desde una cuenta de ingresos
  - Ejemplo: Cobrar salario → `Activos:Banco` ← `Ingresos:Salario`
- **Transferencia**: Dinero que se mueve entre dos activos
  - Ejemplo: Sacar efectivo → `Activos:Efectivo` ← `Activos:Banco`

---

## Transacciones recurrentes

Ábrelo con el ícono de calendario o desde la paleta de comandos.

### Crear un pago recurrente

1. Click en **+ Nuevo** en el panel
2. Completa: nombre, monto, cuentas de origen/destino, frecuencia y día de vencimiento
3. Guardar — la próxima fecha se calcula automáticamente

### Frecuencias disponibles

| Frecuencia | Configuración |
|-----------|--------------|
| Mensual | Día del mes (1–31) |
| Semanal | Día de la semana (lunes–domingo) |
| Anual | Mes y día del año |

### Indicadores de estado

- **Vencido** (fecha pasada, sin pagar) — se muestra con ⚠ en rojo
- **Vence hoy** — resaltado en naranja
- **Próximo** — se muestra con la fecha futura

---

## Presupuestos

Ábrelo con el ícono de objetivo o desde la paleta de comandos.

### Crear un presupuesto

1. Click en **Nuevo presupuesto** en el encabezado
2. Elige la cuenta a controlar, el monto límite y el período (mensual o anual)
3. Guardar — el panel muestra inmediatamente el progreso de gasto

Cada tarjeta muestra:
- Barra de progreso (verde → amarillo → rojo al acercarse al límite)
- Monto gastado vs. el límite
- Monto restante o cuánto se excedió el límite

### Editar y eliminar

Click en cualquier tarjeta de presupuesto para expandir un formulario de edición inline — sin ventanas modales.

---

## Créditos y deudas

Ábrelo desde la paleta de comandos → **Nuevo crédito**.

### Configurar un crédito

1. Ingresa el nombre del crédito (se crea una cuenta `Pasivos:`)
2. Ingresa el capital (monto recibido) y la deuda total (capital + intereses y cargos)
3. Ingresa el número de cuotas y la cuenta activo de donde salen los pagos
4. El asistente calcula automáticamente: cuota mensual, porción de interés y porción de capital

### Seguimiento de pagos

Cada pago de crédito registra dos movimientos automáticamente:
- Reducción del pasivo (porción de capital)
- Gasto de intereses (va a `Gastos:Intereses:<nombre>`)

---

## Gestión de cuentas

Accede desde:
- El **panel de cuentas** → click en ⚙ junto a cualquier categoría
- El **panel central** → click en ⚙ en el árbol de cuentas
- La paleta de comandos → **Gestionar cuentas**

### Tipos de cuentas y prefijos

| Tipo | Prefijo por defecto | Para qué sirve | Color |
|------|--------------------|----|-------|
| Gastos | `Gastos:` | En qué gastaste | Rojo |
| Ingresos | `Ingresos:` | De dónde entra dinero | Verde |
| Activos | `Activos:` | Lo que tienes | Neutro |
| Pasivos | `Pasivos:` | Lo que debes | Naranja |

> Los prefijos son configurables en Ajustes → Simple Ledger → Prefijos de cuentas. Hay presets de idioma para español e inglés.

### Acciones disponibles

- **Agregar** — escribe el nombre y presiona **+**
- **Renombrar** — click en ✎, edita en línea, presiona Enter. Todas las transacciones existentes se actualizan automáticamente.
- **Eliminar** — click en ×
- **Excluir del balance** — click en ◎ para activar/desactivar. Las cuentas excluidas siguen visibles pero no se suman en las tarjetas de resumen (útil para AFP/fondos de pensión).

### Sub-cuentas

Usa `:` para crear jerarquías:

```
Gastos:Comida
Gastos:Comida:Restaurantes
Gastos:Comida:Supermercado
Activos:Banco:BBVA
Activos:Banco:Santander
```

---

## Bloques de código en notas

Inserta reportes financieros en vivo en cualquier nota de Obsidian. Los reportes se actualizan automáticamente cuando cambia el archivo ledger.

### Bloques disponibles

| Bloque | Descripción |
|--------|-------------|
| `ledger-balance` | Tabla de balance por cuenta |
| `ledger-register` | Lista detallada de transacciones |
| `ledger-summary` | Ingresos, gastos y neto agrupados por período |
| `ledger-pie` | Gráfico de dona por cuenta |
| `ledger-cashflow` | Barras diarias + línea de neto acumulado |
| `ledger-bar` | Barras agrupadas de ingresos vs gastos por período |
| `ledger-debts` | Próximos vencimientos y deudas |
| `ledger-budget` | Barras de progreso de presupuestos |

### Opciones de filtrado

Todos los bloques aceptan opciones en formato `clave: valor`, una por línea. **Las claves son en inglés:**

| Opción | Aplica a | Descripción | Ejemplo |
|--------|---------|-------------|---------|
| `account` | todos | Filtrar por nombre de cuenta (parcial) | `account: Gastos` |
| `from` | todos | Fecha de inicio (inclusive) | `from: 2026/03/01` |
| `to` | todos | Fecha de fin (inclusive) | `to: 2026/03/31` |
| `month` | todos | Atajo para un mes completo | `month: 2026/03` |
| `year` | todos | Atajo para un año completo | `year: 2026` |
| `today` | todos | Solo el día de hoy (sin valor) | `today` |
| `search` | todos | Buscar en descripción o cuenta | `search: supermercado` |
| `limit` | balance, register | Máximo de resultados | `limit: 5` |
| `order` | balance, register | Orden: `asc` o `desc` (defecto: `desc`) | `order: asc` |
| `period` | summary, bar | Agrupación: `month` o `year` | `period: year` |
| `type` | pie | Tipo: `expenses`, `income`, `assets`, `liabilities` | `type: income` |
| `level` | pie | Nivel: `1` = principal, `2` = sub-cuentas | `level: 2` |

### Ejemplos prácticos

**Gastos de marzo 2026:**
````
```ledger-balance
month: 2026/03
account: Gastos
```
````

**Últimas 5 transacciones de comida:**
````
```ledger-register
account: Comida
limit: 5
```
````

**Resumen anual:**
````
```ledger-summary
year: 2026
period: year
```
````

**Transacciones de hoy:**
````
```ledger-register
today
```
````

**Distribución de gastos del mes (nivel 1):**
````
```ledger-pie
type: expenses
level: 1
month: 2026/03
```
````

**Fuentes de ingresos del año:**
````
```ledger-pie
type: income
year: 2026
```
````

**Flujo de caja del primer trimestre:**
````
```ledger-cashflow
from: 2026/01/01
to: 2026/03/31
```
````

**Ingresos vs gastos mensuales:**
````
```ledger-bar
year: 2026
period: month
```
````

**Comparativa anual:**
````
```ledger-bar
period: year
```
````

**Próximos vencimientos:**
````
```ledger-debts
```
````

**Presupuesto de comida:**
````
```ledger-budget
account: Gastos:Comida
period: monthly
```
````

---

## Contabilidad de doble entrada

Cada transacción tiene al menos dos movimientos que se cancelan entre sí:

```
Activos:Banco        +$1.000.000   (tu banco sube)
Ingresos:Salario     -$1.000.000   (se registra el origen)
Total = $0
```

Si el total NO es cero, hay un error en alguna transacción.

| Tipo | Débito (recibe) | Crédito (entrega) |
|------|----------------|-------------------|
| Gasto | Cuenta de gastos | Cuenta de activos |
| Ingreso | Cuenta de activos | Cuenta de ingresos |
| Transferencia | Activo destino | Activo origen |

---

## Formato del archivo .ledger

Texto plano compatible con [ledger-cli](https://ledger-cli.org/):

```ledger
; Comentario
2026/03/01 * Salario Marzo
    ; Deposito quincena
    Activos:Banco              $1.000.000
    Ingresos:Salario

2026/03/02 * Supermercado
    Gastos:Comida              $85.000
    Activos:Banco

2026/03/05 * Pago cuota credito
    Pasivos:CreditoBanco       $150.000
    Activos:Banco
```

### Reglas del formato

- Primera línea: `FECHA [ESTADO] DESCRIPCIÓN`
- Una línea con `;` justo después es una **nota** de esa transacción
- Las líneas indentadas son los movimientos de cuenta
- La última cuenta puede omitir el monto — se calcula automáticamente
- Estado: `*` = confirmado, `!` = pendiente, sin marca = sin estado
- Las fechas usan formato `AAAA/MM/DD`

---

## URI de Obsidian

Registra transacciones desde fuera de Obsidian mediante una URL — útil para atajos en el teléfono, marcadores del navegador o scripts.

### Formato

```
obsidian://simple-ledger?vault=NOMBRE_VAULT&payee=DESCRIPCION&amount=MONTO&to=CUENTA_DESTINO&from=CUENTA_ORIGEN
```

### Parámetros

| Parámetro | Requerido | Descripción |
|-----------|----------|-------------|
| `vault` | Recomendado | Nombre de tu vault |
| `payee` | Sí | Descripción de la transacción |
| `amount` | Sí | Monto numérico (sin símbolo ni separadores) |
| `to` | Sí | Cuenta destino (nombre completo) |
| `from` | Sí | Cuenta origen (nombre completo) |
| `date` | No | Fecha en formato `AAAA/MM/DD`. Por defecto: hoy. |
| `status` | No | `*` = confirmado, `!` = pendiente. Por defecto: `*` |

### Ejemplos

```
obsidian://simple-ledger?vault=MiVault&payee=Supermercado&amount=85000&to=Gastos:Comida&from=Activos:Banco
obsidian://simple-ledger?vault=MiVault&payee=Netflix&amount=15000&to=Gastos:Entretenimiento&from=Pasivos:TarjetaCredito
```

### Atajo en iOS

1. Abre **Atajos** → **+** → agrega la acción **Abrir URL**
2. Pega tu URI en el campo de URL
3. (Opcional) Agrega **Pedir datos de entrada** antes para que pregunte el monto cada vez
4. Nómbralo y agrégalo a la pantalla de inicio

### Atajo en Android

Usa la app **HTTP Shortcuts**: crea un **Browser Shortcut** con tu URI y colócalo en la pantalla de inicio.

---

## Configuración

Ve a **Ajustes → Plugins de la comunidad → Simple Ledger**:

| Opción | Descripción | Por defecto |
|--------|-------------|-------------|
| **Archivo ledger** | Ruta del archivo `.ledger` dentro del vault | `Finanzas.ledger` |
| **Símbolo de moneda** | Símbolo a mostrar (ej: `$`, `€`, `£`) | `$` |
| **Moneda después del número** | Formato `100 €` en vez de `$100` | Desactivado |
| **Decimales** | Cantidad de decimales (usar `0` para CLP u otras sin decimales) | `2` |
| **Separador de miles** | Carácter separador de miles | `,` |
| **Prefijos de cuentas** | Prefijo para cada tipo de cuenta | `Gastos:`, `Ingresos:`, `Activos:`, `Pasivos:` |
| **Barra de estado** | Muestra vencimientos próximos en la barra de estado de Obsidian | Activado |
| **Días de anticipación** | Con cuántos días de anticipación mostrar en la barra de estado | `7` |

### Presets de idioma

Los ajustes incluyen botones de preset **ES** y **EN** que configuran todos los prefijos y cuentas predeterminadas en un solo click. Aparece una confirmación antes de aplicar, ya que cambiar los prefijos no actualiza las transacciones históricas automáticamente.
