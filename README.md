# Generador de Guiones Publicitarios

Prototipo web funcional en un solo archivo HTML.

## Uso
1. Abre `index.html` en cualquier navegador.
2. Completa el formulario.
3. Haz clic en **Crear mis 5 guiones**.
4. La app crea cinco estructuras de guion distintas.

## Estado actual
Esta versión genera los textos mediante lógica local en JavaScript, por lo que no necesita API ni servidor.

## Para producción
El siguiente paso recomendado es conectar el formulario a un backend seguro (por ejemplo Node.js, Supabase Edge Functions o Vercel Functions) y desde allí llamar a un modelo de IA. No debes colocar una API key directamente dentro del HTML o JavaScript del navegador.
