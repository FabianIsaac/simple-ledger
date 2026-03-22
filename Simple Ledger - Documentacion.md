# Simple Ledger - Documentacion

Contabilidad personal sencilla dentro de Obsidian, inspirada en [ledger-cli](https://ledger-cli.org/). Registra ingresos, gastos, transferencias y deudas usando contabilidad de doble entrada.

---

## Primeros pasos

1. Abre el panel lateral con el icono de billetera en la barra lateral o con `Ctrl+P` → **"Simple Ledger: Abrir panel de finanzas"**
2. Haz click en **"+ Nuevo"** para agregar tu primera transaccion
3. Listo. Tus datos se guardan en un archivo `.ledger` dentro del vault

---

## Panel lateral

El panel lateral muestra un resumen de tus finanzas:

| Seccion | Descripcion |
|---------|-------------|
| **Tarjetas de resumen** | Ingresos totales, Gastos totales y Balance (activos netos) |
| **Cuentas** | Arbol jerarquico con el balance de cada cuenta y subcuenta |
| **Transacciones** | Lista de las ultimas transacciones (click para editar) |

### Botones del panel
- **+ Nuevo** → Abre el formulario para agregar una transaccion
- **↻** → Recarga los datos desde el archivo
- **⚙** (junto a Cuentas) → Abre el gestor de cuentas
- **Ver todas** → Muestra todas las transacciones (aparece si hay mas de 10)

---

## Agregar transacciones

Al hacer click en **"+ Nuevo"** se abre un formulario con:

| Campo | Descripcion |
|-------|-------------|
| **Fecha** | Fecha de la transaccion (por defecto: hoy) |
| **Descripcion** | Nombre o concepto (ej: "Supermercado", "Salario Marzo") |
| **Monto** | Cantidad en tu moneda |
| **Tipo** | Gasto, Ingreso o Transferencia (cambia las cuentas disponibles) |
| **Destino** | Cuenta a donde va el dinero |
| **Origen** | Cuenta de donde sale el dinero |
| **Estado** | Confirmado (*), Pendiente (!) o Sin marcar |

### Tipos de transaccion

- **Gasto**: Dinero que sale de un activo hacia un gasto
  - Ejemplo: Compra en supermercado → `Gastos:Comida` ← `Activos:Banco`
- **Ingreso**: Dinero que entra a un activo desde un ingreso
  - Ejemplo: Cobrar salario → `Activos:Banco` ← `Ingresos:Salario`
- **Transferencia**: Dinero que se mueve entre activos
  - Ejemplo: Sacar efectivo → `Activos:Efectivo` ← `Activos:Banco`

---

## Editar y eliminar transacciones

Haz **click en cualquier transaccion** del panel lateral para abrir el editor. Aparece un icono de lapiz (✎) al pasar el mouse.

Desde el editor puedes:
- Modificar cualquier campo (fecha, descripcion, monto, cuentas, estado)
- **Guardar cambios** → Actualiza la transaccion en el archivo
- **Eliminar** → Borra la transaccion (con confirmacion previa)

---

## Gestion de cuentas

Accede desde el icono ⚙ en el panel lateral o desde `Ctrl+P` → **"Simple Ledger: Gestionar cuentas"**.

### Tipos de cuentas

| Tipo | Prefijo | Para que sirve | Ejemplos |
|------|---------|----------------|----------|
| **Activos** | `Activos:` | Lo que tienes | Banco, Efectivo, Ahorros |
| **Gastos** | `Gastos:` | En que gastaste | Comida, Transporte, Salud |
| **Ingresos** | `Ingresos:` | De donde entra dinero | Salario, Freelance |
| **Pasivos** | `Pasivos:` | Lo que debes | TarjetaCredito, Prestamo |

### Acciones disponibles
- **Agregar cuenta**: Escribe el nombre y presiona **+**. Si no incluyes el prefijo, se agrega automaticamente
- **Renombrar cuenta**: Click en el icono ✎ → edita el nombre en linea → Enter para confirmar. Esto actualiza automaticamente todas las transacciones existentes
- **Eliminar cuenta**: Click en el boton ×

### Subcuentas
Usa `:` para crear jerarquias. Puedes anidar tantos niveles como necesites:

```
Gastos:Comida
Gastos:Comida:Restaurantes
Gastos:Comida:Supermercado
Activos:Banco:BBVA
Activos:Banco:Santander
```

---

## Contabilidad de doble entrada

Cada transaccion tiene al menos dos movimientos que se cancelan entre si. Esto garantiza que los numeros siempre cuadren.

### Por que el Total del Balance siempre es $0?

Porque es correcto. Cada peso que entra a un lugar, sale de otro:

```
Activos:Banco        +$1000000   (tu banco sube)
Ingresos:Salario     -$1000000   (se registra el origen)
Suma = $0
```

Si el total NO es cero, hay un error en alguna transaccion.

### Ejemplo: Registrar un credito bancario

1. Agrega la cuenta `Pasivos:CreditoBancoChile` en el gestor de cuentas
2. Cuando recibes el credito (el banco te deposita):
   - Tipo: Transferencia
   - Destino: `Activos:Banco`
   - Origen: `Pasivos:CreditoBancoChile`
   - Esto refleja que tu banco sube pero tu deuda tambien
3. Cuando pagas una cuota:
   - Tipo: Transferencia
   - Destino: `Pasivos:CreditoBancoChile`
   - Origen: `Activos:Banco`
   - Esto refleja que tu deuda baja y tu banco tambien

---

## Bloques de codigo en notas

Puedes insertar tablas y reportes en cualquier nota de Obsidian usando bloques de codigo especiales.

### Balance

Muestra el balance de cada cuenta:

````
```ledger-balance
```
````

### Registro

Muestra el listado detallado de transacciones:

````
```ledger-register
```
````

### Resumen

Muestra ingresos, gastos y neto agrupados por periodo:

````
```ledger-summary
```
````

### Opciones de filtrado

Todos los bloques aceptan opciones en formato `clave: valor`, una por linea:

| Opcion | Descripcion | Ejemplo |
|--------|-------------|---------|
| `cuenta` | Filtrar por nombre de cuenta (parcial) | `cuenta: Gastos` |
| `desde` | Fecha de inicio (inclusive) | `desde: 2026/03/01` |
| `hasta` | Fecha de fin (inclusive) | `hasta: 2026/03/31` |
| `mes` | Atajo para un mes completo | `mes: 2026/03` |
| `año` | Atajo para un año completo | `año: 2026` |
| `hoy` | Atajo para solo el dia de hoy | `hoy` |
| `buscar` | Buscar en descripcion o cuenta | `buscar: supermercado` |
| `limite` | Maximo de resultados | `limite: 5` |
| `orden` | Orden: `asc` o `desc` (defecto: desc) | `orden: asc` |
| `periodo` | Solo para summary: `mes` o `anual` | `periodo: anual` |

### Ejemplos practicos

**Gastos de marzo 2026:**
````
```ledger-balance
mes: 2026/03
cuenta: Gastos
```
````

**Ultimas 5 transacciones de comida:**
````
```ledger-register
cuenta: Comida
limite: 5
```
````

**Resumen anual:**
````
```ledger-summary
año: 2026
periodo: anual
```
````

**Transacciones de hoy:**
````
```ledger-register
hoy
```
````

**Buscar por texto:**
````
```ledger-register
buscar: supermercado
orden: asc
```
````

---

## Comandos disponibles

Accesibles desde la paleta de comandos (`Ctrl+P`):

| Comando | Descripcion |
|---------|-------------|
| **Agregar transaccion** | Abre el formulario de nueva transaccion |
| **Abrir panel de finanzas** | Muestra el panel lateral |
| **Abrir archivo ledger** | Abre el archivo `.ledger` para edicion directa |
| **Gestionar cuentas** | Abre el gestor de cuentas |

---

## Configuracion

Accede desde **Configuracion → Plugins de la comunidad → Simple Ledger**:

| Opcion | Descripcion | Valor por defecto |
|--------|-------------|-------------------|
| **Archivo de transacciones** | Ruta del archivo `.ledger` dentro del vault | `Finanzas.ledger` |
| **Simbolo de moneda** | Simbolo a mostrar (ej: $, €, £, CLP) | `$` |
| **Moneda despues del numero** | Formato "100 €" en vez de "$100" | Desactivado |
| **Decimales** | Cantidad de decimales a mostrar (usar 0 para monedas sin decimales como CLP) | `2` |
| **Gestionar cuentas** | Agregar, renombrar o eliminar cuentas predeterminadas | — |

### Cuentas predeterminadas

El plugin viene con estas cuentas por defecto:

**Gastos:** Comida, Transporte, Hogar, Salud, Entretenimiento, Ropa, Educacion, Servicios, Otros
**Ingresos:** Salario, Freelance, Otros
**Activos:** Banco, Efectivo, Ahorros
**Pasivos:** TarjetaCredito, Prestamo

Puedes agregar, renombrar o eliminar cualquiera desde el gestor de cuentas.

---

## Formato del archivo .ledger

El archivo es texto plano compatible con [ledger-cli](https://ledger-cli.org/). Puedes editarlo manualmente si lo prefieres:

```ledger
; Comentario
2026/03/01 * Salario Marzo
    Activos:Banco              $1000000
    Ingresos:Salario

2026/03/02 * Supermercado
    Gastos:Comida              $85000
    Activos:Banco

2026/03/05 * Pago cuota credito
    Pasivos:CreditoBanco       $150000
    Activos:Banco
```

### Reglas del formato
- La primera linea es la fecha + estado + descripcion
- Las siguientes lineas (indentadas) son los movimientos
- La ultima cuenta puede omitir el monto (se calcula automaticamente)
- Estado: `*` = confirmado, `!` = pendiente, sin marca = sin estado
- Los comentarios empiezan con `;`
