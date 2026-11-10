# SeñalIA — Website final

Proyecto educativo de reconocimiento de señales con un modelo publicado de Teachable Machine.

## Archivos
- `index.html`: estructura de la página.
- `style.css`: diseño adaptable a computadora y móvil.
- `script.js`: carga el modelo, controla la cámara, aplica el umbral y gestiona el historial.

## Cómo ejecutar
1. Extrae el ZIP.
2. Abre la carpeta en Visual Studio Code.
3. Instala la extensión **Live Server** si aún no la tienes.
4. Abre `index.html`, haz clic derecho y elige **Open with Live Server**.
5. Pulsa **Iniciar cámara** y permite el acceso a la cámara.
6. Necesitas conexión a Internet para cargar las bibliotecas y el modelo.

Modelo configurado:
`https://teachablemachine.withgoogle.com/models/rTrFBnf4M/`

## Lógica de detección e historial
- Umbral inicial: 90 % de confianza.
- Se requieren 5 predicciones consecutivas de la misma clase por encima del umbral.
- La clase de “Nada” (o nombres parecidos) no se guarda como una señal reconocida.
- La misma clase no se vuelve a guardar mientras siga detectándose continuamente; se rearma cuando el modelo pasa varios fotogramas por debajo del umbral o reconoce “Nada”.
- El historial se guarda localmente en el navegador (`localStorage`) y se limita a 40 registros.

## Importante sobre el umbral
El 90 % es un valor inicial para la demostración, no una garantía de exactitud real. Antes de la presentación, pruébalo con varias señales, distintos fondos e iluminación y objetos que no sean señales. Si produce falsos positivos, se puede aumentar el umbral o revisar las muestras de entrenamiento. Un modelo de IA puede equivocarse incluso con confianza alta.

## Personalizar las definiciones
Edita `EXPLANATIONS` en `script.js`. Cada objeto contiene:
- `terms`: palabras que pueden aparecer en el nombre de la clase.
- `meaning`: definición breve.
- `advice`: recomendación.

Las definiciones automáticas se aplican cuando el nombre de la clase coincide con alguna palabra. Si una clase tiene un nombre diferente, la página mostrará una explicación general; adapta la entrada de `EXPLANATIONS` al nombre exacto de la clase para asegurar que el significado sea correcto.

## Solución de problemas
- Si el modelo no carga, comprueba Internet y que la URL del modelo sea pública y correcta.
- Si la cámara no se activa, usa Live Server (`localhost`) y revisa los permisos del navegador.
- Si el modelo muestra nombres inesperados, revisa las clases en Teachable Machine y ajusta las definiciones.
