
//----- Des-comente el bloque de abajo para exportar la aplicación -----//
/*
----- Para exportar la aplicacion, en package.json, modificar la variable start por:
Reemplazar start para exportar aplicacion por este ->"start": "electron-forge start",
----- Para exportar la aplicacion, en package.json, modificar la variable start por:
Reemplazar start para exportar aplicacion por este ->"start": "concurrently \"npm run dev\" \"npm run electron\" \"npm run server\"",


import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  base: './'
});
// ----- Bloque de código para exportar la aplicación -----//
*/

//------- Configuracion para ejecutar en modo desarrollo -------//


import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6969
  }
})
