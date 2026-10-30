// Se ejecuta antes de cada archivo de pruebas.
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
// Agrega comparadores como toBeInTheDocument() a expect
import '@testing-library/jest-dom/vitest'

// El mapa tarda en dibujarse cuando corren todas las pruebas en paralelo: los findBy* esperan
// hasta 3 s (antes 1 s) para que la carga del equipo no las haga fallar
configure({ asyncUtilTimeout: 3000 })

// Desmonta lo que se dibujó en cada prueba para que no se mezcle con la siguiente
afterEach(() => cleanup())
