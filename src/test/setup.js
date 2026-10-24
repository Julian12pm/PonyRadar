// Se ejecuta antes de cada archivo de pruebas.
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
// Agrega comparadores como toBeInTheDocument() a expect
import '@testing-library/jest-dom/vitest'

// Desmonta lo que se dibujó en cada prueba para que no se mezcle con la siguiente
afterEach(() => cleanup())
